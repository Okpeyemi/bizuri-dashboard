"use client"

import * as React from "react"
import {
  AudioWaveform,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  LayoutDashboard,
  Megaphone,
  Users,
  UserCog,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { LucideIcon } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { NavProjects } from "@/components/nav-projects"
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
  teams: [
    { name: "Bizuri", logo: GalleryVerticalEnd, plan: "Premium" },
    { name: "Analytics", logo: PieChart, plan: "Free" },
  ],
  navMain: baseNav,
  projects: [] as { name: string; url: string; icon: LucideIcon }[],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [currentUser, setCurrentUser] = React.useState<{
    name: string
    email: string
    avatar: string
  } | null>(null)

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: auth } = await supabaseClient.auth.getUser()
      const u = auth.user
      if (!mounted || !u) return
      
      const meta = u.user_metadata as Record<string, unknown> | null
      const fullName =
        meta && typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : undefined
      
      setCurrentUser({
        name: fullName || u.email?.split("@")[0] || "User",
        email: u.email || "",
        avatar: "/avatars/shadcn.jpg",
      })
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

        // Load user role and member status - remove unused assignments
        const { data: user } = await supabaseClient.auth.getUser()
        const meta = user.user?.user_metadata as Record<string, unknown> | undefined
        // Remove: const role = meta && typeof meta["role"] === "string" ? (meta["role"] as string) : undefined

        const res = await fetch("/api/members", { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const json = await res.json()
          // Remove: const memberStatus = json.members?.find((m: any) => m.user_id === user.user?.id)?.status
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
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser || { name: "User", email: "", avatar: "/avatars/shadcn.jpg" }} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
