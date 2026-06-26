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

  if (/^\d{4}-\d{2}$/.test(s)) return s;

  const m = s.match(/^([A-Za-z]+)\s+(\d{2})$/);
  if (m) {
    const yy = Number(m[2]);
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    const d = new Date(`${m[1]} 1, ${year}`);
    if (!isNaN(d.getTime())) return monthKey(d);
  }

  const d1 = new Date(`${s} 1`);
  if (!isNaN(d1.getTime())) return monthKey(d1);

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
      const mEnd = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      const overlapStart = from > mStart ? from : mStart;
      const overlapEnd = to < mEnd ? to : mEnd;

      if (overlapStart <= overlapEnd) {
        const dim = daysInMonth(cursor.getFullYear(), cursor.getMonth());
        const daily = fullMonthExpense / dim;
        const overlapDays =
          Math.floor(
            (overlapEnd.getTime() - overlapStart.getTime()) / 86400000
          ) + 1;

        total += overlapDays * daily;
      }
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return total;
}

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

export async function fetchBookingStats(
  fromDate?: string,
  toDate?: string
): Promise<BookingStats> {
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
  const customersCol = collection(db, "customer");

  const bookingSnap = await getDocs(
    query(
      bookingsCol,
      where("provider_id", "in", providerRefs),
      where("date", ">=", fromTS),
      where("date", "<=", toTS)
    )
  );

  const totalBookings = bookingSnap.size;

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

  let setWalletAmountTo = 0;

  const walletConfigSnap = await getDocs(
    collection(db, "adminAddamountinWallet")
  );

  if (!walletConfigSnap.empty) {
    const walletConfig = walletConfigSnap.docs[0].data() as any;
    setWalletAmountTo = Number(walletConfig.SetWalletAmountTo || 0);
  }

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

    const amountPaid = Number(d.amount_paid || 0);
    const walletAmountUsed = Number(d.walletAmountUsed || 0);
    const discountAmount = Number(d.discount_amount || 0);

    const walletOfferAmount = Math.min(walletAmountUsed, 300);

    completedDocsData.push({
      amount_paid: amountPaid,
      walletAmountUsed,
      discount_amount: discountAmount,
      customer_id: d.customer_id ?? null,
    });

    

    totalRevenue += amountPaid;
    walletUsed += walletOfferAmount;
    discounts += discountAmount;
    totalOfferAmount += walletOfferAmount + discountAmount;
  });

  const netRevenue = totalRevenue - walletUsed - discounts;

  const perOrderValue =
    completedBookings > 0 ? totalRevenue / completedBookings : 0;

  const customersSnap = await getDocs(
    query(
      customersCol,
      where("userType.customer", "==", true),
      where("created_time", ">=", fromTS),
      where("created_time", "<=", toTS)
    )
  );

  const totalCustomers = customersSnap.size;

  const customersWithOneBooking =
    countCustomersWithExactlyOneCompletedBookingInSnap(completedDocsData);

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
    const monthCol = columns.find((c) => c.toLowerCase().includes("month"));
    const totalCol = columns.find((c) => c.toLowerCase().includes("total"));

    if (monthCol && totalCol) {
      for (const r of rows) {
        const rawMonth = r[monthCol];
        const rawTotal = r[totalCol];
        if (!rawMonth || !rawTotal) continue;

        const total = parseFloat(rawTotal.replace(/,/g, "")) || 0;
        if (total <= 0) continue;

        const key = parseSheetMonthToKey(rawMonth, from.getFullYear());
        if (!key) continue;

        expenseByMonthKey[key] = (expenseByMonthKey[key] || 0) + total;
      }
    }
  }

  const cacExpense = prorateByMonthKey(expenseByMonthKey, from, to);
  const cac =
    customersWithOneBooking > 0 ? cacExpense / customersWithOneBooking : 0;

  const pnlRes = await fetch("/api/pnl");
  const { data: pnlData } = await pnlRes.json();

  let settlementsInRange = 0;
  let expensesInRange = 0;

  for (const m of pnlData) {
    const monthDate = new Date(m.month);

    const monthStart = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      1
    );

    const monthEnd = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0
    );

    if (monthEnd >= from && monthStart <= to) {
      settlementsInRange += m.settlements || 0;
      expensesInRange += m.expenses || 0;
    }
  }

  const netPnL = settlementsInRange - expensesInRange;

  const diff = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - diff);
  const prevTo = new Date(to.getTime() - diff);

  const prevFromTS = Timestamp.fromDate(prevFrom);
  const prevToTS = Timestamp.fromDate(prevTo);

  const prevCompletedSnap = await getDocs(
    query(
      bookingsCol,
      where("provider_id", "in", providerRefs),
      where("status", "==", "Service_Completed"),
      where("date", ">=", prevFromTS),
      where("date", "<=", prevToTS)
    )
  );

  const prevCompletedDocs: Array<{
    customer_id?: DocumentReference | null;
  }> = [];

  prevCompletedSnap.forEach((snapDoc) => {
    const d = snapDoc.data() as any;
    prevCompletedDocs.push({ customer_id: d.customer_id ?? null });
  });

  const prevCustomersWithOneBooking =
    countCustomersWithExactlyOneCompletedBookingInSnap(prevCompletedDocs);

  const prevCACExpense = prorateByMonthKey(expenseByMonthKey, prevFrom, prevTo);

  const prevCAC =
    prevCustomersWithOneBooking > 0
      ? prevCACExpense / prevCustomersWithOneBooking
      : 0;

  const cacChange = percentChange(cac, prevCAC);

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
      totalBookings > 0
        ? Number(((completedBookings / totalBookings) * 100).toFixed(1))
        : 0,
    totalOfferAmount,
    cac: Number(cac.toFixed(2)),
    cacChange: Number(cacChange.toFixed(1)),
    netPnL: Number(netPnL.toFixed(2)),
  };
}

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

  const completedSnap = await getDocs(
    query(
      bookingsCol,
      where("provider_id", "in", providerRefs),
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

  for (const docSnap of completedSnap.docs) {
    const booking = docSnap.data() as any;
    const subCatRef = booking.subCategoryCart_id;

    if (subCatRef) {
      try {
        const subCatSnap = await getDoc(subCatRef);
        const subCatData = subCatSnap.data() as any;

        if (subCatData?.service_subCategory) {
          const categoryRef = subCatData.service_subCategory;
          const categorySnap = await getDoc(categoryRef);
          const categoryData = categorySnap.data() as any;

          const categoryName = categoryData?.name;

          if (categoryName) {
            const lowerCategoryName = categoryName.toLowerCase();

            if (
              lowerCategoryName.includes("cleaning") ||
              lowerCategoryName.includes("clean")
            ) {
              categoryCount.Cleaning++;
            } else if (
              lowerCategoryName.includes("electrical") ||
              lowerCategoryName.includes("elec")
            ) {
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