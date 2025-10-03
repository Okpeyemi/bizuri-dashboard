"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseClient } from "@/lib/supabase/client"
import { useTranslations } from "next-intl"

export default function Home() {
  const router = useRouter()
  const t = useTranslations("Home")

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabaseClient.auth.getSession()
      if (!mounted) return
      if (data.session) router.replace("/dashboard")
      else router.replace("/login")
    })()
    return () => {
      mounted = false
    }
  }, [router])

  return (
    <div className="p-6 text-sm text-muted-foreground">{t("redirecting")}</div>
  )
}
