"use client"

import {
  collection,
  doc,
  DocumentData,
  DocumentReference,
  getDoc,
  getDocs,
  limit,
  query,
  QueryDocumentSnapshot,
  Timestamp,
  where,
} from "firebase/firestore"

import { getFirestoreDb } from "@/lib/firebase"
import { PROVIDER_ID_LIST } from "@/lib/queries/partners"
import Papa from "papaparse"

// ============================================================
// TYPES
// ============================================================

export type BookingStats = {
  totalBookings: number
  totalBookingsChange: number

  pendingBookings: number
  confirmedBookings: number

  completedBookings: number
  completedBookingsChange: number

  cancelledBookings: number

  totalRevenue: number
  totalRevenueChange: number

  netRevenue: number
  netRevenueChange: number

  perOrderValue: number
  perOrderValueChange: number

  totalCustomers: number
  totalCustomersChange: number

  averageRating: number
  totalRatingsCount: number

  completionRate: number
  totalOfferAmount: number

  cac: number
  cacChange: number

  netPnL: number
}

type BookingData = DocumentData & {
  status?: string

  provider_id?: DocumentReference
  customer_id?: DocumentReference | null

  amount_paid?: number | string
  walletAmountUsed?: number | string
  discount_amount?: number | string

  subCategoryCart_id?: DocumentReference | null
}

type PnlRow = {
  month?: string
  settlements?: number | string
  expenses?: number | string
}

type CategoryName =
  | "Cleaning"
  | "Electrical"
  | "Security"
  | "Driver"

type CategoryCounts = Record<CategoryName, number>

type DateRange = {
  from: Date
  to: Date
  fromTimestamp: Timestamp
  toTimestamp: Timestamp
}

// ============================================================
// CONSTANTS
// ============================================================

const MAX_FIRESTORE_IN_VALUES = 30
const CACHE_DURATION_MS = 5 * 60 * 1000

const EXPENSE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv"

const EMPTY_CATEGORY_COUNTS: CategoryCounts = {
  Cleaning: 0,
  Electrical: 0,
  Security: 0,
  Driver: 0,
}

// ============================================================
// MODULE CACHE
// ============================================================

let expenseCache:
  | {
      createdAt: number
      data: Record<string, number>
    }
  | undefined

let expenseRequest:
  | Promise<Record<string, number>>
  | undefined

let pnlCache:
  | {
      createdAt: number
      data: PnlRow[]
    }
  | undefined

let pnlRequest: Promise<PnlRow[]> | undefined

/*
  Reuses identical Firestore document requests.

  This is especially useful when many bookings use the same
  sub-category cart or service category.
*/
const subCategoryCartCache = new Map<
  string,
  Promise<DocumentReference | null>
>()

const categoryNameCache = new Map<
  string,
  Promise<string | null>
>()

// ============================================================
// GENERAL HELPERS
// ============================================================

function toNumber(value: unknown): number {
  const converted = Number(value)

  return Number.isFinite(converted)
    ? converted
    : 0
}

function percentChange(
  current: number,
  previous: number
): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }

  return (
    ((current - previous) /
      Math.abs(previous)) *
    100
  )
}

function roundNumber(
  value: number,
  decimalPlaces = 2
): number {
  const multiplier =
    10 ** decimalPlaces

  return (
    Math.round(
      (value + Number.EPSILON) *
        multiplier
    ) / multiplier
  )
}

function chunkArray<T>(
  values: T[],
  chunkSize: number
): T[][] {
  const chunks: T[][] = []

  for (
    let index = 0;
    index < values.length;
    index += chunkSize
  ) {
    chunks.push(
      values.slice(
        index,
        index + chunkSize
      )
    )
  }

  return chunks
}

function monthKey(date: Date): string {
  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0")

  return `${year}-${month}`
}

function daysInMonth(
  year: number,
  zeroBasedMonth: number
): number {
  return new Date(
    year,
    zeroBasedMonth + 1,
    0
  ).getDate()
}

function createDateRange(
  fromDate?: string,
  toDate?: string
): DateRange {
  const now = new Date()

  const defaultFrom = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0
  )

  const defaultTo = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  )

  const parsedFrom = fromDate
    ? new Date(
        `${fromDate}T00:00:00`
      )
    : defaultFrom

  const parsedTo = toDate
    ? new Date(
        `${toDate}T23:59:59.999`
      )
    : defaultTo

  const from = Number.isNaN(
    parsedFrom.getTime()
  )
    ? defaultFrom
    : parsedFrom

  const to = Number.isNaN(
    parsedTo.getTime()
  )
    ? defaultTo
    : parsedTo

  return {
    from,
    to,
    fromTimestamp:
      Timestamp.fromDate(from),
    toTimestamp:
      Timestamp.fromDate(to),
  }
}

function createPreviousDateRange(
  currentRange: DateRange
): DateRange {
  /*
    Creates a previous comparison range with exactly the same duration.

    Example:
    Current: 1 June 00:00 through 30 June 23:59
    Previous: immediately preceding equal-length period.
  */
  const duration =
    currentRange.to.getTime() -
    currentRange.from.getTime() +
    1

  const previousTo = new Date(
    currentRange.from.getTime() - 1
  )

  const previousFrom = new Date(
    previousTo.getTime() -
      duration +
      1
  )

  return {
    from: previousFrom,
    to: previousTo,
    fromTimestamp:
      Timestamp.fromDate(
        previousFrom
      ),
    toTimestamp:
      Timestamp.fromDate(
        previousTo
      ),
  }
}

// ============================================================
// BOOKING QUERY HELPERS
// ============================================================

async function fetchBookingsForRange(
  providerReferences: DocumentReference[],
  range: DateRange
): Promise<
  QueryDocumentSnapshot<DocumentData>[]
> {
  if (
    providerReferences.length === 0
  ) {
    return []
  }

  const db = getFirestoreDb()

  const bookingsCollection =
    collection(db, "bookings")

  /*
    Firestore supports a limited number of values in an "in" query.
    Splitting provider references keeps the query safe when more partners
    are added.
  */
  const providerChunks = chunkArray(
    providerReferences,
    MAX_FIRESTORE_IN_VALUES
  )

  const snapshots =
    await Promise.all(
      providerChunks.map(
        (providerChunk) =>
          getDocs(
            query(
              bookingsCollection,

              where(
                "provider_id",
                "in",
                providerChunk
              ),

              where(
                "date",
                ">=",
                range.fromTimestamp
              ),

              where(
                "date",
                "<=",
                range.toTimestamp
              )
            )
          )
      )
    )

  /*
    A map protects against accidental duplicates when provider input
    contains repeated IDs.
  */
  const uniqueDocuments = new Map<
    string,
    QueryDocumentSnapshot<DocumentData>
  >()

  for (const snapshot of snapshots) {
    for (const bookingDocument of snapshot.docs) {
      uniqueDocuments.set(
        bookingDocument.id,
        bookingDocument
      )
    }
  }

  return [
    ...uniqueDocuments.values(),
  ]
}

async function fetchCustomerCount(
  range: DateRange
): Promise<number> {
  const db = getFirestoreDb()

  const customerSnapshot =
    await getDocs(
      query(
        collection(db, "customer"),

        where(
          "userType.customer",
          "==",
          true
        ),

        where(
          "created_time",
          ">=",
          range.fromTimestamp
        ),

        where(
          "created_time",
          "<=",
          range.toTimestamp
        )
      )
    )

  return customerSnapshot.size
}

function countCustomersWithExactlyOneCompletedBooking(
  completedBookings: BookingData[]
): number {
  const customerBookingCounts =
    new Map<string, number>()

  for (const booking of completedBookings) {
    const customerId =
      booking.customer_id?.id

    if (!customerId) {
      continue
    }

    customerBookingCounts.set(
      customerId,
      (
        customerBookingCounts.get(
          customerId
        ) || 0
      ) + 1
    )
  }

  let customerCount = 0

  for (const bookingCount of customerBookingCounts.values()) {
    if (bookingCount === 1) {
      customerCount += 1
    }
  }

  return customerCount
}

function filterBookingsByStatus(
  bookings: BookingData[],
  statuses: string[]
): BookingData[] {
  const statusSet = new Set(statuses)

  return bookings.filter(
    (booking) =>
      statusSet.has(
        booking.status || ""
      )
  )
}

function calculateRevenueData(
  completedBookings: BookingData[]
) {
  let totalRevenue = 0
  let walletOfferAmount = 0
  let discountAmount = 0

  for (const booking of completedBookings) {
    const amountPaid = toNumber(
      booking.amount_paid
    )

    const walletUsed = Math.min(
      toNumber(
        booking.walletAmountUsed
      ),
      300
    )

    const discount = toNumber(
      booking.discount_amount
    )

    totalRevenue += amountPaid
    walletOfferAmount += walletUsed
    discountAmount += discount
  }

  const totalOfferAmount =
    walletOfferAmount +
    discountAmount

  const netRevenue =
    totalRevenue -
    totalOfferAmount

  const perOrderValue =
    completedBookings.length > 0
      ? totalRevenue /
        completedBookings.length
      : 0

  return {
    totalRevenue,
    walletOfferAmount,
    discountAmount,
    totalOfferAmount,
    netRevenue,
    perOrderValue,
  }
}

// ============================================================
// EXPENSE SHEET HELPERS
// ============================================================

function parseSheetMonthToKey(
  rawValue: string,
  fallbackYear: number
): string | null {
  const value = (
    rawValue || ""
  ).trim()

  if (!value) {
    return null
  }

  if (
    /^\d{4}-\d{2}$/.test(value)
  ) {
    return value
  }

  const shortYearMatch =
    value.match(
      /^([A-Za-z]+)\s+(\d{2})$/
    )

  if (shortYearMatch) {
    const shortYear = Number(
      shortYearMatch[2]
    )

    const fullYear =
      shortYear < 50
        ? 2000 + shortYear
        : 1900 + shortYear

    const parsedDate = new Date(
      `${shortYearMatch[1]} 1, ${fullYear}`
    )

    if (
      !Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return monthKey(parsedDate)
    }
  }

  const dateWithProvidedYear =
    new Date(`${value} 1`)

  if (
    !Number.isNaN(
      dateWithProvidedYear.getTime()
    )
  ) {
    return monthKey(
      dateWithProvidedYear
    )
  }

  const dateWithFallbackYear =
    new Date(
      `${value} 1, ${fallbackYear}`
    )

  if (
    !Number.isNaN(
      dateWithFallbackYear.getTime()
    )
  ) {
    return monthKey(
      dateWithFallbackYear
    )
  }

  return null
}

function prorateExpenseByRange(
  expenseByMonth: Record<
    string,
    number
  >,
  from: Date,
  to: Date
): number {
  let totalExpense = 0

  let cursor = new Date(
    from.getFullYear(),
    from.getMonth(),
    1
  )

  while (cursor <= to) {
    const key = monthKey(cursor)

    const fullMonthExpense =
      expenseByMonth[key] || 0

    if (fullMonthExpense > 0) {
      const monthStart = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        1,
        0,
        0,
        0,
        0
      )

      const monthEnd = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )

      const overlapStart =
        from > monthStart
          ? from
          : monthStart

      const overlapEnd =
        to < monthEnd
          ? to
          : monthEnd

      if (
        overlapStart <= overlapEnd
      ) {
        const monthDays =
          daysInMonth(
            cursor.getFullYear(),
            cursor.getMonth()
          )

        const dailyExpense =
          fullMonthExpense /
          monthDays

        const overlapDays =
          Math.floor(
            (
              overlapEnd.getTime() -
              overlapStart.getTime()
            ) /
              86_400_000
          ) + 1

        totalExpense +=
          overlapDays *
          dailyExpense
      }
    }

    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      1
    )
  }

  return totalExpense
}

async function fetchExpenseByMonth(): Promise<
  Record<string, number>
> {
  const now = Date.now()

  if (
    expenseCache &&
    now - expenseCache.createdAt <
      CACHE_DURATION_MS
  ) {
    return expenseCache.data
  }

  if (expenseRequest) {
    return expenseRequest
  }

  expenseRequest = (async () => {
    const response = await fetch(
      EXPENSE_SHEET_URL
    )

    if (!response.ok) {
      throw new Error(
        `Expense sheet request failed with status ${response.status}`
      )
    }

    const sheetText =
      await response.text()

    const parsed =
      Papa.parse<
        Record<string, string>
      >(sheetText, {
        header: true,
        skipEmptyLines: true,
      })

    if (
      parsed.errors.length > 0
    ) {
      console.warn(
        "Expense CSV parsing warnings:",
        parsed.errors
      )
    }

    const rows = parsed.data

    const expenseByMonth: Record<
      string,
      number
    > = {}

    if (rows.length > 0) {
      const columns = Object.keys(
        rows[0]
      )

      const monthColumn =
        columns.find((column) =>
          column
            .toLowerCase()
            .includes("month")
        )

      const totalColumn =
        columns.find((column) =>
          column
            .toLowerCase()
            .includes("total")
        )

      if (
        monthColumn &&
        totalColumn
      ) {
        for (const row of rows) {
          const rawMonth =
            row[monthColumn]

          const rawTotal =
            row[totalColumn]

          if (
            !rawMonth ||
            !rawTotal
          ) {
            continue
          }

          const amount = toNumber(
            rawTotal
              .replace(/,/g, "")
              .replace(/[₹\s]/g, "")
          )

          if (amount <= 0) {
            continue
          }

          const key =
            parseSheetMonthToKey(
              rawMonth,
              new Date().getFullYear()
            )

          if (!key) {
            continue
          }

          expenseByMonth[key] =
            (
              expenseByMonth[key] ||
              0
            ) + amount
        }
      }
    }

    expenseCache = {
      createdAt: Date.now(),
      data: expenseByMonth,
    }

    return expenseByMonth
  })()

  try {
    return await expenseRequest
  } finally {
    expenseRequest = undefined
  }
}

// ============================================================
// PNL HELPERS
// ============================================================

async function fetchPnlRows(): Promise<
  PnlRow[]
> {
  const now = Date.now()

  if (
    pnlCache &&
    now - pnlCache.createdAt <
      CACHE_DURATION_MS
  ) {
    return pnlCache.data
  }

  if (pnlRequest) {
    return pnlRequest
  }

  pnlRequest = (async () => {
    const response = await fetch(
      "/api/pnl"
    )

    if (!response.ok) {
      throw new Error(
        `PnL request failed with status ${response.status}`
      )
    }

    const responseData =
      await response.json()

    const rows = Array.isArray(
      responseData?.data
    )
      ? responseData.data
      : []

    pnlCache = {
      createdAt: Date.now(),
      data: rows,
    }

    return rows
  })()

  try {
    return await pnlRequest
  } finally {
    pnlRequest = undefined
  }
}

function calculateNetPnl(
  pnlRows: PnlRow[],
  from: Date,
  to: Date
): number {
  let settlements = 0
  let expenses = 0

  for (const row of pnlRows) {
    if (!row.month) {
      continue
    }

    const monthDate = new Date(
      row.month
    )

    if (
      Number.isNaN(
        monthDate.getTime()
      )
    ) {
      continue
    }

    const monthStart = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      1
    )

    const monthEnd = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    )

    if (
      monthEnd >= from &&
      monthStart <= to
    ) {
      settlements += toNumber(
        row.settlements
      )

      expenses += toNumber(
        row.expenses
      )
    }
  }

  return settlements - expenses
}

// ============================================================
// MAIN BOOKING STATS
// ============================================================

export async function fetchBookingStats(
  fromDate?: string,
  toDate?: string
): Promise<BookingStats> {
  const db = getFirestoreDb()

  const currentRange =
    createDateRange(
      fromDate,
      toDate
    )

  const previousRange =
    createPreviousDateRange(
      currentRange
    )

  const uniqueProviderIds = [
    ...new Set(
      PROVIDER_ID_LIST.filter(
        Boolean
      )
    ),
  ]

  const providerReferences =
    uniqueProviderIds.map(
      (providerId) =>
        doc(
          db,
          "customer",
          providerId
        )
    )

  /*
    These requests do not depend on one another, so they run together.

    Previously, each status query waited for the previous query to finish.
  */
  const [
    currentBookingDocuments,
    previousBookingDocuments,
    currentCustomerCount,
    previousCustomerCount,
    expenseByMonth,
    pnlRows,
  ] = await Promise.all([
    fetchBookingsForRange(
      providerReferences,
      currentRange
    ),

    fetchBookingsForRange(
      providerReferences,
      previousRange
    ),

    fetchCustomerCount(
      currentRange
    ),

    fetchCustomerCount(
      previousRange
    ),

    fetchExpenseByMonth().catch(
      (error) => {
        console.error(
          "Error loading expense sheet:",
          error
        )

        return {}
      }
    ),

    fetchPnlRows().catch(
      (error) => {
        console.error(
          "Error loading PnL data:",
          error
        )

        return []
      }
    ),
  ])

  const currentBookings =
    currentBookingDocuments.map(
      (bookingDocument) =>
        bookingDocument.data() as BookingData
    )

  const previousBookings =
    previousBookingDocuments.map(
      (bookingDocument) =>
        bookingDocument.data() as BookingData
    )

  // ----------------------------------------------------------
  // CURRENT STATUS COUNTS
  // ----------------------------------------------------------

  const pendingBookings =
    filterBookingsByStatus(
      currentBookings,
      ["Pending"]
    ).length

  const confirmedBookings =
    filterBookingsByStatus(
      currentBookings,
      ["Accepted"]
    ).length

  const completedBookingData =
    filterBookingsByStatus(
      currentBookings,
      ["Service_Completed"]
    )

  /*
    Supports both cancellation status values because both forms are
    commonly present in booking data.
  */
  const cancelledBookings =
    filterBookingsByStatus(
      currentBookings,
      [
        "Booking_Cancelled",
        "Cancelled",
      ]
    ).length

  // ----------------------------------------------------------
  // PREVIOUS STATUS COUNTS
  // ----------------------------------------------------------

  const previousCompletedBookingData =
    filterBookingsByStatus(
      previousBookings,
      ["Service_Completed"]
    )

  // ----------------------------------------------------------
  // REVENUE
  // ----------------------------------------------------------

  const currentRevenue =
    calculateRevenueData(
      completedBookingData
    )

  const previousRevenue =
    calculateRevenueData(
      previousCompletedBookingData
    )

  // ----------------------------------------------------------
  // CAC
  // ----------------------------------------------------------

  const customersWithOneBooking =
    countCustomersWithExactlyOneCompletedBooking(
      completedBookingData
    )

  const previousCustomersWithOneBooking =
    countCustomersWithExactlyOneCompletedBooking(
      previousCompletedBookingData
    )

  const currentCacExpense =
    prorateExpenseByRange(
      expenseByMonth,
      currentRange.from,
      currentRange.to
    )

  const previousCacExpense =
    prorateExpenseByRange(
      expenseByMonth,
      previousRange.from,
      previousRange.to
    )

  const cac =
    customersWithOneBooking > 0
      ? currentCacExpense /
        customersWithOneBooking
      : 0

  const previousCac =
    previousCustomersWithOneBooking >
    0
      ? previousCacExpense /
        previousCustomersWithOneBooking
      : 0

  // ----------------------------------------------------------
  // PNL
  // ----------------------------------------------------------

  const netPnL = calculateNetPnl(
    pnlRows,
    currentRange.from,
    currentRange.to
  )

  // ----------------------------------------------------------
  // FINAL VALUES
  // ----------------------------------------------------------

  const totalBookings =
    currentBookings.length

  const previousTotalBookings =
    previousBookings.length

  const completedBookings =
    completedBookingData.length

  const previousCompletedBookings =
    previousCompletedBookingData.length

  const completionRate =
    totalBookings > 0
      ? (
          completedBookings /
          totalBookings
        ) * 100
      : 0

  return {
    totalBookings,

    totalBookingsChange:
      roundNumber(
        percentChange(
          totalBookings,
          previousTotalBookings
        ),
        1
      ),

    pendingBookings,
    confirmedBookings,

    completedBookings,

    completedBookingsChange:
      roundNumber(
        percentChange(
          completedBookings,
          previousCompletedBookings
        ),
        1
      ),

    cancelledBookings,

    totalRevenue:
      roundNumber(
        currentRevenue.totalRevenue
      ),

    totalRevenueChange:
      roundNumber(
        percentChange(
          currentRevenue.totalRevenue,
          previousRevenue.totalRevenue
        ),
        1
      ),

    netRevenue:
      roundNumber(
        currentRevenue.netRevenue
      ),

    netRevenueChange:
      roundNumber(
        percentChange(
          currentRevenue.netRevenue,
          previousRevenue.netRevenue
        ),
        1
      ),

    perOrderValue:
      roundNumber(
        currentRevenue.perOrderValue
      ),

    perOrderValueChange:
      roundNumber(
        percentChange(
          currentRevenue.perOrderValue,
          previousRevenue.perOrderValue
        ),
        1
      ),

    totalCustomers:
      currentCustomerCount,

    totalCustomersChange:
      roundNumber(
        percentChange(
          currentCustomerCount,
          previousCustomerCount
        ),
        1
      ),

    /*
      These values are kept unchanged because this query file currently
      does not load review documents.
    */
    averageRating: 5,
    totalRatingsCount: 0,

    completionRate:
      roundNumber(
        completionRate,
        1
      ),

    totalOfferAmount:
      roundNumber(
        currentRevenue.totalOfferAmount
      ),

    cac: roundNumber(cac),

    cacChange:
      roundNumber(
        percentChange(
          cac,
          previousCac
        ),
        1
      ),

    netPnL:
      roundNumber(netPnL),
  }
}

// ============================================================
// CATEGORY LOOKUP HELPERS
// ============================================================

function getReferencePath(
  reference:
    | DocumentReference
    | null
    | undefined
): string {
  return reference?.path || ""
}

async function resolveServiceCategoryReference(
  subCategoryCartReference: DocumentReference
): Promise<DocumentReference | null> {
  const cacheKey =
    getReferencePath(
      subCategoryCartReference
    )

  if (!cacheKey) {
    return null
  }

  let cachedRequest =
    subCategoryCartCache.get(
      cacheKey
    )

  if (!cachedRequest) {
    cachedRequest = getDoc(
      subCategoryCartReference
    )
      .then((snapshot) => {
        if (!snapshot.exists()) {
          return null
        }

        const data =
          snapshot.data() as DocumentData

        const serviceCategoryReference =
          data.service_subCategory

        return serviceCategoryReference instanceof
          DocumentReference
          ? serviceCategoryReference
          : serviceCategoryReference ||
              null
      })
      .catch((error) => {
        console.error(
          `Error loading sub-category cart ${cacheKey}:`,
          error
        )

        return null
      })

    subCategoryCartCache.set(
      cacheKey,
      cachedRequest
    )
  }

  return cachedRequest
}

async function resolveCategoryName(
  categoryReference: DocumentReference
): Promise<string | null> {
  const cacheKey =
    getReferencePath(
      categoryReference
    )

  if (!cacheKey) {
    return null
  }

  let cachedRequest =
    categoryNameCache.get(
      cacheKey
    )

  if (!cachedRequest) {
    cachedRequest = getDoc(
      categoryReference
    )
      .then((snapshot) => {
        if (!snapshot.exists()) {
          return null
        }

        const categoryData =
          snapshot.data() as DocumentData

        return typeof categoryData.name ===
          "string"
          ? categoryData.name
          : null
      })
      .catch((error) => {
        console.error(
          `Error loading category ${cacheKey}:`,
          error
        )

        return null
      })

    categoryNameCache.set(
      cacheKey,
      cachedRequest
    )
  }

  return cachedRequest
}

async function resolveBookingCategoryName(
  subCategoryCartReference:
    | DocumentReference
    | null
    | undefined
): Promise<string | null> {
  if (!subCategoryCartReference) {
    return null
  }

  const categoryReference =
    await resolveServiceCategoryReference(
      subCategoryCartReference
    )

  if (!categoryReference) {
    return null
  }

  return resolveCategoryName(
    categoryReference
  )
}

function mapCategoryName(
  rawCategoryName:
    | string
    | null
    | undefined
): CategoryName | null {
  const categoryName =
    rawCategoryName
      ?.trim()
      .toLowerCase()

  if (!categoryName) {
    return null
  }

  if (
    categoryName.includes(
      "cleaning"
    ) ||
    categoryName.includes("clean")
  ) {
    return "Cleaning"
  }

  if (
    categoryName.includes(
      "electrical"
    ) ||
    categoryName.includes("elec")
  ) {
    return "Electrical"
  }

  if (
    categoryName.includes(
      "security"
    )
  ) {
    return "Security"
  }

  if (
    categoryName.includes("driver")
  ) {
    return "Driver"
  }

  return null
}

// ============================================================
// CATEGORY-WISE BOOKINGS
// ============================================================

export async function fetchCategoryWiseBookings(
  fromDate?: string,
  toDate?: string
): Promise<Record<string, number>> {
  const db = getFirestoreDb()

  const range = createDateRange(
    fromDate,
    toDate
  )

  const uniqueProviderIds = [
    ...new Set(
      PROVIDER_ID_LIST.filter(
        Boolean
      )
    ),
  ]

  const providerReferences =
    uniqueProviderIds.map(
      (providerId) =>
        doc(
          db,
          "customer",
          providerId
        )
    )

  const bookingDocuments =
    await fetchBookingsForRange(
      providerReferences,
      range
    )

  if (
    bookingDocuments.length === 0
  ) {
    return {
      ...EMPTY_CATEGORY_COUNTS,
    }
  }

  const bookings =
    bookingDocuments.map(
      (bookingDocument) =>
        bookingDocument.data() as BookingData
    )

  /*
    Category lookups run in parallel.

    The caches ensure that repeated subCategoryCart_id and category
    references are only downloaded once.
  */
  const categoryNames =
    await Promise.all(
      bookings.map((booking) =>
        resolveBookingCategoryName(
          booking.subCategoryCart_id
        )
      )
    )

  const categoryCounts: CategoryCounts = {
    ...EMPTY_CATEGORY_COUNTS,
  }

  for (const categoryName of categoryNames) {
    const mappedCategory =
      mapCategoryName(categoryName)

    if (mappedCategory) {
      categoryCounts[mappedCategory] +=
        1
    }
  }

  return categoryCounts
}