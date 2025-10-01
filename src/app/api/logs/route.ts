import { NextResponse } from "next/server"
import { getSupabaseForToken } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type { Tables } from "@/types/supabase.generated"

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization")
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 })
    }
    const token = auth.slice("Bearer ".length)

    const supa = getSupabaseForToken(token)
    const { data: userRes, error: userErr } = await supa.auth.getUser()
    if (userErr || !userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const admin = getSupabaseAdmin()
    const { data: me, error: meErr } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .single()
    if (meErr || !me) return NextResponse.json({ error: "Profile not found" }, { status: 400 })
    if (me.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    type CompanyRow = Pick<Tables<"companies">, "id" | "name">
    type CampaignRow = Pick<Tables<"campaigns">, "id" | "name" | "created_at" | "company_id">
    type MemberRow = Pick<Tables<"profiles">, "user_id" | "full_name" | "role" | "created_at" | "company_id">
    // Supabase generated types have an issue for telegram_users; define the subset we read here explicitly
    type TelegramUserRow = {
      user_id: number
      first_name: string | null
      last_name: string | null
      username: string | null
      created_at: string
      company_id: string
      subscribed: boolean
    }

    const companiesQ = admin.from("companies").select("id,name").returns<CompanyRow[]>()
    const campaignsQ = admin
      .from("campaigns")
      .select("id,name,created_at,company_id")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<CampaignRow[]>()
    const membersQ = admin
      .from("profiles")
      .select("user_id,full_name,role,created_at,company_id")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<MemberRow[]>()
    const subsQ = admin
      .from("telegram_users")
      .select("user_id,first_name,last_name,username,created_at,company_id,subscribed")
      .eq("subscribed", true)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<TelegramUserRow[]>()

    const [{ data: companies }, { data: campaigns }, { data: members }, { data: subs }] = await Promise.all([
      companiesQ,
      campaignsQ,
      membersQ,
      subsQ,
    ])

    const cMap = new Map<string, string>()
    for (const c of companies || []) cMap.set(c.id, c.name)

    const mapCampaigns = (campaigns || []).map((c) => ({
      id: c.id,
      name: c.name,
      at: c.created_at,
      company_id: c.company_id,
      company_name: cMap.get(c.company_id) || "",
    }))
    const mapMembers = (members || []).map((m) => ({
      id: m.user_id,
      full_name: m.full_name,
      role: m.role,
      at: m.created_at,
      company_id: m.company_id,
      company_name: cMap.get(m.company_id) || "",
    }))
    const mapSubs = (subs || []).map((s) => ({
      id: s.user_id,
      name: [s.first_name, s.last_name].filter(Boolean).join(" ") || s.username || `@${s.user_id}`,
      at: s.created_at,
      company_id: s.company_id,
      company_name: cMap.get(s.company_id) || "",
    }))

    return NextResponse.json({
      campaigns: mapCampaigns,
      members: mapMembers,
      subscribers: mapSubs,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
