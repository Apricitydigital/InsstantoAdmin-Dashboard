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
  const { permissions } = useAuth()

  const allowed =
    (permission && permissions.includes(permission)) ||
    (orPermissions && orPermissions.some((p) => permissions.includes(p)))

  return <>{allowed ? children : fallback}</>
}
