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

    const [{ data: clients, error: cErr }, { data: tgUsers, error: tErr }] = await Promise.all([
      admin
        .from("clients")
        .select("id, full_name, phone, created_at")
        .eq("company_id", me.company_id)
        .order("created_at", { ascending: false }),
      admin
        .from("telegram_users")
        .select("user_id, chat_id, first_name, last_name, username, phone, photo_url, created_at")
        .eq("company_id", me.company_id)
        .eq("subscribed", true)
        .order("created_at", { ascending: false }),
    ])
    if (cErr || tErr) {
      return NextResponse.json({ error: cErr?.message || tErr?.message }, { status: 400 })
    }
    return NextResponse.json({ clients: clients || [], telegram_users: tgUsers || [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
