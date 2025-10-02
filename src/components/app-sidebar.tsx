"use client"

import * as React from "react"
import {
  Bot,
  GalleryVerticalEnd,
  Settings2,
  LayoutDashboard,
  Megaphone,
  Users,
  UserCog,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { supabaseClient } from "@/lib/supabase/client"

// Base navigation
const baseNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, isActive: true },
  { title: "Campagnes", url: "/campagnes", icon: Megaphone },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Membres", url: "/membres", icon: UserCog },
  { title: "Settings", url: "/settings", icon: Settings2 },
  { title: "Telegram Bot", url: "/telegram-bot", icon: Bot },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [currentUser, setCurrentUser] = React.useState<{ name: string; email: string; avatar: string }>(
    { name: "User", email: "", avatar: "/avatars/shadcn.jpg" }
  )
  const [company, setCompany] = React.useState<{ name: string; logoUrl?: string }>({ name: "Company" })
  const [role, setRole] = React.useState<string | null>(null)
  const [navItems, setNavItems] = React.useState(baseNav)
  const [planInfo, setPlanInfo] = React.useState<{
    plan: "freemium" | "premium" | "vip" | null
    membersRemaining: number | null
    campaignsRemaining: number | null
  }>({ plan: null, membersRemaining: null, campaignsRemaining: null })

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: auth } = await supabaseClient.auth.getUser()
      const u = auth.user
      if (!mounted || !u) return
      const meta = u.user_metadata as Record<string, unknown> | null
      const fullName =
        meta && typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : undefined
      const companyName = meta && typeof meta["company_name"] === "string" ? (meta["company_name"] as string) : undefined
      const companyLogoUrl = meta && typeof meta["company_logo_url"] === "string" ? (meta["company_logo_url"] as string) : undefined
      const avatarUrl = meta && typeof meta["avatar_url"] === "string" ? (meta["avatar_url"] as string) : undefined
      const r = meta && typeof meta["role"] === "string" ? (meta["role"] as string) : null
      setCurrentUser({
        name: fullName || u.email?.split("@")[0] || "User",
        email: u.email || "",
        avatar: avatarUrl || "/avatars/shadcn.jpg",
      })
      setCompany({ name: companyName || "Company", logoUrl: companyLogoUrl || undefined })
      setRole(r)

      // subscription info
      try {
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        let memberStatus: string | null = null
        if (token) {
          // load member_status for precise gating
          try {
            const accRes = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } })
            const accJson = await accRes.json()
            if (accRes.ok) {
              memberStatus = accJson?.profile?.member_status || null
              // Prefer canonical company name from DB
              if (accJson?.company?.name) {
                setCompany((prev) => ({ ...prev, name: accJson.company.name }))
              }
            }
          } catch {}

          // shared company logo (if any member uploaded it)
          try {
            const logoRes = await fetch("/api/company/logo", { headers: { Authorization: `Bearer ${token}` } })
            const logoJson = await logoRes.json()
            if (logoRes.ok && logoJson?.company_logo_url) {
              setCompany((prev) => ({ ...prev, logoUrl: logoJson.company_logo_url }))
            }
          } catch {}

          const res = await fetch("/api/subscription", { headers: { Authorization: `Bearer ${token}` } })
          const json = await res.json()
          if (res.ok) {
            const plan = json.plan as "freemium" | "premium" | "vip"
            const limits = json.limits || {}
            const usage = json.usage || {}
            const membersRemaining = limits.maxMembers == null ? null : Math.max(0, (limits.maxMembers as number) - (usage.members as number || 0))
            const campaignsRemaining = limits.maxCampaignsPerMonth == null ? null : Math.max(0, (limits.maxCampaignsPerMonth as number) - (usage.campaigns_month as number || 0))
            setPlanInfo({ plan, membersRemaining, campaignsRemaining })
          }
        }
      } catch {}

      // role-based nav
      let items = [...baseNav]
      try {
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        let memberStatus: string | null = null
        if (token) {
          const accRes = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } })
          const accJson = await accRes.json()
          if (accRes.ok) memberStatus = accJson?.profile?.member_status || null
        }
        if (r === "business_members" && memberStatus === "agent") {
          items = items.filter((i) => i.url !== "/membres")
        }
      } catch {}
      if (r === "super_admin") {
        // Add Business and Logs pages
        const hasBusiness = items.some((i) => i.url === "/business")
        if (!hasBusiness) items.splice(1, 0, { title: "Business", url: "/business", icon: GalleryVerticalEnd })
        const hasLogs = items.some((i) => i.url === "/logs")
        if (!hasLogs) items.splice(2, 0, { title: "Logs", url: "/logs", icon: Settings2 })
      }
      setNavItems(items)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* Bizuri brand */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-sm font-semibold text-primary">Bizuri</span>
        </div>
        {/* Company display (no dropdown) */}
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg overflow-hidden">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold">
                {company.name?.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{company.name}</span>
            <span className="truncate text-xs">Organisation</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        {/* Plan info and upgrade */}
        <div className="px-2 py-2 text-xs text-muted-foreground">
          {planInfo.plan ? (
            <div className="mb-2">
              <div>Plan: <span className="font-medium">{planInfo.plan}</span></div>
              <div>
                Membres restants: {planInfo.membersRemaining == null ? "∞" : planInfo.membersRemaining} · Campagnes restantes: {planInfo.campaignsRemaining == null ? "∞" : planInfo.campaignsRemaining}
              </div>
              <a href="/settings?tab=subscription" className="text-primary underline">Mettre à niveau</a>
            </div>
          ) : null}
        </div>
        <NavUser user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
