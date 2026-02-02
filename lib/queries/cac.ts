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
import Papa from "papaparse";
import { getFirestoreDb } from "@/lib/firebase";
import { PROVIDER_ID_LIST } from "@/lib/queries/partners";

/* ------------------------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------------------------ */

export type MonthlyCACPoint = {
  key: string; // YYYY-MM
  monthLabel: string; // "Jan 2026"
  marketingExpense: number;
  customersWithOneBooking: number;
  cac: number;
  changePct?: number | null;
  changeDir?: "up" | "down" | "flat";
};

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
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
 * ✅ Supports:
 * - "January 26"
 * - "Jan 26"
 * - "January 2026"
 * - "Jan 2026"
 * - "2026-01"
 */
function parseSheetMonthToKey(raw: string, fallbackYear: number): string | null {
  const s = (raw || "").trim();
  if (!s) return null;

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // Month YY  → January 26
  const m = s.match(/^([A-Za-z]+)\s+(\d{2})$/);
  if (m) {
    const monthName = m[1];
    const yy = Number(m[2]);
    const fullYear = yy < 50 ? 2000 + yy : 1900 + yy;
    const d = new Date(`${monthName} 1, ${fullYear}`);
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

/**
 * Prorate expense if date range overlaps partially with a month
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

/* ------------------------------------------------------------------ */
/* MAIN */
/* ------------------------------------------------------------------ */

export async function fetchCACMonthlyPoints(
  fromDate?: string,
  toDate?: string
): Promise<MonthlyCACPoint[]> {
  const db = getFirestoreDb();
  const now = new Date();

  const to = toDate
    ? new Date(toDate + "T23:59:59")
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const from = fromDate
    ? new Date(fromDate + "T00:00:00")
    : new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0);

  const fromTS = Timestamp.fromDate(from);
  const toTS = Timestamp.fromDate(to);

  /* ------------------------------
     1️⃣ EXPENSE SHEET (SAFE)
  ------------------------------ */

  const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv";

  const sheetRes = await fetch(SHEET_URL);
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
     2️⃣ BOOKINGS (FIRESTORE)
  ------------------------------ */

  const providerRefs = PROVIDER_ID_LIST.slice(0, 8).map(id =>
    docRef(db, "customer", id)
  );

  const completedSnap = await getDocs(
    query(
      collection(db, "bookings"),
      where("provider_id", "in", providerRefs),
      where("status", "==", "Service_Completed"),
      where("date", ">=", fromTS),
      where("date", "<=", toTS)
    )
  );

  const countsByMonth: Record<string, Record<string, number>> = {};

  completedSnap.forEach(docSnap => {
    const d = docSnap.data() as {
      date?: Timestamp;
      customer_id?: DocumentReference;
    };

    if (!d.date || !d.customer_id?.id) return;

    const mk = monthKey(d.date.toDate());
    countsByMonth[mk] ||= {};
    countsByMonth[mk][d.customer_id.id] =
      (countsByMonth[mk][d.customer_id.id] || 0) + 1;
  });

  /* ------------------------------
     3️⃣ BUILD MONTH POINTS
  ------------------------------ */

  const points: MonthlyCACPoint[] = [];
  let cursor = startOfMonth(from);

  while (cursor <= to) {
    const mk = monthKey(cursor);
    const mStart = startOfMonth(cursor);
    const mEnd = endOfMonth(cursor);

    const fullMonthExpense = expenseByMonthKey[mk] || 0;
    const marketingExpense = fullMonthExpense
      ? prorateMonthlyExpenseForRange(fullMonthExpense, mStart, mEnd, from, to)
      : 0;

    const perCustomer = countsByMonth[mk] || {};
    const customersWithOneBooking = Object.values(perCustomer).filter(c => c === 1).length;

    const cac =
      customersWithOneBooking > 0
        ? marketingExpense / customersWithOneBooking
        : 0;

    points.push({
      key: mk,
      monthLabel: monthLabel(cursor),
      marketingExpense: +marketingExpense.toFixed(2),
      customersWithOneBooking,
      cac: +cac.toFixed(2),
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  /* ------------------------------
     4️⃣ MoM CHANGE
  ------------------------------ */

  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      points[i].changePct = null;
      points[i].changeDir = "flat";
    } else {
      const pct = percentChange(points[i].cac, points[i - 1].cac);
      points[i].changePct = +pct.toFixed(1);
      points[i].changeDir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
    }
  }

  return points;
}
