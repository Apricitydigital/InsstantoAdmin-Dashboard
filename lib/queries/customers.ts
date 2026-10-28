"use client"

import { collection, getCountFromServer, query, Timestamp, where } from "firebase/firestore"

import { getFirestoreDb } from "@/lib/firebase"
import { fetchCustomerBookingCohorts, OVERALL_BOOKING_START_DATE } from "@/lib/queries/customer-cohorts"

export interface CustomerStats {
  totalCustomers: number
  newCustomerCount: number
  repeatCustomerCount: number
  newCustomersToday: number
}

export async function fetchCustomerStats(
  fromDate: string,
  toDate: string
): Promise<CustomerStats> {
  const db = getFirestoreDb()
  const effectiveFrom = fromDate || OVERALL_BOOKING_START_DATE
  const startDate = new Date(`${effectiveFrom}T00:00:00+05:30`)
  const endDate = toDate ? new Date(`${toDate}T23:59:59.999+05:30`) : new Date()
  const totalCustomersQuery = query(
    collection(db, "customer"),
    where("userType.customer", "==", true),
    where("created_time", ">=", Timestamp.fromDate(startDate)),
    where("created_time", "<=", Timestamp.fromDate(endDate))
  )

  const [totalSnapshot, cohorts] = await Promise.all([
    getCountFromServer(totalCustomersQuery),
    fetchCustomerBookingCohorts(effectiveFrom, toDate),
  ])

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const todaySnapshot = await getCountFromServer(query(
    collection(db, "customer"),
    where("userType.customer", "==", true),
    where("created_time", ">=", Timestamp.fromDate(todayStart)),
    where("created_time", "<=", Timestamp.fromDate(todayEnd))
  ))

  return {
    totalCustomers: totalSnapshot.data().count || 0,
    newCustomerCount: cohorts.newCustomerCount,
    repeatCustomerCount: cohorts.repeatCustomerCount,
    newCustomersToday: todaySnapshot.data().count || 0,
  }
}
