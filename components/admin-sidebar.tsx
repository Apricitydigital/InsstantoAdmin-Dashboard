"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, Bot, Calendar, ChevronDown, ChevronRight, CreditCard, LayoutDashboard, Loader2, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, ShieldCheck, ShoppingBag, Ticket, User, UserCheck, Users, Wrench, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, permissions: ["dashboard:view"] },
  { name: "Customers", href: "/customers", icon: Users, permissions: ["customers:view", "customers:view_limited"] },
  { name: "Partners", href: "/partners", icon: UserCheck, permissions: ["partners:view", "partners:manage"] },
  { name: "Bookings", href: "/bookings", icon: Calendar, permissions: ["bookings:view"] },
  { name: "Payments", href: "/payments", icon: CreditCard, permissions: ["payments:view"] },
  { name: "Coupons & offers", href: "/coupons", icon: Ticket, permissions: ["coupons:view"] },
  { name: "Services & coverage", href: "/services", icon: Wrench, permissions: ["services:view"] },
  { name: "Complaints & support", href: "/support", icon: MessageSquare, permissions: ["complaints:view"] },
  { name: "AI data assistant", href: "/chatbot", icon: Bot, permissions: ["chatbot:view"] },
  { name: "Store", href: "/store", icon: ShoppingBag, permissions: ["store:view"] },
  {
    name: "Analytics", href: "/analytics", icon: BarChart3, permissions: ["analytics:view"],
    children: [
      { name: "Revenue", href: "/analytics/revenue" },
      { name: "Operations", href: "/analytics/operations" },
      { name: "Service performance", href: "/analytics/service-performance" },
      { name: "Marketing", href: "/analytics/marketing" },
    ],
  },
  { name: "Role management", href: "/roles", icon: ShieldCheck, superadminOnly: true },
]

interface SidebarProps { className?: string }

export function AdminSidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, hasPermission } = useAuth()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [isHovered, setIsHovered] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const prefetchedRoutes = useRef(new Set<string>())

  const visibleNavigation = navigation.filter((item) => {
    if (item.superadminOnly) return user?.role === "superadmin"
    return user?.role === "superadmin" || item.permissions?.some((permission) => hasPermission(permission))
  })
  const homeHref = visibleNavigation[0]?.href || "/"
  const isItemActive = (item: (typeof navigation)[number]) =>
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ||
    Boolean(item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)))

  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin_sidebar_collapsed")
      if (saved != null) setIsCollapsed(saved === "1")
    } catch {}
  }, [])

  useEffect(() => {
    const activeParent = navigation.find((item) => item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)))
    if (activeParent) setExpandedItems((items) => items.includes(activeParent.name) ? items : [...items, activeParent.name])
  }, [pathname])

  useEffect(() => {
    setPendingPath(null)
  }, [pathname])

  const prefetchRoute = useCallback((href: string) => {
    if (href === pathname || prefetchedRoutes.current.has(href)) return
    prefetchedRoutes.current.add(href)
    router.prefetch(href)
  }, [pathname, router])

  // Warm the route payloads in small batches once the dashboard is idle. This
  // keeps sidebar navigation responsive without competing with the active page.
  useEffect(() => {
    const routes = Array.from(new Set(navigation.flatMap((item) => [item.href, ...(item.children?.map((child) => child.href) || [])])))
      .filter((href) => href !== pathname)
    let index = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let idleId: number | undefined

    const warmNext = () => {
      const href = routes[index++]
      if (!href) return
      prefetchRoute(href)
      timeoutId = setTimeout(schedule, 120)
    }
    const schedule = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(warmNext, { timeout: 1200 })
      } else {
        timeoutId = setTimeout(warmNext, 250)
      }
    }
    schedule()
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (idleId !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId)
    }
  }, [pathname, prefetchRoute])

  const beginNavigation = (href: string, onNavigate?: () => void) => {
    prefetchRoute(href)
    if (href !== pathname) setPendingPath(href)
    onNavigate?.()
  }

  const handleLogout = async () => {
    await logout()
    window.location.href = "/login"
  }

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    setIsHovered(false)
    try { localStorage.setItem("admin_sidebar_collapsed", next ? "1" : "0") } catch {}
  }

  const toggleExpanded = (name: string) => {
    setExpandedItems((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name])
  }

  const AccountFooter = ({ compact = false }: { compact?: boolean }) => (
    <div className="mt-auto shrink-0 border-t border-white/10 bg-slate-950/95 p-2.5">
      <div className={cn("flex items-center gap-3 rounded-xl bg-white/[0.05] p-2.5", compact && "justify-center px-1")} title={compact ? user?.email || "Account" : undefined}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300"><User className="h-4 w-4" /></span>
        {!compact && <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white">{user?.name || "Account"}</span><span className="block truncate text-[11px] text-slate-400">{user?.email}</span><span className="block truncate text-[11px] capitalize text-indigo-300">{user?.roleName || user?.role?.replaceAll("_", " ")}</span></span>}
      </div>
      <Button variant="ghost" className={cn("mt-1.5 w-full text-red-300 hover:bg-red-500/10 hover:text-red-200", compact ? "justify-center px-0" : "justify-start")} onClick={() => void handleLogout()} title={compact ? "Logout" : undefined}><LogOut className={cn("h-4 w-4", !compact && "mr-2")} />{!compact && "Logout"}</Button>
    </div>
  )

  const SidebarContent = ({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-300">
      <div className={cn("flex h-16 min-h-16 shrink-0 items-center border-b border-white/10", compact ? "justify-center px-2" : "px-3")}>
        <Link href={homeHref} prefetch onMouseEnter={() => prefetchRoute(homeHref)} onPointerDown={() => prefetchRoute(homeHref)} onClick={() => beginNavigation(homeHref, onNavigate)} className={cn("flex min-w-0 items-center gap-3", !compact && "flex-1")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-950/30"><Package className="h-5 w-5 text-white" /></span>
          {!compact && <span className="min-w-0"><span className="block truncate text-lg font-bold tracking-tight text-white">Insstanto</span><span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Admin console</span></span>}
        </Link>
        {!compact && !onNavigate && <Button type="button" variant="ghost" size="icon" onClick={toggleCollapse} className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white" title={isCollapsed ? "Keep sidebar expanded" : "Collapse sidebar"}>{isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</Button>}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className={cn("px-2 py-4", !compact && "px-3")}>
          {!compact && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>}
          <nav className="grid gap-1 text-sm font-medium">
            {visibleNavigation.map((item) => {
              const active = isItemActive(item)
              const expanded = expandedItems.includes(item.name)
              const hasChildren = Boolean(item.children?.length)
              return <div key={item.name}>
                <div className="flex items-center gap-1">
                  <Link href={item.href} prefetch onMouseEnter={() => prefetchRoute(item.href)} onPointerDown={() => prefetchRoute(item.href)} onClick={() => beginNavigation(item.href, onNavigate)} aria-current={active ? "page" : undefined} aria-busy={pendingPath === item.href || undefined} title={compact ? item.name : undefined} className={cn("group relative flex min-h-10 flex-1 items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white", compact ? "justify-center px-2" : "gap-3 px-3", active && "bg-indigo-500/15 text-white", pendingPath === item.href && "bg-indigo-500/20 text-white")}>{active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-indigo-400" />}<item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", active ? "text-indigo-300" : "text-slate-500 group-hover:text-slate-300")} />{!compact && <span className="truncate">{item.name}</span>}{pendingPath === item.href && <Loader2 className={cn("h-3.5 w-3.5 animate-spin text-indigo-300", compact ? "absolute right-1 top-1" : "ml-auto")} />}</Link>
                  {hasChildren && !compact && <Button type="button" variant="ghost" size="icon" onClick={() => toggleExpanded(item.name)} className="h-9 w-8 shrink-0 text-slate-500 hover:bg-white/[0.07] hover:text-white" aria-label={`${expanded ? "Collapse" : "Expand"} ${item.name}`}>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>}
                </div>
                {hasChildren && expanded && !compact && <div className="relative ml-5 mt-1 space-y-1 border-l border-white/10 pl-4">{item.children?.map((child) => { const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`); return <Link key={child.name} href={child.href} prefetch onMouseEnter={() => prefetchRoute(child.href)} onPointerDown={() => prefetchRoute(child.href)} onClick={() => beginNavigation(child.href, onNavigate)} aria-current={childActive ? "page" : undefined} aria-busy={pendingPath === child.href || undefined} className={cn("flex items-center rounded-md px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200", childActive && "bg-white/[0.07] font-medium text-indigo-300", pendingPath === child.href && "bg-white/[0.08] text-indigo-200")}>{child.name}{pendingPath === child.href && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}</Link> })}</div>}
              </div>
            })}
          </nav>
        </div>
      </ScrollArea>
      <AccountFooter compact={compact} />
    </div>
  )

  const visuallyExpanded = !isCollapsed || isHovered
  const panelWidth = visuallyExpanded ? 272 : 72
  const reservedWidth = isCollapsed ? 72 : 272

  return <>
    <div className={cn("admin-sidebar-desktop fixed left-0 top-0 z-50 hidden h-dvh border-r border-slate-800 bg-slate-950 shadow-xl transition-[width] duration-200 lg:block", className)} style={{ width: `${panelWidth}px` }} onMouseEnter={() => isCollapsed && setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <SidebarContent compact={!visuallyExpanded} />
    </div>

    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger asChild><Button variant="outline" size="icon" className="fixed left-3 top-2.5 z-50 size-9 shrink-0 border-white/10 bg-slate-900/95 p-0 text-white shadow-sm backdrop-blur hover:bg-indigo-500/20 hover:text-white lg:hidden"><Menu className="h-5 w-5" /><span className="sr-only">Open navigation menu</span></Button></SheetTrigger>
      <SheetContent side="left" className="flex w-[min(20rem,88vw)] flex-col border-slate-800 bg-slate-950 p-0 shadow-2xl"><SidebarContent onNavigate={() => setMobileOpen(false)} /></SheetContent>
    </Sheet>

    <style jsx global>{`
      @media (min-width: 1024px) {
        body {
          --admin-sidebar-width: ${reservedWidth}px;
          margin-left: ${reservedWidth}px;
          transition: margin-left 0.2s ease;
        }
      }
      @media (max-width: 1023.98px) {
        body { --admin-sidebar-width: 0px; margin-left: 0px; }
      }
    `}</style>
  </>
}
