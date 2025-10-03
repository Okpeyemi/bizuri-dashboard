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
import { LucideIcon } from "lucide-react"

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

// Provide local data for header switcher, main nav, and projects
const data = {
  navMain: baseNav,
  projects: [] as { name: string; url: string; icon: LucideIcon }[],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [currentUser, setCurrentUser] = React.useState<{
    name: string
    email: string
    avatar: string
  } | null>(null)
  const [companyName, setCompanyName] = React.useState<string>("")
  const [companyLogoUrl, setCompanyLogoUrl] = React.useState<string>("")

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: auth } = await supabaseClient.auth.getUser()
      const u = auth.user
      if (!mounted || !u) return
      
      const meta = u.user_metadata as Record<string, unknown> | null
      const fullName =
        meta && typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : undefined
      const avatarUrl =
        meta && typeof meta["avatar_url"] === "string" ? (meta["avatar_url"] as string) : ""
      const companyNameMeta =
        meta && typeof meta["company_name"] === "string" ? (meta["company_name"] as string) : ""
      const companyLogoUrlMeta =
        meta && typeof meta["company_logo_url"] === "string"
          ? (meta["company_logo_url"] as string)
          : ""

      setCurrentUser({
        name: fullName || u.email?.split("@")[0] || "User",
        email: u.email || "",
        avatar: avatarUrl || "",
      })
      // Seed company info from metadata (will be refined by /api/account)
      setCompanyName(companyNameMeta || "")
      setCompanyLogoUrl(companyLogoUrlMeta || "")
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Remove unused variables and fix any type
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: session } = await supabaseClient.auth.getSession()
        const token = session.session?.access_token
        if (!mounted || !token) return

        const res = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const json = await res.json()

          const meta = (json?.user?.metadata || {}) as Record<string, unknown>
          const fullName =
            typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : undefined
          const avatarUrl =
            typeof meta["avatar_url"] === "string" ? (meta["avatar_url"] as string) : ""
          const companyNameApi =
            (typeof json?.company?.name === "string" && (json.company.name as string)) ||
            (typeof meta["company_name"] === "string" ? (meta["company_name"] as string) : "")
          const companyLogoUrlMeta =
            (typeof meta["company_logo_url"] === "string"
              ? (meta["company_logo_url"] as string)
              : "") || null

          setCurrentUser((prev) => ({
            name: fullName || prev?.name || "User",
            email: prev?.email || "",
            avatar: avatarUrl || prev?.avatar || "",
          }))
          setCompanyName(companyNameApi || "")
          setCompanyLogoUrl(companyLogoUrlMeta || "")
        }
      } catch {
        // Ignore errors silently
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-2">{companyLogoUrl ? (
                <img src={companyLogoUrl} alt={companyName || "Company logo"} className="size-8 rounded-lg" />
              ) : (
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
              
                <GalleryVerticalEnd className="size-4" />
            </div>
              )}
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-black">{companyName || "Entreprise"}</span>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser || { name: "User", email: "", avatar: "" }} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

