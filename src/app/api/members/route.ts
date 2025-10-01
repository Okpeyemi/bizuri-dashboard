import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { getSupabaseForToken } from "@/lib/supabase/server"
import { getCompanyPlan, limitsFor } from "@/lib/subscription"
import { sendCredentialsEmail } from "@/lib/mailer"

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
    // Merge disabled info from Auth (user_metadata.disabled or banned_until)
    const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const disabledMap = new Map<string, boolean>()
    for (const u of usersList?.users || []) {
      const umd = (u.user_metadata || {}) as Record<string, unknown>
      const bannedUntil = (u as unknown as { banned_until?: string | null }).banned_until
      const disabled = Boolean(umd["disabled"]) || Boolean(bannedUntil)
      if (disabled) disabledMap.set(u.id, true)
    }
    const enriched = (data || []).map((m) => ({ ...m, disabled: disabledMap.get(m.user_id) || false }))
    return NextResponse.json({ data: enriched })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
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
    const callerId = userRes.user.id

    const admin = getSupabaseAdmin()
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", callerId)
      .single()
    if (meErr || !me) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 })
    }
    if (!(me.role === "super_admin" || me.role === "business_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const user_id = (body.user_id ?? "").toString().trim()
    const disabled = Boolean(body.disabled)
    if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 })

    // Ensure target belongs to same company and is a business_member
    const { data: target, error: tErr } = await admin
      .from("profiles")
      .select("user_id, company_id, role")
      .eq("user_id", user_id)
      .maybeSingle()
    if (tErr || !target) return NextResponse.json({ error: "Target not found" }, { status: 404 })
    if (target.company_id !== me.company_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (target.role !== "business_members") return NextResponse.json({ error: "Seuls les membres peuvent être désactivés" }, { status: 400 })

    // Update auth user: ban/unban and set user_metadata.disabled
    const { data: userData } = await admin.auth.admin.getUserById(user_id)
    const currentMeta = (userData?.user?.user_metadata || {}) as Record<string, unknown>
    const { error: updErr } = await admin.auth.admin.updateUserById(user_id, {
      ban_duration: disabled ? "100y" : "none",
      user_metadata: { ...currentMeta, disabled },
    })
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
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
    const password = (body.password ?? "").toString()
    if (!email || !member_status || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }
    if (!ALLOWED_MEMBER_STATUS.includes(member_status as typeof ALLOWED_MEMBER_STATUS[number])) {
      return NextResponse.json({ error: "Invalid member_status" }, { status: 400 })
    }

    // Enforce plan limits for members (skip for super_admin)
    if (me.role !== "super_admin") {
      const plan = await getCompanyPlan(admin, me.company_id)
      const limits = limitsFor(plan)
      if (limits.maxMembers != null) {
        const { count, error: cntErr } = await admin
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("company_id", me.company_id)
          .eq("role", "business_members")
        if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 400 })
        if ((count ?? 0) >= limits.maxMembers) {
          return NextResponse.json({ error: "Limite de membres atteinte pour votre plan" }, { status: 403 })
        }
      }
    }

    // Create auth user as business member (with provided password)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
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

    // Send email with credentials (best-effort)
    try {
      await sendCredentialsEmail({ to: email, emailPassword: password })
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
