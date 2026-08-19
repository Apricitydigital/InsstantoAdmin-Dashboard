"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase"
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

export interface User {
  id: string
  email: string
  name?: string
  role: string
  permissions: string[]
}

export interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isLoading: boolean
  hasPermission: (permission: string) => boolean
}

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: [
    "admin:users:view",
    "admin:users:write",
    "admin:roles:view",
    "admin:roles:write",
    "bookings:view",
    "bookings:write",
    "payments:view",
    "payments:write",
    "store:view",
    "store:write",
    "coupons:view",
    "coupons:write",
    "customers:view",
    "customers:write",
    "complaints:view",
    "complaints:write",
    "analytics:view",
    "partners:manage",
    "services:view",
    "services:write",
  ],
  admin: [
    "bookings:view",
    "payments:view",
    "store:view",
    "coupons:view",
    "customers:view",
    "customers:view_limited",
    "complaints:view",
    "analytics:view",
    "partners:view",
    "services:view",
    "reports:view",
    "chatbot:view",
    "settings:view",
  ],
  store_manager: ["store:view"],
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const auth = getFirebaseAuth()
    const db = getFirestoreDb()

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setUser(null)
          return
        }

        // Ensure latest claims (important after role changes)
        try {
          await fbUser.getIdToken(true)
        } catch {}

        const tokenResult = await fbUser.getIdTokenResult()
        let profile: Record<string, unknown> = {}
        try {
          const userSnap = await getDoc(doc(db, "users", fbUser.uid))
          if (userSnap.exists()) profile = userSnap.data()
        } catch (error) {
          console.warn("[auth] could not read users profile", error)
        }

        const claimedRole = typeof tokenResult.claims.roleId === "string" ? tokenResult.claims.roleId : ""
        const profileRole = typeof profile.roleId === "string" ? profile.roleId : ""
        const roleId = (claimedRole || profileRole || "unauthorized").trim().toLowerCase()
        const displayName =
          (typeof profile.name === "string" && profile.name) ||
          fbUser.displayName ||
          fbUser.email?.split("@")[0] ||
          "User"

        const permissions = DEFAULT_ROLE_PERMISSIONS[roleId] || []

        setUser({
          id: fbUser.uid,
          email: fbUser.email || "",
          name: displayName,
          role: roleId,
          permissions,
        })
      } catch (e) {
        console.error("[auth] failed to hydrate user:", (e as Error).message)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    })

    return () => unsub()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const auth = getFirebaseAuth()
      await signInWithEmailAndPassword(auth, email, password)
      // Do not clear isLoading here. Firebase authentication completes before
      // onAuthStateChanged finishes hydrating the Firestore role/profile. The
      // observer above clears it only after setUser has completed.
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }

  const logout = async () => {
    const auth = getFirebaseAuth()
    await signOut(auth)
    setUser(null)
  }

  const hasPermission = (permission: string): boolean => {
    if (!user) return false
    if (user.role === "superadmin") return true
    if (user.role === "admin") return DEFAULT_ROLE_PERMISSIONS.admin.includes(permission)
    if (user.role === "store_manager") return permission === "store:view"
    return user.permissions.includes(permission)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasPermission }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}

// Hook for checking permissions
export function useCan(permission: string) {
  const { hasPermission } = useAuth()
  return hasPermission(permission)
}
