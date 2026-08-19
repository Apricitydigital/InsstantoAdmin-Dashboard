"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Calendar,
  Package,
  Ticket,
  MessageSquare,
  Store,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Menu,
  CreditCard,
  Wrench,
  User,
  LogOut,
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Customer Management", href: "/customers", icon: Users },
  { name: "Partner Management", href: "/partners", icon: UserCheck },
  { name: "Booking & Scheduling", href: "/bookings", icon: Calendar },
  { name: "Payment Management", href: "/payments", icon: CreditCard },
  { name: "Coupons & Offers", href: "/coupons", icon: Ticket },
  { name: "Services & Coverage", href: "/services", icon: Wrench },
  { name: "Complaints & Support", href: "/support", icon: MessageSquare },
  { name: "AI Data Assistant", href: "/chatbot", icon: MessageSquare },
  { name: "Store", href: "/store", icon: Store },
  {
    name: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    children: [
      { name: "Revenue", href: "/analytics/revenue" },
      { name: "Operations", href: "/analytics/operations" },
      { name: "Service Performance", href: "/analytics/services" },
      { name: "Marketing", href: "/analytics/marketing" },
    ],
  },
]

interface SidebarProps {
  className?: string
}

export function AdminSidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [isHovered, setIsHovered] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const visibleNavigation = user?.role === "store_manager"
    ? navigation.filter((item) => item.href === "/store")
    : navigation
  const homeHref = user?.role === "store_manager" ? "/store" : "/"

  const handleLogout = async () => {
    await logout()
    window.location.href = "/login"
  }

  const AccountFooter = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="sticky bottom-0 mt-auto shrink-0 border-t bg-sidebar p-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <div className={cn("flex items-center gap-3 px-2 py-2", collapsed && "justify-center px-0")} title={collapsed ? user?.email || "Account" : undefined}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">{user?.name || "Account"}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
              <span className="block truncate text-xs capitalize text-muted-foreground">{user?.role?.replaceAll("_", " ")}</span>
            </span>
          )}
      </div>
      <Button
        variant="ghost"
        className={cn("w-full text-destructive hover:bg-destructive/10 hover:text-destructive", collapsed ? "justify-center px-0" : "justify-start")}
        onClick={() => void handleLogout()}
        title={collapsed ? "Logout" : undefined}
      >
        <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
        {!collapsed && "Logout"}
      </Button>
    </div>
  )

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin_sidebar_collapsed")
      if (saved != null) setIsCollapsed(saved === "1")
    } catch {}
  }, [])

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    )
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
    setIsHovered(false)
    try {
      localStorage.setItem("admin_sidebar_collapsed", !isCollapsed ? "1" : "0")
    } catch {}
  }

  const getSidebarWidth = () => {
    if (isCollapsed && !isHovered) return 72
    return 256
  }

  const CollapsedSidebarContent = () => (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <div className="flex h-[60px] min-h-[60px] shrink-0 items-center justify-center border-b">
        <Link href={homeHref} className="flex items-center">
          <Package className="h-6 w-6 text-primary" />
        </Link>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <nav className="grid items-start gap-1 px-2 py-3 text-sm font-medium">
          {visibleNavigation.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/") ||
              item.children?.some((child) => pathname.startsWith(child.href))

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                "flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-muted-foreground transition-all hover:bg-muted hover:text-primary",
                  isActive && "bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-r-2 border-primary"
                )}
                title={item.name}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
      <AccountFooter collapsed />
    </div>
  )

  const SidebarContent = () => (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <div className="flex h-[60px] min-h-[60px] shrink-0 items-center border-b px-4 lg:px-6">
        <Link href={homeHref} className="flex items-center gap-2 font-semibold flex-1">
          <Package className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Insstanto
          </span>
        </Link>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <nav className="grid items-start gap-1 px-2 py-3 text-sm font-medium lg:px-3">
          {visibleNavigation.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/") ||
              item.children?.some((child) => pathname.startsWith(child.href))
            const isExpanded = expandedItems.includes(item.name)
            const hasChildren = item.children && item.children.length > 0

            return (
              <div key={item.name}>
                <div className="flex items-center">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex min-h-10 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:bg-muted hover:text-primary",
                      isActive &&
                        "bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-r-2 border-primary"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.name}
                  </Link>
                  {hasChildren && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => toggleExpanded(item.name)}
                    >
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </Button>
                  )}
                </div>
                {hasChildren && isExpanded && (
                  <div className="ml-8 mt-2 space-y-1">
                    {item.children?.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={cn(
                          "block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-primary",
                          pathname === child.href &&
                            "bg-gradient-to-r from-primary/10 to-secondary/10 text-primary"
                        )}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </ScrollArea>
      <AccountFooter />
    </div>
  )

  const shouldShowExpanded = !isCollapsed || isHovered
  const sidebarWidth = getSidebarWidth()

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "admin-sidebar-desktop fixed left-0 top-0 z-50 hidden h-dvh border-r bg-sidebar transition-all duration-300 lg:block",
          className
        )}
        style={{ width: `${sidebarWidth}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {shouldShowExpanded ? <SidebarContent /> : <CollapsedSidebarContent />}
      </div>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed left-3 top-2.5 z-50 size-9 shrink-0 bg-background/95 p-0 shadow-sm backdrop-blur lg:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-[min(20rem,88vw)] flex-col p-0 shadow-xl">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <style jsx global>{`
        @media (min-width: 1024px) {
          body {
            --admin-sidebar-width: ${sidebarWidth}px;
            margin-left: ${sidebarWidth}px;
            transition: margin-left 0.3s ease;
          }
        }
        @media (max-width: 1023.98px) {
          body {
            --admin-sidebar-width: 0px;
            margin-left: 0px;
          }
        }
      `}</style>
    </>
  )
}
