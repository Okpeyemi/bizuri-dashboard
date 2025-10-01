import { NextResponse } from "next/server"
import { getSupabaseForToken } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization")
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 })
    }
    const token = auth.slice("Bearer ".length)

    const supa = getSupabaseForToken(token)
    const { data: userRes, error: userErr } = await supa.auth.getUser()
    if (userErr || !userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const admin = getSupabaseAdmin()
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .single()
    if (meErr || !me) return NextResponse.json({ error: "Profile not found" }, { status: 400 })
    if (me.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data, error } = await admin
      .from("companies")
      .select("id,name,business_email,created_at")
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data: data || [] })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
