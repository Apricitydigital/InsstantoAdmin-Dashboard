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
  ],
  admin: [
    "bookings:view",
    "bookings:write",
    "payments:view",
    "store:view",
    "coupons:view",
    "customers:view",
    "complaints:view",
    "analytics:view",
    "partners:manage",
  ],
  store_manager: ["store:view", "store:write"],
  accounts_manager: ["payments:view", "payments:write", "bookings:view", "bookings:write"],
  marketing_manager: ["coupons:view", "bookings:view", "customers:view_limited", "complaints:view"],
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

        const userSnap = await getDoc(doc(db, "users", fbUser.uid))
        const roleId = (userSnap.exists() && (userSnap.data().roleId as string)) || "admin"
        const displayName =
          (userSnap.exists() && (userSnap.data().name as string)) ||
          fbUser.displayName ||
          fbUser.email?.split("@")[0] ||
          "User"

        let permissions: string[] = []
        const roleSnap = await getDoc(doc(db, "roles", roleId))
        if (roleSnap.exists()) {
          permissions = (roleSnap.data().permissions as string[]) || []
        } else {
          permissions = DEFAULT_ROLE_PERMISSIONS[roleId] || []
        }

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
      // onAuthStateChanged will hydrate the user
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    const auth = getFirebaseAuth()
    await signOut(auth)
    setUser(null)
  }

  const hasPermission = (permission: string): boolean => {
    if (!user) return false
    // superadmin/admin bypass checks
    if (user.role === "superadmin" || user.role === "admin") return true
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
