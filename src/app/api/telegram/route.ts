import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { getSupabaseForToken } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase.generated"

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
    const db = admin as unknown as SupabaseClient<Database>

    // Load caller profile to get company_id
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single()
    if (meErr || !me) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 })
    }

    // was: (admin as { from: Function }).from("telegram_bot_settings")
    const { data, error } = await db
      .from("telegram_bot_settings")
      .select("bot_token,start_message,stop_message")
      .eq("company_id", me.company_id)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
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
    const db = admin as unknown as SupabaseClient<Database>
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", userId)
      .single()
    if (meErr || !me) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 })
    }
    if (!(["super_admin", "business_admin"] as const).includes(me.role as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const bot_token = (body.bot_token ?? "").toString().trim()
    const start_message = body.start_message == null ? null : String(body.start_message)
    const stop_message = body.stop_message == null ? null : String(body.stop_message)
    if (!bot_token) {
      return NextResponse.json({ error: "Missing bot_token" }, { status: 400 })
    }

    // was: (admin as any).from("telegram_bot_settings")
    const { error: upsertErr } = await db
      .from("telegram_bot_settings")
      .upsert({ company_id: me.company_id, bot_token, start_message, stop_message })
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 })
    }

    // Try to set webhook if site URL is configured
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL
    if (siteUrl) {
      try {
        const webhookUrl = `${siteUrl.replace(/\/$/, "")}/api/telegram/webhook/${me.company_id}`
        const res = await fetch(`https://api.telegram.org/bot${bot_token}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: webhookUrl })
        })
        const json = await res.json().catch(() => ({}))
        return NextResponse.json({ ok: true, webhook: json?.ok ?? false })
      } catch {
        // ignore webhook failures
      }
    }

    return NextResponse.json({ ok: true, webhook: false })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 })
  }
}
