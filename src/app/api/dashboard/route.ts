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

    // Counts
    const [cAll, cPublished, tgCount, membersCount] = await Promise.all([
      admin.from("campaigns").select("id", { count: "exact", head: true }).eq("company_id", me.company_id),
      admin
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("company_id", me.company_id)
        .eq("status", "published"),
      admin
        .from("telegram_users")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", me.company_id)
        .eq("subscribed", true),
      admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("company_id", me.company_id),
    ])

    if (cAll.error || cPublished.error || tgCount.error || membersCount.error) {
      return NextResponse.json(
        { error: cAll.error?.message || cPublished.error?.message || tgCount.error?.message || membersCount.error?.message },
        { status: 400 }
      )
    }

    // Recent lists
    const [
      { data: recentCampaigns, error: rcErr },
      { data: recentSubs, error: rsErr },
      { data: recentMembers, error: rmErr },
    ] = await Promise.all([
      admin
        .from("campaigns")
        .select("id,name,status,created_at,image_url")
        .eq("company_id", me.company_id)
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("telegram_users")
        .select("user_id,first_name,last_name,username,photo_url,created_at")
        .eq("company_id", me.company_id)
        .eq("subscribed", true)
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("profiles")
        .select("user_id,full_name,role,member_status,created_at")
        .eq("company_id", me.company_id)
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    if (rcErr || rsErr || rmErr) {
      return NextResponse.json({ error: rcErr?.message || rsErr?.message || rmErr?.message }, { status: 400 })
    }

    // Last sign-ins (via auth admin)
    const { data: profilesAll, error: pAllErr } = await admin
      .from("profiles")
      .select("user_id")
      .eq("company_id", me.company_id)
    if (pAllErr) {
      return NextResponse.json({ error: pAllErr.message }, { status: 400 })
    }
    const profileIds = new Set((profilesAll ?? []).map((p: { user_id: string }) => p.user_id))

    // listUsers is paginated; fetch first page (200 users) and filter to our company
    const { data: usersList, error: luErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (luErr) {
      return NextResponse.json({ error: luErr.message }, { status: 400 })
    }
    const lastSignins = (usersList?.users || [])
      .filter((u) => profileIds.has(u.id) && !!u.last_sign_in_at)
      .map((u) => ({ id: u.id, email: u.email, last_sign_in_at: u.last_sign_in_at }))
      .sort((a, b) => new Date(b.last_sign_in_at || 0).getTime() - new Date(a.last_sign_in_at || 0).getTime())
      .slice(0, 5)

    // Unified operations feed: recent campaigns, telegram subs, member joined
    type OpItem = { type: string; at: string; title: string; meta?: Record<string, unknown> }
    const ops: OpItem[] = []
    ;(recentCampaigns ?? []).forEach((c) => {
      ops.push({ type: "campaign_created", at: c.created_at as string, title: `Campagne: ${c.name}` })
    })
    ;(recentSubs ?? []).forEach((s) => {
      const name = [s.first_name, s.last_name].filter(Boolean).join(" ") || s.username || `@${s.user_id}`
      ops.push({ type: "telegram_subscribed", at: s.created_at as string, title: `Abonné Telegram: ${name}` })
    })
    ;(recentMembers ?? []).forEach((m) => {
      ops.push({ type: "member_joined", at: m.created_at as string, title: `Membre: ${m.full_name}` })
    })
    ops.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    const recentOps = ops.slice(0, 7)

    return NextResponse.json({
      counts: {
        campaigns: cAll.count ?? 0,
        campaigns_published: cPublished.count ?? 0,
        telegram_subscribers: tgCount.count ?? 0,
        members: membersCount.count ?? 0,
      },
      recent: {
        campaigns: recentCampaigns ?? [],
        subscribers: recentSubs ?? [],
        members: recentMembers ?? [],
      },
      statuses: {
        last_signins: lastSignins,
        operations: recentOps,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
