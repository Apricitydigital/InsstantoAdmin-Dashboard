"use client"

import type React from "react"
import { useAuth } from "@/lib/auth"

type CanProps = {
  permission?: string
  orPermissions?: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function Can({ permission, orPermissions, children, fallback = null }: CanProps) {
  const { hasPermission } = useAuth()

  const allowed =
    (permission && hasPermission(permission)) ||
    (orPermissions && orPermissions.some((item) => hasPermission(item)))

  return <>{allowed ? children : fallback}</>
}
