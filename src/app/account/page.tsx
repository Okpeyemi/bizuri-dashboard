"use client"

import { useEffect, useRef, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"
import { useTranslations } from "next-intl"

export default function AccountPage() {
  const t = useTranslations("Account")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [companyLogoUrl, setCompanyLogoUrl] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        if (!token) throw new Error("Not authenticated")
        const res = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load account")
        if (!mounted) return
        setEmail(json.user?.email || "")
        setFullName(json.user?.metadata?.full_name || "")
        setCompanyName(json.user?.metadata?.company_name || "")
        setCompanyLogoUrl(json.user?.metadata?.company_logo_url || "")
        setAvatarUrl(json.user?.metadata?.avatar_url || "")
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load account")
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  async function uploadAvatar(file: File) {
    try {
      setUploading(true)
      setError(null)
      setSuccess(null)
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/account/avatar", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Upload failed")
      setAvatarUrl(json.avatar_url || "")
      setSuccess(t("profileUpdated"))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function changePassword() {
    try {
      setPwdMsg(null)
      if (newPassword.length < 8) {
        setPwdMsg(t("passwordAtLeast8"))
        return
      }
      if (newPassword !== confirmPassword) {
        setPwdMsg(t("passwordsMismatch"))
        return
      }
      const { error } = await supabaseClient.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwdMsg(t("passwordUpdated"))
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: unknown) {
      setPwdMsg(e instanceof Error ? e.message : t("passwordUpdateFailed"))
    }
  }

  async function save() {
    try {
      setSaving(true)
      setSuccess(null)
      setError(null)
      const { data: session } = await supabaseClient.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error("Not authenticated")
      const res = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ full_name: fullName, company_name: companyName, company_logo_url: companyLogoUrl }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Save failed")
      setSuccess(t("profileUpdated"))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell title={t("title")}>
      <Card className="w-full mx-auto p-4">
        {loading ? (
          <Loader />
        ) : (
          <div className="grid gap-4 grid-cols-1">
            <div className="grid gap-2">
              <Label>{t("avatar")}</Label>
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={t("avatar")} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="bg-muted h-12 w-12 rounded-full" />
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void uploadAvatar(f)
                      if (fileRef.current) fileRef.current.value = ""
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? t("loading") : t("changeAvatar")}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" value={email} readOnly disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="full_name">{t("fullName")}</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company_name">{t("companyName")}</Label>
              <Input id="company_name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving}>{saving ? t("saving") : t("save")}</Button>
              {success ? <span className="text-green-600 text-sm">{success}</span> : null}
              {error ? <span className="text-destructive text-sm">{error}</span> : null}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold">{t("changePassword")}</h3>
              <div className="mt-3 grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="new_password">{t("newPassword")}</Label>
                  <div className="flex items-center gap-2">
                    <Input id="new_password" type={showPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <Button type="button" variant="outline" onClick={() => setShowPw((s) => !s)}>
                      {showPw ? t("hide") : t("show")}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm_password">{t("confirmPassword")}</Label>
                  <div className="flex items-center gap-2">
                    <Input id="confirm_password" type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    <Button type="button" variant="outline" onClick={() => setShowConfirm((s) => !s)}>
                      {showConfirm ? t("hide") : t("show")}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={changePassword}>{t("changePasswordButton")}</Button>
                  {pwdMsg ? <span className="text-xs text-muted-foreground">{pwdMsg}</span> : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </DashboardShell>
  )
}
