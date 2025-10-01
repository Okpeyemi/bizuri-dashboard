import { NextResponse } from "next/server"
import { Buffer } from "node:buffer"
import { getSupabaseForToken } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

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

    // Ensure bucket exists (ignore if already exists)
    try {
      await admin.storage.createBucket("avatars", { public: true })
    } catch (e) {
      // ignore if it already exists
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
    const path = `users/${userRes.user.id}-${Date.now()}.${ext}`

    const { error: upErr } = await admin.storage.from("avatars").upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    })
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    const { data: pub } = admin.storage.from("avatars").getPublicUrl(path)
    const publicUrl = pub.publicUrl

    // Update metadata
    const currentMeta = (userRes.user.user_metadata || {}) as Record<string, unknown>
    const { error: updErr } = await admin.auth.admin.updateUserById(userRes.user.id, {
      user_metadata: { ...currentMeta, avatar_url: publicUrl },
    })
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, avatar_url: publicUrl })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
