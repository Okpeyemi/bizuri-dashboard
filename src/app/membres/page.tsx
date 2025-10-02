"use client"
import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DashboardShell } from "@/components/dashboard-shell"
import { Loader } from "@/components/ui/loader"
import { Switch } from "@/components/ui/switch"

 type Member = {
  user_id: string
  full_name: string
  role: string
  member_status: "agent" | "manager"
  created_at: string
  disabled?: boolean
}

export default function MembresPage() {
  const [items, setItems] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [memberStatus, setMemberStatus] = useState<"agent" | "manager" | null>(null)

  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"agent" | "manager">("agent")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)

  const [atMemberLimit, setAtMemberLimit] = useState(false)

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
        // precise member_status from API for gating
        let ms: "agent" | "manager" | null = null
        try {
          const accRes = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } })
          const accJson = await accRes.json()
          if (accRes.ok) ms = (accJson?.profile?.member_status as "agent" | "manager" | null) || null
          setMemberStatus(ms)
        } catch {}
        if (r === "business_members" && ms === "agent") {
          setItems([])
          return
        }
        // subscription limits
        const subRes = await fetch("/api/subscription", { headers: { Authorization: `Bearer ${token}` } })
        const subJson = await subRes.json()
        if (subRes.ok) {
          const maxMembers = subJson?.limits?.maxMembers as number | null
          const usedMembers = subJson?.usage?.members as number | undefined
          if (maxMembers != null && typeof usedMembers === "number") {
            setAtMemberLimit(usedMembers >= maxMembers)
          } else {
            setAtMemberLimit(false)
          }
        }
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

  async function toggleAccess(user_id: string, disabled: boolean | undefined) {
    try {
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id, disabled: !disabled }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Update failed")
      setItems((prev) => prev.map((m) => (m.user_id === user_id ? { ...m, disabled: !disabled } : m)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed")
    }
  }

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
        body: JSON.stringify({ email, member_status: status, password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Invite failed")
      setSubmitMsg("Membre ajouté avec succès")
      setEmail("")
      setStatus("agent")
      setPassword("")
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Invite failed"
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell title="Membres">
      {role === "business_members" && memberStatus === "agent" ? (
        <p className="text-sm text-muted-foreground">Accès interdit.</p>
      ) : (
        <div className="mb-4 flex items-center justify-end gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button disabled={atMemberLimit}>Ajouter un membre</Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Ajouter un membre</SheetTitle>
              </SheetHeader>
              <form onSubmit={invite} className="mt-4 grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
                <Button type="submit" disabled={submitting || atMemberLimit}>
                  {submitting ? "Ajout..." : "Ajouter"}
                </Button>
                {atMemberLimit ? (
                  <a href="/settings?tab=subscription" className="text-xs text-primary underline">Mettre à niveau le plan</a>
                ) : null}
                {submitMsg ? <p className="text-green-600 text-sm">{submitMsg}</p> : null}
                {error ? <p className="text-destructive text-sm">{error}</p> : null}
              </form>
            </SheetContent>
          </Sheet>
          {atMemberLimit ? (
            <a href="/settings?tab=subscription" className="text-xs text-primary underline">Mettre à niveau</a>
          ) : null}
        </div>
      )}
      {role === "business_members" && memberStatus === "agent" ? null : (
      <div>
        {loading ? (
          <Loader />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun membre.</p>
        ) : (
          <div className="grid gap-3">
            {items.map((m) => (
              <Card key={m.user_id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{m.full_name}</div>
                      {m.disabled ? (
                        <span className="bg-destructive/15 text-destructive rounded px-2 py-0.5 text-[11px]">Désactivé</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.role} · {m.member_status}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(m.created_at).toLocaleDateString()}</span>
                    {role && !(role === "business_members" && memberStatus === "agent") ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px]">Actif</span>
                        <Switch
                          checked={!m.disabled}
                          onCheckedChange={(v) => {
                            if (!v) {
                              const ok = window.confirm("Désactiver ce membre ? Il ne pourra plus se connecter.")
                              if (!ok) return
                            }
                            toggleAccess(m.user_id, m.disabled)
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      )}
    </DashboardShell>
  )
}
