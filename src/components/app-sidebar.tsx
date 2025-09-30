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

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { supabaseClient } from "@/lib/supabase/client"

// Navigation data
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, isActive: true },
    { title: "Campagnes", url: "/campagnes", icon: Megaphone },
    { title: "Clients", url: "/clients", icon: Users },
    { title: "Membres", url: "/membres", icon: UserCog },
    { title: "Settings", url: "/settings", icon: Settings2 },
    { title: "Telegram Bot", url: "/telegram-bot", icon: Bot },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [currentUser, setCurrentUser] = React.useState<{ name: string; email: string; avatar: string }>(
    data.user
  )

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
        <NavUser user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
