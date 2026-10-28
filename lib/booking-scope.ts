export const INTERNAL_CUSTOMER_ID = "aZ0kM3TQB1TuDq52bS7AEeVWQ6V2"

export function bookingReferenceId(value: unknown): string {
  if (typeof value === "string") return value.split("/").filter(Boolean).pop() || ""
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id?: unknown }).id || "")
  }
  return ""
}

export function isRealBookingRecord(
  booking: { provider_id?: unknown; customer_id?: unknown },
  onboardedPartnerIds: ReadonlySet<string>
): boolean {
  const providerId = bookingReferenceId(booking.provider_id)
  const customerId = bookingReferenceId(booking.customer_id)

  return customerId !== INTERNAL_CUSTOMER_ID &&
    (!providerId || onboardedPartnerIds.has(providerId))
}
