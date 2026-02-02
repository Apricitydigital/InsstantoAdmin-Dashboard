"use client";

import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc as docRef,
  DocumentReference,
  getDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { PROVIDER_ID_LIST } from "@/lib/queries/partners";
import Papa from "papaparse";


export type BookingStats = {
  totalBookings: number;
  totalBookingsChange: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  completedBookingsChange: number;
  cancelledBookings: number;
  totalRevenue: number;
  totalRevenueChange: number;
  netRevenue: number;
  netRevenueChange: number;
  perOrderValue: number;
  perOrderValueChange: number;
  totalCustomers: number;
  totalCustomersChange: number;
  averageRating: number;
  totalRatingsCount: number;
  completionRate: number;
  totalOfferAmount: number;
  cac: number;
  cacChange: number;
  netPnL: number;
};


/* ------------------------------
   % CHANGE HELPER
------------------------------ */
function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseSheetMonthToKey(raw: string, fallbackYear: number): string | null {
  const s = (raw || "").trim();
  if (!s) return null;

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // Month YY → January 26
  const m = s.match(/^([A-Za-z]+)\s+(\d{2})$/);
  if (m) {
    const yy = Number(m[2]);
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    const d = new Date(`${m[1]} 1, ${year}`);
    if (!isNaN(d.getTime())) return monthKey(d);
  }

  // Month YYYY
  const d1 = new Date(`${s} 1`);
  if (!isNaN(d1.getTime())) return monthKey(d1);

  // Month only
  const d2 = new Date(`${s} 1, ${fallbackYear}`);
  if (!isNaN(d2.getTime())) return monthKey(d2);

  return null;
}

function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}

function prorateByMonthKey(
  expenseByMonth: Record<string, number>,
  from: Date,
  to: Date
) {
  let total = 0;
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);

  while (cursor <= to) {
    const key = monthKey(cursor);
    const fullMonthExpense = expenseByMonth[key] || 0;

    if (fullMonthExpense > 0) {
      const mStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

      const overlapStart = from > mStart ? from : mStart;
      const overlapEnd = to < mEnd ? to : mEnd;

      if (overlapStart <= overlapEnd) {
        const dim = daysInMonth(cursor.getFullYear(), cursor.getMonth());
        const daily = fullMonthExpense / dim;
        const overlapDays =
          Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;

        total += overlapDays * daily;
      }
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return total;
}

/* ------------------------------
   PRORATED EXPENSE HELPER
------------------------------ */
function proratedExpense(
  monthlyExpenses: { month: string; total: number }[],
  from: Date,
  to: Date,
  year: number
) {
  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  let total = 0;

  monthlyExpenses.forEach(({ month, total: monthTotal }) => {
    const monthIdx = new Date(`${month} 1, ${year}`).getMonth();
    if (isNaN(monthIdx)) return;

    const start = new Date(year, monthIdx, 1);
    const end = new Date(year, monthIdx + 1, 0);

    const dailyExpense = monthTotal / daysInMonth(year, monthIdx);

    const overlapStart = from > start ? from : start;
    const overlapEnd = to < end ? to : end;

    if (overlapStart <= overlapEnd) {
      const overlapDays =
        (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

      total += overlapDays * dailyExpense;
    }
  });

  return total;
}

/* ------------------------------
   CAC DENOMINATOR (WORKING)
   Customers with exactly 1 completed booking IN THE RANGE
   (scoped to the same provider filter + date filter)
------------------------------ */
function countCustomersWithExactlyOneCompletedBookingInSnap(
  completedDocs: Array<{ customer_id?: DocumentReference | null }>
) {
  const counts: Record<string, number> = {};

  for (const d of completedDocs) {
    const ref = d.customer_id as DocumentReference | undefined;
    const id = ref?.id;
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }

  let customersWithOneBooking = 0;
  for (const c of Object.values(counts)) {
    if (c === 1) customersWithOneBooking++;
  }

  return customersWithOneBooking;
}

/* ------------------------------
   MAIN FUNCTION
------------------------------ */
export async function fetchBookingStats(fromDate?: string, toDate?: string): Promise<BookingStats> {
  const db = getFirestoreDb();
  const now = new Date();

  /* ------------------------------
     DATE RANGE (with fallback)
  ------------------------------ */
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const from = fromDate ? new Date(fromDate + "T00:00:00") : defaultFrom;
  const to = toDate ? new Date(toDate + "T23:59:59") : defaultTo;

  const fromTS = Timestamp.fromDate(from);
  const toTS = Timestamp.fromDate(to);

  /* ------------------------------
     PROVIDER FILTERS
  ------------------------------ */
  const providerIds = PROVIDER_ID_LIST;

  const providerRefs = providerIds.map((id) => docRef(db, "customer", id));

  const bookingsCol = collection(db, "bookings");
  const customersCol = collection(db, "customer");

  /* ------------------------------
     BOOKINGS — TOTAL
  ------------------------------ */
  const bookingSnap = await getDocs(
    query(
      bookingsCol,
      where("provider_id", "in", providerRefs),
      where("date", ">=", fromTS),
      where("date", "<=", toTS)
    )
  );

  const totalBookings = bookingSnap.size;

  /* ------------------------------
     BOOKINGS — STATUS
  ------------------------------ */
  async function countStatus(status: string) {
    return await getDocs(
      query(
        bookingsCol,
        where("provider_id", "in", providerRefs),
        where("status", "==", status),
        where("date", ">=", fromTS),
        where("date", "<=", toTS)
      )
    );
  }

  const pendingSnap = await countStatus("Pending");
  const confirmedSnap = await countStatus("Accepted");
  const completedSnap = await countStatus("Service_Completed");
  const cancelledSnap = await countStatus("Booking_Cancelled");

  const pendingBookings = pendingSnap.size;
  const confirmedBookings = confirmedSnap.size;
  const completedBookings = completedSnap.size;
  const cancelledBookings = cancelledSnap.size;

  /* ------------------------------
     REVENUE CALCULATION (completed only)
  ------------------------------ */
  let totalRevenue = 0;
  let walletUsed = 0;
  let discounts = 0;
  let totalOfferAmount = 0;

  const completedDocsData: Array<{
    amount_paid?: number;
    walletAmountUsed?: number;
    discount_amount?: number;
    customer_id?: DocumentReference | null;
  }> = [];

  completedSnap.forEach((snapDoc) => {
    const d = snapDoc.data() as any;

    completedDocsData.push({
      amount_paid: d.amount_paid ?? 0,
      walletAmountUsed: d.walletAmountUsed ?? 0,
      discount_amount: d.discount_amount ?? 0,
      customer_id: d.customer_id ?? null,
    });

    totalRevenue += d.amount_paid || 0;
    walletUsed += d.walletAmountUsed || 0;
    discounts += d.discount_amount || 0;
    totalOfferAmount += (d.walletAmountUsed || 0) + (d.discount_amount || 0);
  });

  const netRevenue = totalRevenue - walletUsed - discounts;

  const perOrderValue = completedBookings > 0 ? totalRevenue / completedBookings : 0;

  /* ------------------------------
     NEW CUSTOMERS CREATED IN RANGE
  ------------------------------ */
  const customersSnap = await getDocs(
    query(
      customersCol,
      where("userType.customer", "==", true),
      where("created_time", ">=", fromTS),
      where("created_time", "<=", toTS)
    )
  );

  const totalCustomers = customersSnap.size;

  /* ------------------------------
     ✅ CAC DENOMINATOR (FIXED)
     Customers who completed exactly ONE booking in THIS date range
     (matches provider filter + date range)
  ------------------------------ */
  const customersWithOneBooking = countCustomersWithExactlyOneCompletedBookingInSnap(
    completedDocsData
  );

  /* ------------------------------
     MARKETING EXPENSE — GOOGLE SHEET
  ------------------------------ */
const sheetUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv";

const sheetRes = await fetch(sheetUrl);
const sheetText = await sheetRes.text();

const parsed = Papa.parse<Record<string, string>>(sheetText, {
  header: true,
  skipEmptyLines: true,
});

const rows = parsed.data;
const expenseByMonthKey: Record<string, number> = {};

if (rows.length > 0) {
  const columns = Object.keys(rows[0]);
  const monthCol = columns.find(c => c.toLowerCase().includes("month"));
  const totalCol = columns.find(c => c.toLowerCase().includes("total"));

  if (monthCol && totalCol) {
    for (const r of rows) {
      const rawMonth = r[monthCol];
      const rawTotal = r[totalCol];
      if (!rawMonth || !rawTotal) continue;

      const total = parseFloat(rawTotal.replace(/,/g, "")) || 0;
      if (total <= 0) continue;

      const key = parseSheetMonthToKey(rawMonth, from.getFullYear());
      if (!key) continue;

      expenseByMonthKey[key] =
        (expenseByMonthKey[key] || 0) + total;
    }
  }
}


  /* ------------------------------
     CAC — PRORATED MARKETING EXPENSE
  ------------------------------ */
const cacExpense = prorateByMonthKey(expenseByMonthKey, from, to);
const cac = customersWithOneBooking > 0 ? cacExpense / customersWithOneBooking : 0;

const totalExpensePNL = prorateByMonthKey(expenseByMonthKey, from, to);
const netPnL = netRevenue - totalExpensePNL;


  /* ------------------------------
     CAC CHANGE (PREVIOUS RANGE)
  ------------------------------ */
  const diff = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - diff);
  const prevTo = new Date(to.getTime() - diff);

  const prevFromTS = Timestamp.fromDate(prevFrom);
  const prevToTS = Timestamp.fromDate(prevTo);

  // Previous window: completed bookings (same provider filter + status + date range)
  const prevCompletedSnap = await getDocs(
    query(
      bookingsCol,
      where("provider_id", "in", providerRefs),
      where("status", "==", "Service_Completed"),
      where("date", ">=", prevFromTS),
      where("date", "<=", prevToTS)
    )
  );

  const prevCompletedDocs: Array<{ customer_id?: DocumentReference | null }> = [];
  prevCompletedSnap.forEach((snapDoc) => {
    const d = snapDoc.data() as any;
    prevCompletedDocs.push({ customer_id: d.customer_id ?? null });
  });

  const prevCustomersWithOneBooking =
    countCustomersWithExactlyOneCompletedBookingInSnap(prevCompletedDocs);

  const prevCACExpense = prorateByMonthKey(expenseByMonthKey, prevFrom, prevTo);
  const prevCAC =
    prevCustomersWithOneBooking > 0 ? prevCACExpense / prevCustomersWithOneBooking : 0;

  const cacChange = percentChange(cac, prevCAC);

  /* ------------------------------
     NET PNL (DAILY PRORATED)
  ------------------------------ */


  /* ------------------------------
     FINAL RETURN OBJECT
  ------------------------------ */
  return {
    totalBookings,
    totalBookingsChange: 0,
    pendingBookings,
    confirmedBookings,
    completedBookings,
    completedBookingsChange: 0,
    cancelledBookings,
    totalRevenue,
    totalRevenueChange: 0,
    netRevenue,
    netRevenueChange: 0,
    perOrderValue,
    perOrderValueChange: 0,
    totalCustomers,
    totalCustomersChange: 0,
    averageRating: 5,
    totalRatingsCount: 0,
    completionRate:
      totalBookings > 0 ? Number(((completedBookings / totalBookings) * 100).toFixed(1)) : 0,
    totalOfferAmount,
    cac: Number(cac.toFixed(2)),
    cacChange: Number(cacChange.toFixed(1)),
    netPnL: Number(netPnL.toFixed(2)),
  };
}

/* ==============================
   CATEGORY-WISE BOOKINGS
============================== */
export async function fetchCategoryWiseBookings(
  fromDate?: string,
  toDate?: string
): Promise<Record<string, number>> {
  const db = getFirestoreDb();
  const now = new Date();

  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const from = fromDate ? new Date(fromDate + "T00:00:00") : defaultFrom;
  const to = toDate ? new Date(toDate + "T23:59:59") : defaultTo;

  const fromTS = Timestamp.fromDate(from);
  const toTS = Timestamp.fromDate(to);

  const providerIds = PROVIDER_ID_LIST;
  const providerRefs = providerIds.map((id) => docRef(db, "customer", id));

  const bookingsCol = collection(db, "bookings");

  // Get all completed bookings in the date range
  const completedSnap = await getDocs(
    query(
      bookingsCol,
      where("provider_id", "in", providerRefs),
      // where("status", "==", "Service_Completed"),
      where("date", ">=", fromTS),
      where("date", "<=", toTS)
    )
  );

  const categoryCount: Record<string, number> = {
    Cleaning: 0,
    Electrical: 0,
    Security: 0,
    Driver: 0,
  };

  // Count bookings by category
  for (const docSnap of completedSnap.docs) {
    const booking = docSnap.data() as any;
    const subCatRef = booking.subCategoryCart_id;

    if (subCatRef) {
      try {
        // Get the subcategory document
        const subCatSnap = await getDoc(subCatRef);
        const subCatData = subCatSnap.data() as any;

        // Get the category reference from subcategory
        if (subCatData?.service_subCategory) {
          const categoryRef = subCatData.service_subCategory;
          const categorySnap = await getDoc(categoryRef);
          const categoryData = categorySnap.data() as any;
          
          // Get the category name from Service_Categories document
          const categoryName = categoryData?.name;

          // Map category name to our predefined categories
          if (categoryName) {
            const lowerCategoryName = categoryName.toLowerCase();
            if (lowerCategoryName.includes("cleaning") || lowerCategoryName.includes("Clean")) {
              categoryCount.Cleaning++;
            } else if (lowerCategoryName.includes("electrical") || lowerCategoryName.includes("elec")) {
              categoryCount.Electrical++;
            } else if (lowerCategoryName.includes("security")) {
              categoryCount.Security++;
            } else if (lowerCategoryName.includes("driver")) {
              categoryCount.Driver++;
            }
          }
        }
      } catch (error) {
        console.error("Error fetching category for booking:", error);
      }
    }
  }

  return categoryCount;
}
