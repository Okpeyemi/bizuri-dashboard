import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { getSupabaseForToken } from "@/lib/supabase/server"

const ALLOWED_MEMBER_STATUS = ["agent", "manager"] as const

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization")
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 })
    }
    const token = auth.slice("Bearer ".length)

    const supa = getSupabaseForToken(token)
    const { data: userRes, error: userErr } = await supa.auth.getUser()
    if (userErr || !userRes.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = userRes.user.id

    const admin = getSupabaseAdmin()
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single()
    if (meErr || !me) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 })
    }

    const { data, error } = await admin
      .from("profiles")
      .select("user_id, full_name, role, member_status, created_at")
      .eq("company_id", me.company_id)
      .order("created_at", { ascending: false })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ data })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization")
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 })
    }
    const token = auth.slice("Bearer ".length)

    const supa = getSupabaseForToken(token)
    const { data: userRes, error: userErr } = await supa.auth.getUser()
    if (userErr || !userRes.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = userRes.user.id

    // Load caller profile (to get company_id and role) using admin to avoid RLS recursion
    const admin = getSupabaseAdmin()
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", userId)
      .single()
    if (meErr || !me) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 })
    }
    if (me.role !== "super_admin" && me.role !== "business_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const email = (body.email ?? "").toString().trim().toLowerCase()
    const member_status = (body.member_status ?? "").toString()
    if (!email || !member_status) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }
    if (!ALLOWED_MEMBER_STATUS.includes(member_status as typeof ALLOWED_MEMBER_STATUS[number])) {
      return NextResponse.json({ error: "Invalid member_status" }, { status: 400 })
    }

    // Create auth user as business member
    const randomPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { invited_by: userId },
    })
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message || "Unable to create user" }, { status: 400 })
    }

    const newUserId = created.user.id

    // Insert profile in same company with role business_members
    const { error: profErr } = await admin
      .from("profiles")
      .insert({ user_id: newUserId, full_name: email, role: "business_members", member_status, company_id: me.company_id })
    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
