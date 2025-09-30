"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseClient } from "@/lib/supabase/client"

export default function Home() {
  const router = useRouter()

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
    <div className="p-6 text-sm text-muted-foreground">Redirection...</div>
  )
}
