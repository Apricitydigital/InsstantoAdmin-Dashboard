import { NextResponse } from "next/server";
import Papa from "papaparse";
import { addMonths, format } from "date-fns";

/* ------------------------------
   HELPERS
------------------------------ */

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
}

/**
 * Supports:
 * - "January 26"
 * - "Jan 26"
 * - "January 2026"
 * - "Jan 2026"
 * - "2026-01"
 */
function parseSheetMonthToKey(raw: string, fallbackYear: number): string | null {
  const s = (raw || "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // Month YY → January 26
  const m = s.match(/^([A-Za-z]+)\s+(\d{2})$/);
  if (m) {
    const monthName = m[1];
    const yy = Number(m[2]);
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    const d = new Date(`${monthName} 1, ${year}`);
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

/* ------------------------------
   API
------------------------------ */

export async function GET() {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID!;
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

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
    const expenseByMonth: Record<string, number> = {};

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      const monthCol = columns.find(c => c.toLowerCase().includes("month"));
      const totalCol = columns.find(c => c.toLowerCase().includes("total"));

      if (monthCol && totalCol) {
        for (const r of rows) {
          const rawMonth = r[monthCol];
          const rawTotal = r[totalCol];
          if (!rawMonth || !rawTotal) continue;

          const total =
            parseFloat(rawTotal.replace(/,/g, "")) || 0;
          if (total <= 0) continue;

          const key = parseSheetMonthToKey(rawMonth, new Date().getFullYear());
          if (!key) continue;

          expenseByMonth[key] =
            (expenseByMonth[key] || 0) + total;
        }
      }
    }

    /* ------------------------------
       2️⃣ RAZORPAY SETTLEMENTS
    ------------------------------ */

    const now = new Date();
    const start = addMonths(now, -11);

    const from = Math.floor(start.getTime() / 1000);
    const to = Math.floor(now.getTime() / 1000);

    const LIMIT = 100;
    let skip = 0;
    let allSettlements: any[] = [];

    while (true) {
      const params = new URLSearchParams({
        count: LIMIT.toString(),
        skip: skip.toString(),
        from: from.toString(),
        to: to.toString(),
      });

      const response = await fetch(
        `https://api.razorpay.com/v1/settlements?${params.toString()}`,
        {
          headers: { Authorization: `Basic ${auth}` },
        }
      );

      if (!response.ok) break;

      const data = await response.json();
      const items = data.items ?? [];
      allSettlements.push(...items);

      if (items.length < LIMIT) break;
      skip += LIMIT;
    }

    const settlementByMonth: Record<string, number> = {};

    for (const s of allSettlements) {
      const d = new Date(s.created_at * 1000);
      const key = monthKey(d);
      const amount = (s.amount ?? 0) / 100;
      settlementByMonth[key] =
        (settlementByMonth[key] || 0) + amount;
    }

    /* ------------------------------
       3️⃣ BUILD 12-MONTH P&L
    ------------------------------ */

    const months = Array.from({ length: 12 }).map((_, i) =>
      addMonths(start, i)
    );

    const pnlData = months.map(d => {
      const key = monthKey(d);
      const expenses = expenseByMonth[key] || 0;
      const settlements = settlementByMonth[key] || 0;
      const netPnL = expenses - settlements;

      return {
        month: format(d, "MMM yyyy"), // "Jan 2026"
        expenses: +expenses.toFixed(2),
        settlements: +settlements.toFixed(2),
        netPnL: +netPnL.toFixed(2),
        status: netPnL >= 0 ? "loss" : "profit",
      };
    });

    return NextResponse.json({ data: pnlData });
  } catch (err: any) {
    console.error("P&L API Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
