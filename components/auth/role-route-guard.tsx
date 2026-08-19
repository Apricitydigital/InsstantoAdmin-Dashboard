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
  const { user, isLoading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const isLogin = pathname === "/login"
  const isStoreRoute = pathname === "/store" || pathname.startsWith("/store/")
  const canAccess = Boolean(user && (
    user.role === "superadmin" ||
    user.role === "admin" ||
    (user.role === "store_manager" && isStoreRoute)
  ))

  useEffect(() => {
    if (isLoading) return
    if (!user && !isLogin) {
      router.replace("/login")
      return
    }
    if (user && isLogin) {
      router.replace(user.role === "store_manager" ? "/store" : "/")
      return
    }
    if (user?.role === "store_manager" && !isStoreRoute) router.replace("/store")
  }, [isLoading, isLogin, isStoreRoute, router, user])

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
