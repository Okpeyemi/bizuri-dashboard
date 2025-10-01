"use client"

import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowUpRight } from "lucide-react"
import { Loader } from "@/components/ui/loader"

type DashboardCounts = {
  campaigns: number
  campaigns_published: number
  telegram_subscribers: number
  members: number
}

type DashboardCampaign = {
  id: string
  name: string
  status: string
  created_at: string
  image_url: string | null
}

type DashboardSubscriber = {
  user_id: number
  first_name: string | null
  last_name: string | null
  username: string | null
  photo_url: string | null
  created_at: string
}

type DashboardMember = {
  user_id: string
  full_name: string
  role: string
  member_status: string
  created_at: string
}

type LastSignin = { id: string; email: string | null; last_sign_in_at: string | null }
type Operation = { type: string; at: string; title: string }

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [counts, setCounts] = useState<DashboardCounts | null>(null)
  const [recentCampaigns, setRecentCampaigns] = useState<DashboardCampaign[]>([])
  const [subscribers, setSubscribers] = useState<DashboardSubscriber[]>([])
  const [members, setMembers] = useState<DashboardMember[]>([])
  const [lastSignins, setLastSignins] = useState<LastSignin[]>([])
  const [operations, setOperations] = useState<Operation[]>([])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        if (!token) throw new Error("Not authenticated")
        // role
        const { data: user } = await supabaseClient.auth.getUser()
        // was: const r = (user.user?.user_metadata as any)?.role as string | undefined
        const meta = user.user?.user_metadata as Record<string, unknown> | undefined
        const r = meta && typeof meta["role"] === "string" ? (meta["role"] as string) : undefined
        setRole(r || null)

        const res = await fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load dashboard")
        if (!mounted) return
        setCounts(json.counts as DashboardCounts)
        setRecentCampaigns((json.recent?.campaigns ?? []) as DashboardCampaign[])
        setSubscribers((json.recent?.subscribers ?? []) as DashboardSubscriber[])
        setMembers((json.recent?.members ?? []) as DashboardMember[])
        setLastSignins((json.statuses?.last_signins ?? []) as LastSignin[])
        setOperations((json.statuses?.operations ?? []) as Operation[])
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load dashboard"
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const kpi = [
    { label: "Campagnes", value: counts?.campaigns ?? 0 },
    { label: "Publiées", value: counts?.campaigns_published ?? 0 },
    { label: "Abonnés Telegram", value: counts?.telegram_subscribers ?? 0 },
    ...(role === "business_members" ? [] : [{ label: "Membres", value: counts?.members ?? 0 } as const]),
  ]

  return (
    <DashboardShell title="Overview">
      {loading ? (
        <Loader />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpi.map((item) => (
              <Card key={item.label} className="p-4">
                <div className="text-sm text-muted-foreground">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold">{item.value}</div>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent Members (hidden for business_members) */}
            {role !== "business_members" ? (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Membres récents</h3>
                <a
                  href="/membres"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                  aria-label="Voir les membres"
                  title="Voir les membres"
                >
                  <ArrowUpRight className="size-4" />
                </a>
              </div>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">Aucun membre récemment.</p>
              ) : (
                <div className="mt-3 grid gap-3">
                  {members.map((m) => {
                    const name = m.full_name || m.user_id
                    const initials = (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
                    return (
                      <div key={`m-${m.user_id}-${m.created_at}`} className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{name}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.role} · {m.member_status} · {new Date(m.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
            ) : null}

            {/* Recent Campaigns */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Dernières campagnes</h3>
                <a
                  href="/campagnes"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                  aria-label="Voir toutes les campagnes"
                  title="Voir toutes les campagnes"
                >
                  <ArrowUpRight className="size-4" />
                </a>
              </div>
              {recentCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">Aucune campagne.</p>
              ) : (
                <div className="mt-3 grid gap-3">
                  {recentCampaigns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="text-xs rounded-md border px-2 py-0.5 uppercase">
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Latest Telegram Subscribers */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Nouveaux abonnés Telegram</h3>
                <a
                  href="/clients"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                  aria-label="Voir tous les abonnés Telegram"
                  title="Voir tous les abonnés Telegram"
                >
                  <ArrowUpRight className="size-4" />
                </a>
              </div>
              {subscribers.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">Aucun abonné récemment.</p>
              ) : (
                <div className="mt-3 grid gap-3">
                  {subscribers.map((u) => {
                    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || `@${u.user_id}`
                    const initials = (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
                    return (
                      <div key={`sub-${u.user_id}-${u.created_at}`} className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.photo_url || undefined} alt={name} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
            {/* Super Admin: Business quick access */}
            {role === "super_admin" ? (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Business</h3>
                  <a href="/business" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowUpRight className="size-4" />
                  </a>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Voir toutes les entreprises inscrites.</p>
              </Card>
            ) : null}
          </div>

          {role === "business_members" ? null : (
            <div className="grid gap-6">
              {/* Statuses */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold">Statuts</h3>
                <div className="mt-3 grid gap-6">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground">Dernières connexions</h4>
                    {lastSignins.length === 0 ? (
                      <p className="text-sm text-muted-foreground mt-2">Aucune connexion récente.</p>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {lastSignins.map((s) => (
                          <div key={`ls-${s.id}-${s.last_sign_in_at}`} className="flex items-center justify-between rounded-md border p-2">
                            <span className="truncate text-sm">{s.email || s.id}</span>
                            <span className="text-xs text-muted-foreground">{s.last_sign_in_at ? new Date(s.last_sign_in_at).toLocaleString() : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground">Dernières opérations</h4>
                    {operations.length === 0 ? (
                      <p className="text-sm text-muted-foreground mt-2">Aucune opération récente.</p>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {operations.map((op, idx) => (
                          <div key={`op-${idx}-${op.at}`} className="flex items-center justify-between rounded-md border p-2">
                            <span className="truncate text-sm">{op.title}</span>
                            <span className="text-xs text-muted-foreground">{new Date(op.at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  )
}
