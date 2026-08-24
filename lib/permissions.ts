export type PermissionDefinition = {
  id: string
  label: string
  group: string
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { id: "dashboard:view", label: "View dashboard", group: "Dashboard" },
  { id: "bookings:view", label: "View bookings", group: "Bookings" },
  { id: "bookings:write", label: "Manage bookings", group: "Bookings" },
  { id: "payments:view", label: "View payments", group: "Payments" },
  { id: "payments:write", label: "Manage payments", group: "Payments" },
  { id: "customers:view_limited", label: "View customer list", group: "Customers" },
  { id: "customers:view", label: "View customer details", group: "Customers" },
  { id: "customers:write", label: "Manage customers", group: "Customers" },
  { id: "partners:view", label: "View partners", group: "Partners" },
  { id: "partners:manage", label: "Manage partners", group: "Partners" },
  { id: "services:view", label: "View services and coverage", group: "Services" },
  { id: "services:write", label: "Manage services and coverage", group: "Services" },
  { id: "complaints:view", label: "View complaints", group: "Support" },
  { id: "complaints:write", label: "Resolve complaints", group: "Support" },
  { id: "coupons:view", label: "View coupons", group: "Coupons" },
  { id: "coupons:write", label: "Manage coupons", group: "Coupons" },
  { id: "store:view", label: "View store", group: "Store" },
  { id: "store:write", label: "Manage store", group: "Store" },
  { id: "analytics:view", label: "View analytics", group: "Analytics" },
  { id: "reports:view", label: "View reports", group: "Other" },
  { id: "chatbot:view", label: "Use AI data assistant", group: "Other" },
  { id: "settings:view", label: "View settings", group: "Other" },
]

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: PERMISSION_DEFINITIONS.map((permission) => permission.id),
  admin: [
    "dashboard:view",
    "bookings:view",
    "payments:view",
    "store:view",
    "coupons:view",
    "customers:view",
    "customers:view_limited",
    "complaints:view",
    "complaints:write",
    "analytics:view",
    "partners:view",
    "services:view",
    "reports:view",
    "chatbot:view",
    "settings:view",
  ],
  store_manager: ["store:view"],
}

export function normalizePermissions(permissions: string[]) {
  const normalized = new Set(permissions)
  for (const permission of permissions) {
    if (permission.endsWith(":write")) normalized.add(permission.replace(/:write$/, ":view"))
  }
  if (normalized.has("partners:manage")) normalized.add("partners:view")
  if (normalized.has("customers:view") || normalized.has("customers:write")) {
    normalized.add("customers:view_limited")
  }
  return [...normalized]
}
