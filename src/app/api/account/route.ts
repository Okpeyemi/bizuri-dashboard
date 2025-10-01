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

    const admin = getSupabaseAdmin()

    // Profile and company
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("user_id, full_name, role, member_status, company_id, created_at")
      .eq("user_id", userRes.user.id)
      .single()
    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 })
    }

    let company: { id: string; name: string; business_email: string } | null = null
    if (profile?.company_id) {
      const { data: comp, error: compErr } = await admin
        .from("companies")
        .select("id, name, business_email")
        .eq("id", profile.company_id)
        .single()
      if (!compErr) company = comp
    }

    const meta = (userRes.user.user_metadata || {}) as Record<string, unknown>

    return NextResponse.json({
      user: {
        id: userRes.user.id,
        email: userRes.user.email,
        metadata: {
          full_name: (meta["full_name"] as string) || profile?.full_name || null,
          company_name: (meta["company_name"] as string) || company?.name || null,
          company_logo_url: (meta["company_logo_url"] as string) || null,
          avatar_url: (meta["avatar_url"] as string) || null,
          role: meta["role"] ?? profile?.role ?? null,
        },
      },
      profile,
      company,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
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

    const admin = getSupabaseAdmin()

    const body = await req.json().catch(() => ({}))
    const full_name: string | undefined = body.full_name ? String(body.full_name) : undefined
    const company_name: string | undefined = body.company_name ? String(body.company_name) : undefined
    const company_logo_url: string | undefined = body.company_logo_url ? String(body.company_logo_url) : undefined
    const avatar_url: string | undefined = body.avatar_url ? String(body.avatar_url) : undefined

    // Load existing profile for company_id
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userRes.user.id)
      .single()
    if (profErr || !profile) {
      return NextResponse.json({ error: profErr?.message || "Profile not found" }, { status: 400 })
    }

    // Update profile
    if (typeof full_name === "string") {
      const { error } = await admin
        .from("profiles")
        .update({ full_name })
        .eq("user_id", userRes.user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update company name if provided
    if (company_name) {
      const { error } = await admin
        .from("companies")
        .update({ name: company_name })
        .eq("id", profile.company_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Merge and update auth user metadata
    const currentMeta = (userRes.user.user_metadata || {}) as Record<string, unknown>
    const newMeta = {
      ...currentMeta,
      ...(full_name !== undefined ? { full_name } : {}),
      ...(company_name !== undefined ? { company_name } : {}),
      ...(company_logo_url !== undefined ? { company_logo_url } : {}),
      ...(avatar_url !== undefined ? { avatar_url } : {}),
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(userRes.user.id, {
      user_metadata: newMeta,
    })
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
