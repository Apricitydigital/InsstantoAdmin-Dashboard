export type CustomerNavigationPreview = {
  id: string
  uid?: string
  displayName?: string
  email?: string
  phone?: string
  photoUrl?: string
  subscription?: string
  referralCode?: string
  createdTimeMs?: number
}

const cacheKey = (customerId: string) => `customer-navigation-preview:${customerId}`

export function cacheCustomerNavigationPreview(preview: CustomerNavigationPreview) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(cacheKey(preview.id), JSON.stringify(preview))
  } catch {
    // Navigation must continue even when browser storage is unavailable.
  }
}

export function readCustomerNavigationPreview(customerId: string): CustomerNavigationPreview | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.sessionStorage.getItem(cacheKey(customerId))
    return value ? JSON.parse(value) as CustomerNavigationPreview : null
  } catch {
    return null
  }
}
