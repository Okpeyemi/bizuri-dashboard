"use client"
import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const [timezone, setTimezone] = useState<string | "">("")
  const [language, setLanguage] = useState<string | "">("")
  const [notifications, setNotifications] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        if (!token) throw new Error("Not authenticated")
        const res = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load settings")
        if (!mounted) return
        setTimezone((json.data?.timezone as string) || "")
        setLanguage((json.data?.language as string) || "")
        setNotifications((json.data?.notifications_enabled as boolean) ?? true)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load settings")
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  async function save() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ timezone, language, notifications_enabled: notifications }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Save failed")
      setSuccess("Paramètres enregistrés")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell title="Settings">
      <Card className="max-w-xl p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Abidjan" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="fr" />
            </div>
            <div className="flex items-center gap-2">
              <input id="notifications" type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
              <Label htmlFor="notifications">Notifications</Label>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
              {success ? <span className="text-green-600 text-sm">{success}</span> : null}
              {error ? <span className="text-destructive text-sm">{error}</span> : null}
            </div>
          </div>
        )}
      </Card>
    </DashboardShell>
  )
}
