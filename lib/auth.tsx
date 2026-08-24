"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase"
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { DEFAULT_ROLE_PERMISSIONS, normalizePermissions } from "@/lib/permissions"

export interface User {
  id: string
  email: string
  name?: string
  role: string
  roleName?: string
  permissions: string[]
}

export interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isLoading: boolean
  hasPermission: (permission: string) => boolean
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
        // The profile is the source of truth so assignments made in Role
        // Management take effect without waiting for custom claims to refresh.
        const rawRoleId = (profileRole || claimedRole || "unauthorized").trim()
        const normalizedRoleId = rawRoleId.toLowerCase()
        const roleId = normalizedRoleId in DEFAULT_ROLE_PERMISSIONS ? normalizedRoleId : rawRoleId
        const displayName =
          (typeof profile.name === "string" && profile.name) ||
          fbUser.displayName ||
          fbUser.email?.split("@")[0] ||
          "User"

        let permissions = DEFAULT_ROLE_PERMISSIONS[roleId] || []
        let roleName = roleId.replaceAll("_", " ")
        try {
          const roleSnap = await getDoc(doc(db, "roles", roleId))
          if (roleSnap.exists()) {
            const roleData = roleSnap.data()
            if (Array.isArray(roleData.permissions)) {
              permissions = roleData.permissions.filter((value): value is string => typeof value === "string")
            }
            if (typeof roleData.name === "string" && roleData.name.trim()) roleName = roleData.name.trim()
          }
        } catch (error) {
          console.warn("[auth] could not read role permissions", error)
        }
        // Built-in roles retain their baseline guarantees even if an older
        // role document is missing a newly introduced permission.
        if (DEFAULT_ROLE_PERMISSIONS[roleId]) {
          permissions = [...DEFAULT_ROLE_PERMISSIONS[roleId], ...permissions]
        }
        permissions = normalizePermissions(permissions)

        setUser({
          id: fbUser.uid,
          email: fbUser.email || "",
          name: displayName,
          role: roleId,
          roleName,
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
