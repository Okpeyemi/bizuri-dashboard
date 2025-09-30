"use client"
import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DashboardShell } from "@/components/dashboard-shell"

 type Member = {
  user_id: string
  full_name: string
  role: string
  member_status: "agent" | "manager"
  created_at: string
}

export default function MembresPage() {
  const [items, setItems] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"agent" | "manager">("agent")
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        if (!token) throw new Error("Not authenticated")
        const res = await fetch("/api/members", { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load members")
        if (!mounted) return
        setItems((json.data as Member[]) || [])
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load members"
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

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setSubmitMsg(null)
    setError(null)
    try {
      setSubmitting(true)
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, member_status: status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Invite failed")
      setSubmitMsg("Membre ajouté avec succès")
      setEmail("")
      setStatus("agent")
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Invite failed"
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell title="Membres">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold">Ajouter un membre</h3>
          <form onSubmit={invite} className="mt-4 grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Statut</Label>
              <select
                id="status"
                className="bg-background text-foreground border-input focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-10 w-full rounded-md border px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as "agent" | "manager")}
              >
                <option value="agent">Agent</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Ajout..." : "Ajouter"}
            </Button>
            {submitMsg ? <p className="text-green-600 text-sm">{submitMsg}</p> : null}
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </form>
        </Card>
        <div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun membre.</p>
          ) : (
            <div className="grid gap-3">
              {items.map((m) => (
                <Card key={m.user_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">{m.role} · {m.member_status}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
