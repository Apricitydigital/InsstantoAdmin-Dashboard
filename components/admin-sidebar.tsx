"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
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
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Customer Management", href: "/customers", icon: Users },
  { name: "Partner Management", href: "/partners", icon: UserCheck },
  { name: "Booking & Scheduling", href: "/bookings", icon: Calendar },
  { name: "Payment Management", href: "/payments", icon: CreditCard },
  { name: "Coupons & Offers", href: "/coupons", icon: Ticket },
  { name: "Complaints & Support", href: "/support", icon: MessageSquare },
  { name: "Partner Chat Bot", href: "/chatbot", icon: MessageSquare },
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
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [isHovered, setIsHovered] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

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

  // Increase the sidebar width for expanded and collapsed states
  const getSidebarWidth = () => {
    if (isCollapsed && !isHovered) return 100  // Increased collapsed width
    return 320  // Increased expanded width
  }

  const CollapsedSidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-center border-b lg:h-[60px]">
        <Link href="/" className="flex items-center">
          <Package className="h-6 w-6 text-primary" />
        </Link>
      </div>
      <ScrollArea className="flex-1">
        <nav className="grid items-start px-2 py-4 text-base font-medium">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/") ||
              item.children?.some((child) => pathname.startsWith(child.href))

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted",
                  isActive && "bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-r-2 border-primary"
                )}
                title={item.name}
              >
                <item.icon className="h-6 w-6" />
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold flex-1">
          <Package className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Insstanto
          </span>
        </Link>
      </div>
      <ScrollArea className="flex-1">
        <nav className="grid items-start px-2 py-4 text-lg font-medium lg:px-4">
          {navigation.map((item) => {
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
                      "flex flex-1 items-center gap-4 rounded-lg px-4 py-3 text-muted-foreground transition-all hover:text-primary hover:bg-muted",
                      isActive &&
                        "bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-r-2 border-primary"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
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
                          "block rounded-lg px-4 py-3 text-lg text-muted-foreground transition-all hover:text-primary hover:bg-muted",
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
    </div>
  )

  const shouldShowExpanded = !isCollapsed || isHovered
  const sidebarWidth = getSidebarWidth()

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden border-r bg-sidebar lg:block fixed left-0 top-0 z-50 h-full transition-all duration-300 shadow-xl",
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
          <Button variant="outline" size="icon" className="shrink-0 md:hidden bg-transparent">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col p-0 shadow-xl">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <style jsx global>{`
        @media (min-width: 1024px) {
          body {
            margin-left: ${sidebarWidth}px;
            transition: margin-left 0.3s ease;
          }
        }
        @media (max-width: 1023.98px) {
          body {
            margin-left: 0px;
          }
        }
      `}</style>
    </>
  )
}
