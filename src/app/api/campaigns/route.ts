import { NextResponse } from "next/server"
import { getSupabaseForToken } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

type TelegramChatId = { chat_id: number }

async function buildCampaignMessage(c: { name: string; description: string | null; promotion_type: string | null; promotion_value: number | null; starts_at: string | null; ends_at: string | null }) {
  const lines: string[] = []
  lines.push(`📣 Nouvelle campagne: ${c.name}`)
  if (c.description) lines.push(c.description)
  const promo = c.promotion_type && c.promotion_value != null ?
    (c.promotion_type === "percentage" ? `Promotion: -${c.promotion_value}%` : `Promotion: -${c.promotion_value}`) : null
  if (promo) lines.push(promo)
  const period = [c.starts_at ? new Date(c.starts_at).toLocaleDateString() : null, c.ends_at ? new Date(c.ends_at).toLocaleDateString() : null]
  if (period[0] || period[1]) lines.push(`Période: ${period[0] || "-"} → ${period[1] || "-"}`)
  return lines.join("\n")
}

async function broadcastCampaign(admin: ReturnType<typeof getSupabaseAdmin>, company_id: string, campaignId: string) {
  // Load campaign
  const { data: campaign, error: cErr } = await admin
    .from("campaigns")
    .select("id,name,description,status,image_url,starts_at,ends_at,promotion_type,promotion_value")
    .eq("id", campaignId)
    .eq("company_id", company_id)
    .single()
  if (cErr || !campaign) return

  // Load bot token
  const { data: bot, error: bErr } = await admin
    .from("telegram_bot_settings")
    .select("bot_token")
    .eq("company_id", company_id)
    .maybeSingle()
  if (bErr || !bot?.bot_token) return
  const token = bot.bot_token as string

  // Load subscribers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error: uErr } = await (admin as any)
    .from("telegram_users")
    .select("chat_id")
    .eq("company_id", company_id)
    .eq("subscribed", true)
  if (uErr) return
  const chatUsers: TelegramChatId[] = ((users ?? []) as unknown) as TelegramChatId[]

  const message = await buildCampaignMessage(campaign)
  for (const u of chatUsers) {
    try {
      if (campaign.image_url) {
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: u.chat_id, photo: campaign.image_url, caption: message })
        })
      } else {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: u.chat_id, text: message })
        })
      }
    } catch {
      // ignore individual failures
    }
  }
}

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
      .from("campaigns")
      .select("id,name,description,status,image_url,starts_at,ends_at,promotion_type,promotion_value,created_at")
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
    const name = body.name?.toString().trim() ?? ""
    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 })
    }

    const description = body.description == null ? null : String(body.description)
    const status = String(body.status || "draft")
    const image_url = body.image_url == null ? null : String(body.image_url)
    const starts_at = body.starts_at == null ? null : String(body.starts_at)
    const ends_at = body.ends_at == null ? null : String(body.ends_at)
    const promotion_type = body.promotion_type == null ? null : String(body.promotion_type)
    const promotion_value = body.promotion_value == null ? null : Number(body.promotion_value)

    const { data: inserted, error: insErr } = await admin
      .from("campaigns")
      .insert({
        company_id: me.company_id,
        name,
        description,
        status,
        image_url,
        starts_at,
        ends_at,
        promotion_type,
        promotion_value,
      })
      .select("id")
      .single()
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 })
    }

    // Broadcast if published
    if (status === "published") {
      await broadcastCampaign(admin, me.company_id, inserted.id)
    }

    return NextResponse.json({ ok: true, id: inserted.id }, { status: 201 })
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
    const userId = userRes.user.id

    const admin = getSupabaseAdmin()
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", userId)
      .single()
    if (meErr || !me) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 })
    }
    if (!(me.role === "super_admin" || me.role === "business_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const id = (body.id ?? "").toString().trim()
    const status = (body.status ?? "").toString().trim()
    if (!id || !["draft", "published"].includes(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { data: updated, error: upErr } = await admin
      .from("campaigns")
      .update({ status })
      .eq("id", id)
      .eq("company_id", me.company_id)
      .select("id")
      .single()
    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message || "Update failed" }, { status: 400 })
    }

    if (status === "published") {
      await broadcastCampaign(admin, me.company_id, id)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
