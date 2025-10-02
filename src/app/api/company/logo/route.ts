import { NextResponse } from "next/server"
import { Buffer } from "node:buffer"
import { getSupabaseForToken } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

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

    const admin = getSupabaseAdmin()

    // Find company_id for the requesting user
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userRes.user.id)
      .single()
    if (meErr || !me) return NextResponse.json({ error: "Profile not found" }, { status: 400 })

    // Get all user_ids in the same company
    const { data: members, error: memErr } = await admin
      .from("profiles")
      .select("user_id")
      .eq("company_id", me.company_id)
    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 })

    // Look for first user that has company_logo_url in metadata
    for (const m of members || []) {
      try {
        const u = await admin.auth.admin.getUserById(m.user_id)
        const meta = (u.data.user?.user_metadata || {}) as Record<string, unknown>
        const url = typeof meta["company_logo_url"] === "string" ? (meta["company_logo_url"] as string) : ""
        if (url) {
          return NextResponse.json({ company_logo_url: url })
        }
      } catch {}
    }

    return NextResponse.json({ company_logo_url: null })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
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

    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Get company_id from profile
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userRes.user.id)
      .single()
    if (meErr || !me) return NextResponse.json({ error: "Profile not found" }, { status: 400 })

    // Ensure bucket exists
    try {
      await admin.storage.createBucket("company-logos", { public: true })
    } catch {}

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
    const path = `${me.company_id}/${userRes.user.id}-${Date.now()}.${ext}`

    const { error: upErr } = await admin.storage.from("company-logos").upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    const { data: pub } = admin.storage.from("company-logos").getPublicUrl(path)
    const publicUrl = pub.publicUrl

    // Update metadata on current user
    const currentMeta = (userRes.user.user_metadata || {}) as Record<string, unknown>
    const { error: updErr } = await admin.auth.admin.updateUserById(userRes.user.id, {
      user_metadata: { ...currentMeta, company_logo_url: publicUrl },
    })
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, company_logo_url: publicUrl })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
