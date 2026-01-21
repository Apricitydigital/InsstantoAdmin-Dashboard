"use client";

import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc as docRef,
  DocumentReference,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { PROVIDER_ID_LIST } from "@/lib/queries/partners";

export type MonthlyCACPoint = {
  key: string; // YYYY-MM (for sorting)
  monthLabel: string; // e.g. "Jan 2026"
  marketingExpense: number;
  customersWithOneBooking: number;
  cac: number;
  changePct?: number | null;
  changeDir?: "up" | "down" | "flat";
};

/* ------------------------------
   HELPERS
------------------------------ */

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "short", year: "numeric" }); // "Jan 2026"
}

function clampDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Robust-ish parsing for Google Sheet month labels.
 * Supports values like:
 * - "Jan", "January"
 * - "Jan 2026", "January 2026"
 * - "2026-01" (best)
 */
function parseSheetMonthToKey(raw: string, fallbackYear: number): string | null {
  const s = (raw || "").trim();
  if (!s) return null;

  // If it's already YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // Try "Mon YYYY" / "Month YYYY"
  const try1 = new Date(`${s} 1`);
  if (!isNaN(try1.getTime())) return monthKey(try1);

  // Try "Mon" (no year) -> use fallbackYear
  const try2 = new Date(`${s} 1, ${fallbackYear}`);
  if (!isNaN(try2.getTime())) return monthKey(try2);

  return null;
}

/**
 * If your date range starts/ends mid-month, we prorate that month’s expense by overlap days.
 * If full month, it will effectively be the full monthly expense.
 */
function prorateMonthlyExpenseForRange(
  fullMonthTotal: number,
  monthStart: Date,
  monthEnd: Date,
  rangeFrom: Date,
  rangeTo: Date
) {
  const overlapStart = rangeFrom > monthStart ? rangeFrom : monthStart;
  const overlapEnd = rangeTo < monthEnd ? rangeTo : monthEnd;
  if (overlapStart > overlapEnd) return 0;

  const y = monthStart.getFullYear();
  const m0 = monthStart.getMonth();
  const dim = daysInMonth(y, m0);
  const daily = fullMonthTotal / dim;

  const overlapDays =
    Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return overlapDays * daily;
}

/* ------------------------------
   MAIN: MONTHLY CAC POINTS
------------------------------ */
export async function fetchCACMonthlyPoints(fromDate?: string, toDate?: string): Promise<MonthlyCACPoint[]> {
  const db = getFirestoreDb();
  const now = new Date();

  // Default: last 6 months if no range (feel free to change)
  const defaultTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0);

  const from = clampDate(fromDate ? new Date(fromDate + "T00:00:00") : defaultFrom);
  const to = clampDate(toDate ? new Date(toDate + "T23:59:59") : defaultTo);

  const fromTS = Timestamp.fromDate(from);
  const toTS = Timestamp.fromDate(to);

  // Provider filter (using first 8 providers)
  const providerIds = PROVIDER_ID_LIST.slice(0, 8);
  const providerRefs = providerIds.map((id) => docRef(db, "customer", id));

  // 1) Pull marketing monthly totals from Google Sheet
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv";

  const sheetRes = await fetch(sheetUrl);
  const sheetText = await sheetRes.text();

  const rows = sheetText
    .trim()
    .split("\n")
    .map((r) => r.split(",").map((c) => c.trim()));

  const header = rows[0] ?? [];
  const monthIdx = header.findIndex((h) => h.toLowerCase().includes("month"));
  const totalIdx = header.findIndex((h) => h.toLowerCase().includes("total"));

  const expenseByMonthKey: Record<string, number> = {};

  if (monthIdx >= 0 && totalIdx >= 0) {
    for (const r of rows.slice(1)) {
      const rawMonth = r[monthIdx] ?? "";
      const total = parseFloat(r[totalIdx] ?? "0") || 0;
      if (!rawMonth || total <= 0) continue;

      // Try parse with "rawMonth" using its own year, else fallback to from.getFullYear()
      const k = parseSheetMonthToKey(rawMonth, from.getFullYear());
      if (!k) continue;

      expenseByMonthKey[k] = (expenseByMonthKey[k] || 0) + total;
    }
  }

  // 2) Fetch ALL completed bookings once for the range, then group by month
  const bookingsCol = collection(db, "bookings");

  const completedSnap = await getDocs(
    query(
      bookingsCol,
      where("provider_id", "in", providerRefs),
      where("status", "==", "Service_Completed"),
      where("date", ">=", fromTS),
      where("date", "<=", toTS)
    )
  );

  // monthKey -> customerId -> count
  const countsByMonth: Record<string, Record<string, number>> = {};

  completedSnap.forEach((docSnap) => {
    const d = docSnap.data() as {
      date?: Timestamp;
      customer_id?: DocumentReference | null;
    };

    const ts = d.date;
    const custRef = d.customer_id as DocumentReference | null | undefined;

    if (!ts || !custRef?.id) return;

    const dt = ts.toDate();
    const mk = monthKey(dt);
    countsByMonth[mk] ||= {};
    countsByMonth[mk][custRef.id] = (countsByMonth[mk][custRef.id] || 0) + 1;
  });

  // 3) Build month buckets from from..to
  const points: MonthlyCACPoint[] = [];
  let cursor = startOfMonth(from);

  while (cursor <= to) {
    const mk = monthKey(cursor);
    const mStart = startOfMonth(cursor);
    const mEnd = endOfMonth(cursor);

    // marketing expense for this month (from sheet), prorated if partial overlap
    const fullMonthTotal = expenseByMonthKey[mk] || 0;
    const marketingExpense = fullMonthTotal
      ? prorateMonthlyExpenseForRange(fullMonthTotal, mStart, mEnd, from, to)
      : 0;

    // customers with exactly one completed booking in this month (within overall range)
    const perCustomer = countsByMonth[mk] || {};
    let customersWithOneBooking = 0;
    for (const cnt of Object.values(perCustomer)) {
      if (cnt === 1) customersWithOneBooking++;
    }

    const cac = customersWithOneBooking > 0 ? marketingExpense / customersWithOneBooking : 0;

    points.push({
      key: mk,
      monthLabel: monthLabel(cursor),
      marketingExpense: Number(marketingExpense.toFixed(2)),
      customersWithOneBooking,
      cac: Number(cac.toFixed(2)),
    });

    // next month
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  // 4) Month-over-month change
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      points[i].changePct = null;
      points[i].changeDir = "flat";
      continue;
    }
    const prev = points[i - 1].cac;
    const cur = points[i].cac;
    const pct = percentChange(cur, prev);
    points[i].changePct = Number(pct.toFixed(1));
    points[i].changeDir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  }

  return points;
}
