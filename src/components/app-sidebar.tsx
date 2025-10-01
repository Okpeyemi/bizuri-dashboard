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

// Navigation data
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, isActive: true },
    { title: "Campagnes", url: "/campagnes", icon: Megaphone },
    { title: "Clients", url: "/clients", icon: Users },
    { title: "Membres", url: "/membres", icon: UserCog },
    { title: "Settings", url: "/settings", icon: Settings2 },
    { title: "Telegram Bot", url: "/telegram-bot", icon: Bot },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [currentUser, setCurrentUser] = React.useState<{ name: string; email: string; avatar: string }>(
    data.user
  )
  const [company, setCompany] = React.useState<{ name: string; logoUrl?: string }>({ name: "Company" })

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
      setCurrentUser({
        name: fullName || u.email?.split("@")[0] || "User",
        email: u.email || "",
        avatar: avatarUrl || "/avatars/shadcn.jpg",
      })
      setCompany({ name: companyName || "Company", logoUrl: companyLogoUrl || undefined })
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
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          <span className="text-sm font-semibold">Bizuri</span>
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
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
