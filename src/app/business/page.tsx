"use client"
import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card } from "@/components/ui/card"
import { Loader } from "@/components/ui/loader"
import { useTranslations } from "next-intl"

type Company = { id: string; name: string; business_email: string; created_at: string }

export default function BusinessPage() {
  const t = useTranslations("Business")
  const [items, setItems] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

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
      const res = await fetch("/api/business", { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to load companies")
      if (!mounted) return
      setItems(json.data || [])
    })()
    return () => { mounted = false }
  }, [])

  return (
    <DashboardShell title={t("title")}>
      {role !== "super_admin" ? (
        <p className="text-sm text-muted-foreground">{t("accessDenied")}</p>
      ) : loading ? (
        <Loader />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-3">
          {items.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.business_email}</div>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}
