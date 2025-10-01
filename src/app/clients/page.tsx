"use client"
import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { DashboardShell } from "@/components/dashboard-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Client = {
  id: string
  full_name: string
  phone: string | null
  created_at: string
}

type TelegramUser = {
  user_id: number
  chat_id: number
  first_name: string | null
  last_name: string | null
  username: string | null
  phone: string | null
  photo_url: string | null
  created_at: string
}

export default function ClientsPage() {
  const [items, setItems] = useState<Client[]>([])
  const [tgUsers, setTgUsers] = useState<TelegramUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        if (!token) throw new Error("Not authenticated")
        const res = await fetch("/api/clients", { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load clients")
        if (!mounted) return
        setItems(json.clients || [])
        setTgUsers(json.telegram_users || [])
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load clients"
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

  return (
    <DashboardShell title="Clients">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : tgUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun abonné Telegram.</p>
      ) : (
        <div className="grid gap-8">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Abonnés Telegram</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tgUsers.map((u) => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || `@${u.user_id}`
                const initials = (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
                return (
                  <Card key={`tg-${u.user_id}-${u.chat_id}`} className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={u.photo_url || undefined} alt={name} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{name}</span>
                          <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{u.phone || "—"}</div>
                        {u.username ? <div className="text-xs text-muted-foreground">@{u.username}</div> : null}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
