import { NextResponse } from "next/server"
import { Buffer } from "node:buffer"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

// Allowed roles as requested
const ALLOWED_ROLES = ["super_admin", "business_admin", "business_members"] as const

type Role = (typeof ALLOWED_ROLES)[number]
function isAllowedRole(r: string): r is Role {
  return (ALLOWED_ROLES as readonly string[]).includes(r)
}

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const contentType = req.headers.get("content-type") || ""
    let full_name = ""
    let business_email = ""
    let company_name = ""
    let password = ""
    let role = ""
    let company_logo_url = ""
    let company_logo_file: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      full_name = (form.get("full_name") ?? form.get("name") ?? "").toString().trim()
      business_email = (form.get("business_email") ?? form.get("email") ?? "").toString().trim().toLowerCase()
      company_name = (form.get("company_name") ?? form.get("company") ?? "").toString().trim()
      password = (form.get("password") ?? "").toString()
      role = (form.get("role") ?? "").toString()
      company_logo_url = (form.get("company_logo_url") ?? "").toString().trim()
      const f = form.get("company_logo")
      company_logo_file = f instanceof File ? f : null
    } else {
      const body = await req.json()
      full_name = (body.full_name ?? body.name ?? "").toString().trim()
      business_email = (body.business_email ?? body.email ?? "").toString().trim().toLowerCase()
      company_name = (body.company_name ?? body.company ?? "").toString().trim()
      password = (body.password ?? "").toString()
      role = (body.role ?? "").toString()
      company_logo_url = (body.company_logo_url ?? "").toString().trim()
    }

    if (!full_name || !business_email || !company_name || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // was: if (!ALLOWED_ROLES.includes(role as any)) {
    if (!isAllowedRole(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    // 1) Create auth user
    const defaultPlan = role === "super_admin" ? "vip" : role === "business_admin" ? "freemium" : undefined
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: business_email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, company_name, company_logo_url, ...(defaultPlan ? { plan: defaultPlan } : {}) },
    })

    if (userErr || !userRes.user) {
      // Handle case where the user might already exist
      return NextResponse.json({ error: userErr?.message || "Unable to create user" }, { status: 400 })
    }

    const userId = userRes.user.id

    // 2) Create company
    const { data: company, error: companyErr } = await supabaseAdmin
      .from("companies")
      .insert({ name: company_name, business_email })
      .select()
      .single()

    if (companyErr || !company) {
      return NextResponse.json({ error: companyErr?.message || "Unable to create company" }, { status: 400 })
    }

    // 3) Create profile
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .insert({ user_id: userId, full_name, role, company_id: company.id })

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message || "Unable to create profile" }, { status: 400 })
    }

    // 4) If a company logo file was provided, upload to Storage and update user metadata
    if (company_logo_file) {
      try {
        // Ensure bucket exists
        try {
          await supabaseAdmin.storage.createBucket("company-logos", { public: true })
        } catch {}
        const arrayBuffer = await company_logo_file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const ext = company_logo_file.name.includes(".") ? company_logo_file.name.split(".").pop() : "bin"
        const key = `${company.id}/${crypto.randomUUID()}.${ext}`
        const { data: up, error: upErr } = await supabaseAdmin.storage
          .from("company-logos")
          .upload(key, buffer, { contentType: company_logo_file.type || "application/octet-stream", upsert: false })
        if (!upErr && up) {
          const { data: pub } = supabaseAdmin.storage.from("company-logos").getPublicUrl(key)
          company_logo_url = pub.publicUrl
          // merge into user metadata
          const currentMeta = (userRes.user.user_metadata || {}) as Record<string, unknown>
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: { ...currentMeta, company_logo_url: company_logo_url },
          })
        }
      } catch {}
    }

    return NextResponse.json({ ok: true, message: "Account created" }, { status: 201 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
