"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { AdminSidebar } from "@/components/admin-sidebar"

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      {pathname !== "/login" && <AdminSidebar />}
      {children}
    </>
  )
}
