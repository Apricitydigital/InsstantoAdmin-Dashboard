"use client"

import type React from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth"

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
}

export function RoleRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, hasPermission } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const isLogin = pathname === "/login"
  const routePermissions: Array<[string, string[]]> = [
    ["/customers", ["customers:view", "customers:view_limited"]],
    ["/partners", ["partners:view", "partners:manage"]],
    ["/bookings", ["bookings:view"]],
    ["/payments", ["payments:view"]],
    ["/coupons", ["coupons:view"]],
    ["/services", ["services:view"]],
    ["/support", ["complaints:view"]],
    ["/chatbot", ["chatbot:view"]],
    ["/store", ["store:view"]],
    ["/analytics", ["analytics:view"]],
    ["/reports", ["reports:view"]],
    ["/settings", ["settings:view"]],
  ]
  const required = routePermissions.find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1]
  const hasDashboardRole = Boolean(user && user.role !== "unauthorized")
  const canAccess = Boolean(hasDashboardRole && (
    user?.role === "superadmin" ||
    (pathname === "/roles" ? false : pathname === "/" ? hasPermission("dashboard:view") : !required || required.some(hasPermission))
  ))
  const firstAllowedRoute = routePermissions.find(([, permissions]) => permissions.some(hasPermission))?.[0] || "/"

  useEffect(() => {
    if (isLoading) return
    if (!user && !isLogin) {
      router.replace("/login")
      return
    }
    if (user && isLogin) {
      router.replace(user.role === "superadmin" || hasPermission("dashboard:view") ? "/" : firstAllowedRoute)
      return
    }
  }, [firstAllowedRoute, hasPermission, isLoading, isLogin, router, user])

  if (isLoading) return <LoadingScreen />
  if (isLogin) return user ? <LoadingScreen /> : <>{children}</>
  if (!user) return <LoadingScreen />
  if (!canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div><h1 className="text-2xl font-semibold">Access denied</h1><p className="mt-2 text-muted-foreground">This account does not have a dashboard role.</p><button className="mt-4 rounded-md border px-4 py-2 text-sm" onClick={() => void logout()}>Sign out</button></div>
      </div>
    )
  }
  return <>{children}</>
}
