"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseClient } from "@/lib/supabase/client"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    async function check() {
      const { data } = await supabaseClient.auth.getSession()
      if (!mounted) return
      if (!data.session) {
        router.replace("/login")
      } else {
        setChecking(false)
      }
    }
    check()
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login")
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [router])

  if (checking) {
    return <div className="p-6 text-sm text-muted-foreground">Checking session...</div>
  }
  return <>{children}</>
}
