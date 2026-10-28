"use client"

import { collection, getDocs, query, Timestamp, where } from "firebase/firestore"

import { isActiveBookingStatus } from "@/lib/booking-status"
import { getFirestoreDb } from "@/lib/firebase"
import { getOnboardedPartnerIdSet } from "@/lib/queries/partners"

export const OVERALL_BOOKING_START_DATE = "2025-04-01"
const INTERNAL_CUSTOMER_ID = "aZ0kM3TQB1TuDq52bS7AEeVWQ6V2"

export type CustomerBookingEvent = {
  customerId: string
  date: Date
}

export type CustomerBookingCohorts = {
  newCustomerCount: number
  repeatCustomerCount: number
  isOverall: boolean
}

const startOfIndiaDay = (date: string) => new Date(`${date}T00:00:00+05:30`)
const endOfIndiaDay = (date: string) => new Date(`${date}T23:59:59.999+05:30`)

export function classifyCustomerBookingCohorts(
  events: CustomerBookingEvent[],
  fromDate: string,
  toDate: string
): CustomerBookingCohorts {
  const effectiveFrom = fromDate || OVERALL_BOOKING_START_DATE
  const rangeStart = startOfIndiaDay(effectiveFrom)
  const rangeEnd = toDate ? endOfIndiaDay(toDate) : new Date()
  const isOverall = effectiveFrom === OVERALL_BOOKING_START_DATE
  const bookingsByCustomer = new Map<string, Date[]>()

  for (const event of events) {
    if (!event.customerId || event.date < startOfIndiaDay(OVERALL_BOOKING_START_DATE) || event.date > rangeEnd) continue
    const dates = bookingsByCustomer.get(event.customerId) || []
    dates.push(event.date)
    bookingsByCustomer.set(event.customerId, dates)
  }

  let newCustomerCount = 0
  let repeatCustomerCount = 0

  for (const dates of bookingsByCustomer.values()) {
    dates.sort((first, second) => first.getTime() - second.getTime())

    if (isOverall) {
      if (dates.length === 1) newCustomerCount += 1
      else if (dates.length > 1) repeatCustomerCount += 1
      continue
    }

    if (!dates.some((date) => date >= rangeStart && date <= rangeEnd)) continue
    if (dates[0] >= rangeStart) newCustomerCount += 1
    else repeatCustomerCount += 1
  }

  return { newCustomerCount, repeatCustomerCount, isOverall }
}

export async function fetchCustomerBookingCohorts(
  fromDate: string,
  toDate: string
): Promise<CustomerBookingCohorts> {
  const db = getFirestoreDb()
  const rangeEnd = toDate ? endOfIndiaDay(toDate) : new Date()
  const [allowedProviders, bookingSnapshot] = await Promise.all([
    getOnboardedPartnerIdSet(db),
    getDocs(query(
      collection(db, "bookings"),
      where("date", ">=", Timestamp.fromDate(startOfIndiaDay(OVERALL_BOOKING_START_DATE))),
      where("date", "<=", Timestamp.fromDate(rangeEnd))
    )),
  ])

  const events: CustomerBookingEvent[] = []

  bookingSnapshot.forEach((bookingDocument) => {
    const booking = bookingDocument.data()
    if (!isActiveBookingStatus(booking.status)) return

    const providerId = booking.provider_id?.id || booking.provider_id
    const customerId = booking.customer_id?.id || booking.customer_id
    const bookingDate: Date | null = booking.date?.toDate?.() || null

    if (!allowedProviders.has(providerId) || !customerId || customerId === INTERNAL_CUSTOMER_ID || !bookingDate) return
    events.push({ customerId: String(customerId), date: bookingDate })
  })

  return classifyCustomerBookingCohorts(events, fromDate, toDate)
}
