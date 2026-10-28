"use client"

import {
  fetchBookingStats,
  mapCategoryName,
  resolveBookingCategoryName,
  type CategoryName,
} from "@/lib/queries/dashboard"
import { fetchDailyOverviewSummary } from "@/lib/queries/daily-overview"
import { fetchNewVsRepeatCustomers } from "@/lib/queries/customer-insights"
import { getFirestoreDb } from "@/lib/firebase"
import { isActiveBookingStatus, isRevenueEligibleBookingStatus } from "@/lib/booking-status"
import { getOnboardedPartnerIds, getOnboardedPartnerIdSet } from "@/lib/queries/partners"
import { fetchTopCategories, type TopCategory } from "@/lib/queries/top-services"
import { collection, getDocs, query, Timestamp, where } from "firebase/firestore"

const INTERNAL_CUSTOMER_ID = "aZ0kM3TQB1TuDq52bS7AEeVWQ6V2"

export type RevenuePoint = {
  month: string
  revenue: number
  netRevenue: number
  bookings: number
  growth: number | null
}

export type OperationalAnalytics = {
  onboardedPartners: number
  completedBookings: number
  completionRate: number
  customerSatisfaction: number
  totalRatings: number
  repeatCustomerRate: number
  cancellationRate: number
}

export type MarketingAnalytics = {
  customerSignUps: number
  acquiredCustomers: number
  customerAcquisitionCost: number | null
}

export type DailyWhatsAppReport = {
  totalBookings: number
  cancelledBookings: number
  totalBookingAmount: number
  netProfit: number
  marginPercentage: number
  avgOrderValue: number
  customerAcquisitionCost: number
  cleaning: number
  electrical: number
  security: number
  driver: number
  maid: number
  totalComplaints: number
  resolvedComplaints: number
}

function normalizedText(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_")
}

function getIndiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function isPartnerCancelledBooking(booking: Record<string, any>) {
  const status = normalizedText(booking.status)
  if (status.includes("partner") && (status.includes("cancelled") || status.includes("canceled"))) {
    return true
  }

  const cancellationOwner = [
    booking.cancelledBy,
    booking.cancelled_by,
    booking.canceledBy,
    booking.canceled_by,
    booking.cancellationBy,
    booking.cancellation_by,
    booking.cancelledByType,
    booking.cancelled_by_type,
  ].map(normalizedText)

  return cancellationOwner.some((value) => value.includes("partner"))
}

function isCancelledBooking(booking: Record<string, any>) {
  const status = normalizedText(booking.status)
  return status.includes("cancelled") || status.includes("canceled")
}

async function resolveReportCategory(booking: Record<string, any>): Promise<CategoryName | null> {
  const references = Array.isArray(booking.subCategoryCart_id)
    ? booking.subCategoryCart_id
    : booking.subCategoryCart_id
      ? [booking.subCategoryCart_id]
      : []

  for (const reference of references) {
    const mapped = mapCategoryName(await resolveBookingCategoryName(reference))
    if (mapped) return mapped
  }

  const directNames = [
    booking.categoryName,
    booking.category_name,
    booking.serviceCategoryName,
    booking.service_category_name,
    booking.service_name,
  ]

  for (const name of directNames) {
    const mapped = mapCategoryName(typeof name === "string" ? name : null)
    if (mapped) return mapped
  }

  return null
}

function parseDate(value: string, endOfDay = false) {
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`)
}

function monthLabel(value: Date) {
  return value.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
}

export async function fetchRevenueAnalytics(fromDate: string, toDate: string): Promise<RevenuePoint[]> {
  const rangeStart = parseDate(fromDate)
  const rangeEnd = parseDate(toDate, true)

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
    throw new Error("Select a valid analytics date range.")
  }

  const buckets: { start: Date; end: Date; label: string }[] = []
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)

  while (cursor <= rangeEnd && buckets.length < 24) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999)
    buckets.push({
      start: monthStart < rangeStart ? rangeStart : monthStart,
      end: monthEnd > rangeEnd ? rangeEnd : monthEnd,
      label: monthLabel(monthStart),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const db = getFirestoreDb()
  const onboardedPartnerIds = await getOnboardedPartnerIdSet(db)
  const bookingSnapshot = await getDocs(query(
    collection(db, "bookings"),
    where("date", ">=", Timestamp.fromDate(rangeStart)),
    where("date", "<=", Timestamp.fromDate(rangeEnd))
  ))

  const points = buckets.map((bucket) => ({
    month: bucket.label,
    revenue: 0,
    netRevenue: 0,
    bookings: 0,
    growth: null as number | null,
  }))

  bookingSnapshot.forEach((bookingDocument) => {
    const booking = bookingDocument.data()
    const providerId = booking.provider_id?.id || booking.provider_id
    const customerId = booking.customer_id?.id || booking.customer_id
    const bookingDate: Date | null = booking.date?.toDate?.() || null

    if (
      !isRevenueEligibleBookingStatus(booking.status) ||
      !onboardedPartnerIds.has(providerId) ||
      customerId === INTERNAL_CUSTOMER_ID ||
      !bookingDate
    ) return

    const index = buckets.findIndex((bucket) => bookingDate >= bucket.start && bookingDate <= bucket.end)
    if (index < 0) return

    const paid = Number(booking.amount_paid || 0)
    const wallet = Number(booking.walletAmountUsed || 0)
    const discount = Number(booking.discount_amount || 0)

    points[index].revenue += paid + wallet + discount
    points[index].netRevenue += paid
    points[index].bookings += 1
  })

  return points.map((item, index) => {
    const previousRevenue = index > 0 ? points[index - 1].revenue : 0
    const growth = index === 0 || previousRevenue === 0
      ? null
      : ((item.revenue - previousRevenue) / previousRevenue) * 100

    return {
      ...item,
      growth: growth === null ? null : Number(growth.toFixed(1)),
    }
  })
}

export async function fetchServiceAnalytics(fromDate: string, toDate: string): Promise<TopCategory[]> {
  return fetchTopCategories(fromDate, toDate)
}

export async function fetchOperationalAnalytics(
  fromDate: string,
  toDate: string
): Promise<OperationalAnalytics> {
  const [bookingStats, customerStats, partnerIds] = await Promise.all([
    fetchBookingStats(fromDate, toDate),
    fetchNewVsRepeatCustomers(fromDate, toDate),
    getOnboardedPartnerIds(),
  ])

  const retainedCustomers = customerStats.newCustomerCount + customerStats.repeatCustomerCount
  const repeatCustomerRate = retainedCustomers > 0
    ? (customerStats.repeatCustomerCount / retainedCustomers) * 100
    : 0
  const bookingAttempts = bookingStats.totalBookings + bookingStats.cancelledBookings
  const cancellationRate = bookingAttempts > 0
    ? (bookingStats.cancelledBookings / bookingAttempts) * 100
    : 0

  return {
    onboardedPartners: partnerIds.length,
    completedBookings: bookingStats.completedBookings,
    completionRate: bookingStats.completionRate,
    customerSatisfaction: customerStats.averageRating,
    totalRatings: customerStats.totalRatings,
    repeatCustomerRate: Number(repeatCustomerRate.toFixed(1)),
    cancellationRate: Number(cancellationRate.toFixed(1)),
  }
}

export async function fetchMarketingAnalytics(
  fromDate: string,
  toDate: string
): Promise<MarketingAnalytics> {
  const [bookingStats, customerStats] = await Promise.all([
    fetchBookingStats(fromDate, toDate),
    fetchNewVsRepeatCustomers(fromDate, toDate),
  ])

  return {
    customerSignUps: customerStats.totalCustomers,
    acquiredCustomers: customerStats.newCustomerCount + customerStats.repeatCustomerCount,
    customerAcquisitionCost: bookingStats.cac > 0 ? bookingStats.cac : null,
  }
}

export async function fetchDailyWhatsAppReport(): Promise<DailyWhatsAppReport> {
  const db = getFirestoreDb()
  const today = getIndiaDateKey()
  const start = Timestamp.fromDate(new Date(`${today}T00:00:00+05:30`))
  const end = Timestamp.fromDate(new Date(`${today}T23:59:59.999+05:30`))
  const [bookingSnapshot, complaintSnapshot, dailyOverview] = await Promise.all([
    getDocs(query(
      collection(db, "bookings"),
      where("date", ">=", start),
      where("date", "<=", end)
    )),
    getDocs(query(
      collection(db, "customer_complain"),
      where("date_of_complaint", ">=", start),
      where("date_of_complaint", "<=", end)
    )),
    fetchDailyOverviewSummary(),
  ])

  const reportBookings = bookingSnapshot.docs
    .map((bookingDocument) => bookingDocument.data())
    .filter((booking) => !isPartnerCancelledBooking(booking))

  const activeReportBookings = reportBookings.filter((booking) =>
    isActiveBookingStatus(booking.status)
  )

  const totalBookings = activeReportBookings.length
  const cancelledBookings = reportBookings.filter(isCancelledBooking).length
  let totalBookingAmount = 0
  let netProfit = 0
  const completedBookingsByCustomer = new Map<string, number>()

  activeReportBookings.forEach((booking) => {
    const customerId = booking.customer_id?.id || booking.customer_id || booking.customer?.id || booking.customer

    const bookingAmount = Number(booking.totalservice_price || 0) + Number(booking.taxAmount || booking.tax_amount || 0)
    const partnerFare = Number(booking.partner_fare || 0)
    const partnerPayout = partnerFare - partnerFare * 0.06
    const grossRevenue = bookingAmount - partnerPayout
    const deductions = partnerPayout * 0.0236 + bookingAmount * 0.0236 + bookingAmount * 0.05

    totalBookingAmount += bookingAmount
    netProfit += grossRevenue - deductions

    if (booking.status === "Service_Completed" && customerId) {
      const key = String(customerId)
      completedBookingsByCustomer.set(key, (completedBookingsByCustomer.get(key) || 0) + 1)
    }
  })

  const categoryCounts: Record<CategoryName, number> = {
    Cleaning: 0,
    Electrical: 0,
    Security: 0,
    Driver: 0,
    Maid: 0,
  }
  const resolvedCategories = await Promise.all(activeReportBookings.map(resolveReportCategory))
  resolvedCategories.forEach((category) => {
    if (category) categoryCounts[category] += 1
  })

  const newCustomers = [...completedBookingsByCustomer.values()].filter((count) => count === 1).length
  const customerAcquisitionCost = newCustomers > 0
    ? dailyOverview.dailyAverageExpense / newCustomers
    : dailyOverview.dailyAverageExpense

  let resolvedComplaints = 0
  complaintSnapshot.forEach((complaintDocument) => {
    if (String(complaintDocument.data().complaint_status || "").toLowerCase() === "resolved") {
      resolvedComplaints += 1
    }
  })

  return {
    totalBookings,
    cancelledBookings,
    totalBookingAmount: Number(totalBookingAmount.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    marginPercentage: totalBookingAmount > 0 ? Number(((netProfit / totalBookingAmount) * 100).toFixed(2)) : 0,
    avgOrderValue: totalBookings > 0 ? Number((totalBookingAmount / totalBookings).toFixed(2)) : 0,
    customerAcquisitionCost: Number(customerAcquisitionCost.toFixed(2)),
    cleaning: categoryCounts.Cleaning,
    electrical: categoryCounts.Electrical,
    security: categoryCounts.Security,
    driver: categoryCounts.Driver,
    maid: categoryCounts.Maid,
    totalComplaints: complaintSnapshot.size,
    resolvedComplaints,
  }
}
