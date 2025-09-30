import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { getSupabaseForToken } from "@/lib/supabase/server"

export const runtime = "nodejs"

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

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 })
    }

    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })

    const admin = getSupabaseAdmin()
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single()
    if (meErr || !me) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 })
    }
    const companyId = me.company_id

    // Ensure bucket exists
    try {
      await admin.storage.createBucket("campaign-images", { public: true })
    } catch {
      // erreur ignorée
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin"
    const key = `${companyId}/${crypto.randomUUID()}.${ext}`

    const { data, error } = await admin.storage.from("campaign-images").upload(key, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const { data: pub } = admin.storage.from("campaign-images").getPublicUrl(key)
    return NextResponse.json({ url: pub.publicUrl, path: data?.path })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 })
  }
}
