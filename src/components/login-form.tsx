"use client"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabaseClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const t = useTranslations("Auth.Login")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const email = (fd.get("email") || "").toString().trim().toLowerCase()
    const password = (fd.get("password") || "").toString()

    if (!email || !password) {
      setError(t("errorEmpty"))
      return
    }
    try {
      setLoading(true)
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      router.push("/dashboard")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("errorGeneric")
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={onSubmit} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm text-balance">{t("subtitle")}</p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" placeholder="m@example.com" required />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">{t("password")}</Label>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              {t("forgotPassword")}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Input id="password" name="password" type={showPw ? "text" : "password"} required />
            <button
              type="button"
              className="border-input hover:bg-accent hover:text-accent-foreground inline-flex h-10 w-10 items-center justify-center rounded-md border text-sm"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? t("hidePassword") : t("showPassword")}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("submitLoading") : t("submit")}
        </Button>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">{error}</p>
      ) : null}
      <div className="text-center text-sm">
        {t("noAccount")} {" "}
        <a href="/register" className="underline underline-offset-4">
          {t("signup")}
        </a>
      </div>
    </form>
  )
}
