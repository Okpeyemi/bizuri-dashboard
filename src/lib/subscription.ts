export type Plan = "freemium" | "premium" | "vip"

export const PLANS: Plan[] = ["freemium", "premium", "vip"]

export function normalizePlan(p?: unknown): Plan {
  const s = (typeof p === "string" ? p : "").toLowerCase()
  return (PLANS as string[]).includes(s) ? (s as Plan) : "freemium"
}

export function limitsFor(plan: Plan): {
  maxClients: number | null
  maxCampaignsPerMonth: number | null
  maxMembers: number | null
} {
  switch (plan) {
    case "freemium":
      return { maxClients: 150, maxCampaignsPerMonth: 5, maxMembers: 1 }
    case "premium":
      return { maxClients: 400, maxCampaignsPerMonth: null, maxMembers: 3 }
    case "vip":
    default:
      return { maxClients: null, maxCampaignsPerMonth: null, maxMembers: null }
  }
}

export function firstDayOfCurrentMonth(): string {
  const d = new Date()
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  return s.toISOString()
}

// Server helper: derive plan for a company using any business_admin's user_metadata.plan
// Fallback: freemium
export async function getCompanyPlan(
  admin: ReturnType<typeof import("@/lib/supabase/admin").getSupabaseAdmin>,
  company_id: string
): Promise<Plan> {
  const { data: adminProfile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("company_id", company_id)
    .eq("role", "business_admin")
    .limit(1)
    .maybeSingle()
  if (!adminProfile?.user_id) return "freemium"
  // Get auth user to read metadata
  const { data: userData } = await admin.auth.admin.getUserById(adminProfile.user_id)
  const meta = (userData?.user?.user_metadata || {}) as Record<string, unknown>
  return normalizePlan(meta["plan"]) || "freemium"
}
