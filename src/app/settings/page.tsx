"use client"
import { useEffect, useRef, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { supabaseClient } from "@/lib/supabase/client"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader } from "@/components/ui/loader"
import { useTranslations } from "next-intl"

function SettingsContent() {
  const t = useTranslations("Settings")
  const [timezone, setTimezone] = useState<string | "">("")
  const [language, setLanguage] = useState<string | "">("")
  const [notifications, setNotifications] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [role, setRole] = useState<string | null>(null)
  const [memberStatus, setMemberStatus] = useState<"agent" | "manager" | null>(null)
  const [plan, setPlan] = useState<"freemium" | "premium" | "vip">("freemium")
  const [limits, setLimits] = useState<{ maxClients: number | null; maxCampaignsPerMonth: number | null; maxMembers: number | null } | null>(null)
  const [usage, setUsage] = useState<{ clients: number; members: number; campaigns_month: number } | null>(null)

  const [savingPlan, setSavingPlan] = useState(false)
  const [companyLogoUrl, setCompanyLogoUrl] = useState("")
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // useSearchParams must be inside a Suspense boundary
  const searchParams = useSearchParams()
  const defaultTab = (searchParams.get("tab") as "general" | "subscription" | "company" | null) || "general"

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        if (!token) throw new Error("Not authenticated")
        // Load settings
        const res = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load settings")
        if (!mounted) return
        setTimezone((json.data?.timezone as string) || "")
        setLanguage((json.data?.language as string) || "")
        setNotifications((json.data?.notifications_enabled as boolean) ?? true)

        // Load role, logo, and subscription
        const { data: user } = await supabaseClient.auth.getUser()
        const meta = user.user?.user_metadata as Record<string, unknown> | undefined
        const r = meta && typeof meta["role"] === "string" ? (meta["role"] as string) : undefined
        const cl = meta && typeof meta["company_logo_url"] === "string" ? (meta["company_logo_url"] as string) : undefined
        setRole(r || null)
        setCompanyLogoUrl(cl || "")
        // precise member_status from API
        try {
          const accRes = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } })
          const accJson = await accRes.json()
          if (accRes.ok) setMemberStatus((accJson?.profile?.member_status as "agent" | "manager" | null) || null)
        } catch {}
        const resSub = await fetch("/api/subscription", { headers: { Authorization: `Bearer ${token}` } })
        const jsonSub = await resSub.json()
        if (resSub.ok) {
          setPlan(jsonSub.plan as typeof plan)
          setLimits(jsonSub.limits || null)
          setUsage(jsonSub.usage || null)
        }
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
      setSuccess(t("saved"))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function savePlan() {
    try {
      setSavingPlan(true)
      setError(null)
      setSuccess(null)
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      const res = await fetch("/api/subscription", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Save failed")
      setSuccess(t("planSaved"))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSavingPlan(false)
    }
  }

  async function uploadCompanyLogo(file: File) {
    try {
      setUploadingLogo(true)
      setError(null)
      setSuccess(null)
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/company/logo", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Upload failed")
      setCompanyLogoUrl(json.company_logo_url || "")
      setSuccess("Logo mis à jour")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <DashboardShell title={t("title")}>
      <Card className="mx-auto w-full p-4">
        {loading ? (
          <Loader />
        ) : (
          <div className="grid gap-4 grid-cols-1">
            <Tabs defaultValue={defaultTab}>
              <TabsList className="w-full">
                <TabsTrigger value="general" className="flex-1">{t("tabs.general")}</TabsTrigger>
                <TabsTrigger value="subscription" className="flex-1">{t("tabs.subscription")}</TabsTrigger>
                <TabsTrigger value="company" className="flex-1">{t("tabs.company")}</TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="timezone">{t("timezone")}</Label>
                    <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Abidjan" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="language">{t("language")}</Label>
                    <Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="fr" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="notifications" type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
                    <Label htmlFor="notifications">{t("notifications")}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={save} disabled={saving}>{saving ? t("saving") : t("save")}</Button>
                    {success ? <span className="text-green-600 text-sm">{success}</span> : null}
                    {error ? <span className="text-destructive text-sm">{error}</span> : null}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="subscription">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>{t("subscriptionPlan")}</Label>
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      <label className={`border-input hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md border p-2 text-sm ${plan === "freemium" ? "ring-2 ring-ring" : ""}`}>
                        <input type="radio" name="plan" value="freemium" checked={plan === "freemium"} onChange={() => setPlan("freemium")} /> Freemium
                      </label>
                      <label className={`border-input hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md border p-2 text-sm ${plan === "premium" ? "ring-2 ring-ring" : ""}`}>
                        <input type="radio" name="plan" value="premium" checked={plan === "premium"} onChange={() => setPlan("premium")} /> Premium
                      </label>
                      <label className={`border-input hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md border p-2 text-sm ${plan === "vip" ? "ring-2 ring-ring" : ""}`}>
                        <input type="radio" name="plan" value="vip" checked={plan === "vip"} onChange={() => setPlan("vip")} /> VIP
                      </label>
                    </div>
                    {limits ? (
                      <p className="text-xs text-muted-foreground">
                        Clients: {limits.maxClients ?? "illimité"} · Campagnes/mois: {limits.maxCampaignsPerMonth ?? "illimité"} · Membres: {limits.maxMembers ?? "illimité"}
                      </p>
                    ) : null}
                    {usage ? (
                      <p className="text-xs text-muted-foreground">
                        Utilisation (ce mois): {usage.campaigns_month} campagnes · {usage.clients} clients · {usage.members} membres
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Button onClick={savePlan} disabled={savingPlan || !(role === "super_admin" || role === "business_admin") }>
                        {savingPlan ? t("saving") : t("savePlan")}
                      </Button>
                      {role && !(role === "super_admin" || role === "business_admin") ? (
                        <span className="text-xs text-muted-foreground">{t("onlyAdmin")}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="company">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>{t("companyLogo")}</Label>
                    <div className="flex items-center gap-4">
                      {companyLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={companyLogoUrl} alt="Company logo" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="bg-muted h-12 w-12 rounded" />
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void uploadCompanyLogo(f)
                            if (fileRef.current) fileRef.current.value = ""
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploadingLogo || (role === "business_members" && memberStatus === "agent")}
                          onClick={() => fileRef.current?.click()}
                        >
                          {uploadingLogo ? t("loading") : t("changeLogo")}
                        </Button>
                        {role === "business_members" && memberStatus === "agent" ? (
                          <span className="text-xs text-muted-foreground">Seul l’administrateur peut changer le logo.</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </Card>
    </DashboardShell>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
