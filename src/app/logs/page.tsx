"use client"
import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card } from "@/components/ui/card"
import { Loader } from "@/components/ui/loader"

export default function LogsPage() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    campaigns: { id: string; name: string; at: string; company_id: string; company_name: string }[]
    members: { id: string; full_name: string; role: string; at: string; company_id: string; company_name: string }[]
    subscribers: { id: string; name: string; at: string; company_id: string; company_name: string }[]
  } | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: user } = await supabaseClient.auth.getUser()
      const meta = user.user?.user_metadata as Record<string, unknown> | undefined
      const r = meta && typeof meta["role"] === "string" ? (meta["role"] as string) : undefined
      setRole(r || null)
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      const res = await fetch("/api/logs", { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to load logs")
      if (!mounted) return
      setData(json)
    })()
    return () => { mounted = false }
  }, [])

  return (
    <DashboardShell title="Logs (Super Admin)">
      {role !== "super_admin" ? (
        <p className="text-sm text-muted-foreground">Accès interdit.</p>
      ) : loading ? (
        <Loader />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !data ? null : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Campagnes</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {data.campaigns.length === 0 ? (
                <p className="text-muted-foreground">Aucune campagne récente.</p>
              ) : (
                data.campaigns.map((c) => (
                  <div key={c.id + c.at} className="flex items-center justify-between rounded-md border p-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.company_name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(c.at).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold">Membres</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {data.members.length === 0 ? (
                <p className="text-muted-foreground">Aucun membre récent.</p>
              ) : (
                data.members.map((m) => (
                  <div key={m.id + m.at} className="flex items-center justify-between rounded-md border p-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">{m.role} · {m.company_name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(m.at).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold">Abonnés Telegram</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {data.subscribers.length === 0 ? (
                <p className="text-muted-foreground">Aucun abonné récent.</p>
              ) : (
                data.subscribers.map((s) => (
                  <div key={s.id + s.at} className="flex items-center justify-between rounded-md border p-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.company_name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(s.at).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </DashboardShell>
  )
}
