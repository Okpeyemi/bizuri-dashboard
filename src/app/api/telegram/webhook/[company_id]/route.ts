import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

async function tg(method: string, token: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ company_id: string }> }
) {
  try {
    const { company_id } = await context.params
    const update = await req.json().catch(() => ({}))
    const admin = getSupabaseAdmin()
    // const company_id = params.company_id
    if (!company_id) return NextResponse.json({ ok: false }, { status: 400 })

    // Load bot token for this company
    const { data: bot, error: botErr } = await admin
      .from("telegram_bot_settings")
      .select("bot_token,start_message,stop_message")
      .eq("company_id", company_id)
      .maybeSingle()
    if (botErr || !bot?.bot_token) {
      return NextResponse.json({ ok: true })
    }
    const token = bot.bot_token as string

    const msg = update.message
    if (!msg) return NextResponse.json({ ok: true })

    const from = msg.from || {}
    const chat = msg.chat || {}
    const chat_id: number | undefined = chat.id
    const user_id: number | undefined = from.id
    if (!chat_id || !user_id) return NextResponse.json({ ok: true })

    const first_name: string | null = from.first_name || null
    const last_name: string | null = from.last_name || null
    const username: string | null = from.username || null

    // Optional contact share
    let phone: string | null = null
    if (msg.contact && msg.contact.phone_number) {
      phone = String(msg.contact.phone_number)
    }

    // Try to get profile photo
    let photo_url: string | null = null
    try {
      const photos = await tg("getUserProfilePhotos", token, { user_id, limit: 1 })
      const file_id = photos?.result?.photos?.[0]?.[0]?.file_id
      if (file_id) {
        const fileRes = await tg("getFile", token, { file_id })
        const file_path = fileRes?.result?.file_path
        if (file_path) {
          photo_url = `https://api.telegram.org/file/bot${token}/${file_path}`
        }
      }
    } catch {
      // erreur ignorée
    }

    // Upsert user into telegram_users (basic info)
    await admin
      .from("telegram_users")
      .upsert(
        {
          company_id,
          chat_id,
          user_id,
          first_name,
          last_name,
          username,
          phone,
          photo_url,
        },
        { onConflict: "company_id,user_id" }
      )

    // Optionally insert into clients if we have a phone and not existing
    if (phone) {
      const full_name = [first_name, last_name].filter(Boolean).join(" ") || username || "Client"
      const { data: existing } = await admin
        .from("clients")
        .select("id")
        .eq("company_id", company_id)
        .eq("phone", phone)
        .maybeSingle()
      if (!existing) {
        await admin.from("clients").insert({ company_id, full_name, phone })
      }
    }

    // Commands handling
    const text: string | undefined = msg.text
    if (text && /^\s*\/start\b/.test(text)) {
      // Mark as subscribed
      await admin
        .from("telegram_users")
        .update({ subscribed: true })
        .eq("company_id", company_id)
        .eq("user_id", user_id)

      const welcome = bot.start_message || `Bienvenue! Vous recevrez les campagnes publiées ici.`
      await tg("sendMessage", token, {
        chat_id,
        text: `${welcome}\nPour partager votre téléphone, utilisez le bouton "Partager mon contact".`,
        reply_markup: {
          keyboard: [[{ text: "Partager mon contact", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      })
    } else if (text && /^\s*\/stop\b/.test(text)) {
      // Mark as unsubscribed
      await admin
        .from("telegram_users")
        .update({ subscribed: false })
        .eq("company_id", company_id)
        .eq("user_id", user_id)

      const bye = bot.stop_message || `Vous ne recevrez plus de notifications. Tapez /start pour reprendre.`
      await tg("sendMessage", token, { chat_id, text: bye })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
