import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { DEFAULT_ROLE_PERMISSIONS, normalizePermissions } from "@/lib/permissions"

export type ManagedRole = {
  id: string
  name: string
  description: string
  permissions: string[]
  system: boolean
}

export type ManagedUser = {
  id: string
  name: string
  email: string
  roleId: string
}

const SYSTEM_ROLE_NAMES: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  store_manager: "Store Manager",
}

export async function fetchRoleManagementData(): Promise<{ roles: ManagedRole[]; users: ManagedUser[] }> {
  const db = getFirestoreDb()
  const [roleSnapshot, userSnapshot] = await Promise.all([
    getDocs(collection(db, "roles")),
    getDocs(collection(db, "users")),
  ])

  const roles = new Map<string, ManagedRole>()
  for (const [id, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    roles.set(id, {
      id,
      name: SYSTEM_ROLE_NAMES[id] || id,
      description: "Built-in dashboard role",
      permissions,
      system: true,
    })
  }

  for (const snapshot of roleSnapshot.docs) {
    const data = snapshot.data()
    const storedPermissions = normalizePermissions(Array.isArray(data.permissions)
      ? data.permissions.filter((value): value is string => typeof value === "string")
      : [])
    roles.set(snapshot.id, {
      id: snapshot.id,
      name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : snapshot.id,
      description: typeof data.description === "string" ? data.description : "",
      permissions: snapshot.id in SYSTEM_ROLE_NAMES
        ? [...new Set([...(DEFAULT_ROLE_PERMISSIONS[snapshot.id] || []), ...storedPermissions])]
        : storedPermissions,
      system: snapshot.id in SYSTEM_ROLE_NAMES,
    })
  }

  const users = userSnapshot.docs.map((snapshot) => {
    const data = snapshot.data()
    return {
      id: snapshot.id,
      name: typeof data.name === "string" ? data.name : "",
      email: typeof data.email === "string" ? data.email : "",
      roleId: typeof data.roleId === "string" ? data.roleId : "",
    }
  })

  return {
    roles: [...roles.values()].sort((a, b) => Number(b.system) - Number(a.system) || a.name.localeCompare(b.name)),
    users: users.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)),
  }
}

export async function createRole(name: string, description: string, permissions: string[]) {
  if (!name.trim()) throw new Error("Enter a role name")
  await addDoc(collection(getFirestoreDb(), "roles"), {
    name: name.trim(),
    description: description.trim(),
    permissions: normalizePermissions(permissions),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateRole(roleId: string, name: string, description: string, permissions: string[]) {
  if (!roleId || roleId in SYSTEM_ROLE_NAMES) throw new Error("Built-in roles cannot be edited")
  if (!name.trim()) throw new Error("Enter a role name")
  await updateDoc(doc(getFirestoreDb(), "roles", roleId), {
    name: name.trim(),
    description: description.trim(),
    permissions: normalizePermissions(permissions),
    updatedAt: serverTimestamp(),
  })
}

export async function assignUserRole(userId: string, roleId: string) {
  if (!userId || !roleId) throw new Error("Select a user and role")
  await updateDoc(doc(getFirestoreDb(), "users", userId), {
    roleId,
    updatedAt: serverTimestamp(),
  })
}
