import { NextResponse } from "next/server"
import { getSupabaseForToken } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { firstDayOfCurrentMonth, limitsFor, normalizePlan, type Plan, getCompanyPlan } from "@/lib/subscription"

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

    // Caller profile
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", userRes.user.id)
      .single()
    if (meErr || !me) return NextResponse.json({ error: "Profile not found" }, { status: 400 })

    // Determine plan
    const plan: Plan = me.role === "super_admin" ? "vip" : await getCompanyPlan(admin, me.company_id)
    const limits = limitsFor(plan)

    // Usage metrics
    const monthStart = firstDayOfCurrentMonth()
    const [clients, members, campaigns] = await Promise.all([
      admin.from("clients").select("id", { count: "exact", head: true }).eq("company_id", me.company_id),
      admin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", me.company_id)
        .eq("role", "business_members"),
      admin
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("company_id", me.company_id)
        .gte("created_at", monthStart),
    ])

    if (clients.error || members.error || campaigns.error) {
      return NextResponse.json({ error: clients.error?.message || members.error?.message || campaigns.error?.message }, { status: 400 })
    }

    const usage = {
      clients: clients.count ?? 0,
      members: members.count ?? 0,
      campaigns_month: campaigns.count ?? 0,
    }

    return NextResponse.json({ plan, limits, usage })
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
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", userRes.user.id)
      .single()
    if (meErr || !me) return NextResponse.json({ error: "Profile not found" }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const desiredPlan = normalizePlan(body.plan)

    // Only super_admin or business_admin can set plan; super_admin always VIP but can set other firms if needed later
    if (!(me.role === "super_admin" || me.role === "business_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Update caller's metadata (business_admin). For super_admin, we still set their own metadata.
    const currentMeta = (userRes.user.user_metadata || {}) as Record<string, unknown>
    const { error: updErr } = await admin.auth.admin.updateUserById(userRes.user.id, {
      user_metadata: { ...currentMeta, plan: desiredPlan },
    })
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, plan: desiredPlan })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
