"use client"
import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, ExternalLink } from "lucide-react"
import { useTranslations } from "next-intl"

export default function TelegramBotPage() {
  const t = useTranslations("Telegram")
  const [botToken, setBotToken] = useState("")
  const [show, setShow] = useState(false)
  const [, setLoading] = useState(true) // ignore unused state value
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [startMessage, setStartMessage] = useState("")
  const [stopMessage, setStopMessage] = useState("")
  const [botName, setBotName] = useState<string | null>(null)
  const [botUsername, setBotUsername] = useState<string | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        if (!token) throw new Error("Not authenticated")
        const res = await fetch("/api/telegram", { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load bot settings")
        if (!mounted) return
        setBotToken(json.data?.bot_token || "")
        setStartMessage(json.data?.start_message || "")
        setStopMessage(json.data?.stop_message || "")
        setBotName(json.data?.bot_name || null)
        setBotUsername(json.data?.bot_username || null)
        setDeepLink(json.data?.deep_link || null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load bot settings")
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
      const res = await fetch("/api/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bot_token: botToken, start_message: startMessage, stop_message: stopMessage }),
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

  async function handleDownloadQr() {
    try {
      if (!deepLink) return
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=${encodeURIComponent(deepLink)}`
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement("a")
      const objUrl = URL.createObjectURL(blob)
      a.href = objUrl
      a.download = `telegram-${botUsername || "bot"}-qr.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
    } catch {}
  }

  return (
    <DashboardShell title={t("title")}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("configureBot")}</h3>
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="text-sm underline underline-offset-4"
            >
              {t("openBotFather")} <ExternalLink className="ml-1 inline size-3" />
            </a>
          </div>
          <div className="mt-4 grid gap-3">
            {botName || botUsername ? (
              <div className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{botName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{botUsername ? `@${botUsername}` : ""}</div>
                  </div>
                  {deepLink ? (
                    <a href={deepLink} target="_blank" rel="noreferrer" className="text-xs underline">
                      {t("openBot")}
                    </a>
                  ) : null}
                </div>
                {deepLink ? (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(deepLink)}`}
                      alt="QR"
                      className="h-24 w-24 rounded bg-white p-1"
                    />
                    <Button type="button" onClick={handleDownloadQr}>
                      {t("downloadQr")}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Label htmlFor="bot-token">Token</Label>
            <div className="flex items-center gap-2">
              <Input
                id="bot-token"
                type={show ? "text" : "password"}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="start-message">{t("startMessage")}</Label>
              <textarea
                id="start-message"
                className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                value={startMessage}
                onChange={(e) => setStartMessage(e.target.value)}
                placeholder={t("startPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stop-message">{t("stopMessage")}</Label>
              <textarea
                id="stop-message"
                className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                value={stopMessage}
                onChange={(e) => setStopMessage(e.target.value)}
                placeholder={t("stopPlaceholder")}
              />
            </div>
            <div>
              <Button onClick={save} disabled={saving}>
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            {success ? <p className="text-green-600 text-sm">{success}</p> : null}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold">{t("commands")}</h3>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <ul className="list-inside list-disc">
              <li><code>/start</code> — démarrer l’interaction</li>
              <li><code>/newbot</code> — créer un nouveau bot</li>
              <li><code>/mybots</code> — modifiez votre bot</li>
              <li><code>/setname</code> — changez le nom de votre bot</li>
              <li><code>/setdescription</code> — changez la description de votre bot</li>
              <li><code>/setabouttext</code> — changez l’about info de votre bot</li>
              <li><code>/setuserpic</code> — changez la photo de votre bot</li>
              <li><code>/setcommands</code> — changez la liste des commandes</li>
              <li><code>/deletebot</code> — supprimez votre bot</li>
              <li><code>/help</code> — aide</li>
              <li><code>/stop</code> — arrêter les notifications</li>
            </ul>
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}
