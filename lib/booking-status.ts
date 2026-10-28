/**
 * Booking statuses are written by several app flows and are not consistently
 * cased or separated. Revenue includes every booking that has entered the
 * booking lifecycle, except bookings whose status indicates cancellation.
 */
export function normalizeBookingStatus(status: unknown): string {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
}

export function isCancelledBookingStatus(status: unknown): boolean {
  return normalizeBookingStatus(status).includes("cancel")
}

export function isPendingBookingStatus(status: unknown): boolean {
  return normalizeBookingStatus(status) === "pending"
}

export function isAcceptedBookingStatus(status: unknown): boolean {
  const normalizedStatus = normalizeBookingStatus(status)
  return normalizedStatus === "accepted" || normalizedStatus === "confirmed"
}

export function isCompletedBookingStatus(status: unknown): boolean {
  const normalizedStatus = normalizeBookingStatus(status)
  return normalizedStatus === "completed" || normalizedStatus === "service_completed"
}

export function isActiveBookingStatus(status: unknown): boolean {
  const normalizedStatus = normalizeBookingStatus(status)
  return normalizedStatus.length > 0 && !isCancelledBookingStatus(normalizedStatus)
}

export function isRevenueEligibleBookingStatus(status: unknown): boolean {
  return isActiveBookingStatus(status)
}
