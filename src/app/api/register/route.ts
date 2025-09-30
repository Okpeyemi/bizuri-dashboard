import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

// Allowed roles as requested
const ALLOWED_ROLES = ["super_admin", "business_admin", "business_members"] as const

type Role = (typeof ALLOWED_ROLES)[number]
function isAllowedRole(r: string): r is Role {
  return (ALLOWED_ROLES as readonly string[]).includes(r)
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json()
    const full_name = (body.full_name ?? body.name ?? "").toString().trim()
    const business_email = (body.business_email ?? body.email ?? "").toString().trim().toLowerCase()
    const company_name = (body.company_name ?? body.company ?? "").toString().trim()
    const password = (body.password ?? "").toString()
    const role = (body.role ?? "").toString()

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
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: business_email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, company_name },
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

    return NextResponse.json({ ok: true, message: "Account created" }, { status: 201 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
