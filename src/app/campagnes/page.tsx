"use client"
import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { DashboardShell } from "@/components/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import Image from "next/image"

type Campaign = {
  id: string
  name: string
  description: string | null
  status: string
  image_url: string | null
  starts_at: string | null
  ends_at: string | null
  promotion_type: string | null
  promotion_value: number | null
}

// Add a payload type to avoid `any`
type CreateCampaignPayload = {
  name: string
  description: string | null
  status: "draft" | "published"
  image_url: string | null
  starts_at: string | null
  ends_at: string | null
  promotion_type: "percentage" | "amount" | null
  promotion_value: number | null
}

export default function CampagnesPage() {
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "draft" as "draft" | "published",
    image_url: "",
    starts_at: "",
    ends_at: "",
    promotion_type: "percentage" as "percentage" | "amount",
    promotion_value: "",
  })

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        if (!token) throw new Error("Not authenticated")
        const res = await fetch("/api/campaigns", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load campaigns")
        if (!mounted) return
        setItems(json.data || [])
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load campaigns"
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

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      setSaving(true)
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      // upload image if provided
      let image_url: string | null = null
      if (file) {
        const fd = new FormData()
        fd.append("file", file)
        const up = await fetch("/api/uploads", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const upJson = await up.json()
        if (!up.ok) throw new Error(upJson?.error || "Upload failed")
        image_url = upJson.url as string
      }
      const payload: CreateCampaignPayload = {
        name: form.name,
        description: form.description || null,
        status: (form.status || "draft") as "draft" | "published",
        image_url,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        promotion_type: (form.promotion_type || null) as "percentage" | "amount" | null,
        promotion_value: form.promotion_value ? Number(form.promotion_value) : null,
      }
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Creation failed")
      // refresh list
      setOpen(false)
      setForm({ name: "", description: "", status: "draft", image_url: "", starts_at: "", ends_at: "", promotion_type: "percentage", promotion_value: "" })
      setFile(null)
      // refetch
      const ref = await fetch("/api/campaigns", { headers: { Authorization: `Bearer ${token}` } })
      const refJson = await ref.json()
      if (ref.ok) setItems(refJson.data || [])
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Creation failed"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(id: string, next: boolean) {
    try {
      setTogglingId(id)
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      const res = await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status: next ? "published" : "draft" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Update failed")
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status: next ? "published" : "draft" } : c)))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Update failed"
      setError(message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <DashboardShell title="Campagnes">
      <div className="mb-4 flex items-center justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>Créer une campagne</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Créer une campagne</SheetTitle>
            </SheetHeader>
            <form onSubmit={createCampaign} className="p-4 grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="name">Nom</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Statut</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.status === "published"}
                    onCheckedChange={(v) => setForm({ ...form, status: v ? "published" : "draft" })}
                  />
                  <span className="text-sm text-muted-foreground">{form.status}</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="image">Image</Label>
                <Input id="image" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="starts_at">Début</Label>
                  <Input id="starts_at" type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ends_at">Fin</Label>
                  <Input id="ends_at" type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="promotion_type">Type de promotion</Label>
                  <select
                    id="promotion_type"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={form.promotion_type}
                    onChange={(e) => setForm({ ...form, promotion_type: e.target.value as "percentage" | "amount" })}
                  >
                    <option value="percentage">Pourcentage</option>
                    <option value="amount">Montant</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="promotion_value">Valeur</Label>
                  <Input id="promotion_value" type="number" value={form.promotion_value} onChange={(e) => setForm({ ...form, promotion_value: e.target.value })} />
                </div>
              </div>
              <div>
                <Button type="submit" disabled={saving}>{saving ? "Création..." : "Créer"}</Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune campagne.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-medium">{c.name}</h3>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={c.status === "published"}
                    onCheckedChange={(v) => toggleStatus(c.id, v)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {togglingId === c.id ? "..." : c.status}
                  </span>
                </div>
              </div>
              {c.image_url ? (
                <Image
                  src={c.image_url}
                  alt={c.name}
                  width={640}
                  height={320}
                  unoptimized
                  className="mt-3 h-40 w-full rounded-md object-cover"
                />
              ) : null}
              <p className="text-muted-foreground mt-3 text-sm">{c.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Début:</span> {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "-"}
                </div>
                <div>
                  <span className="font-medium">Fin:</span> {c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "-"}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Promotion:</span> {c.promotion_type || "-"}
                  {c.promotion_value != null ? ` (${c.promotion_value})` : ""}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}
