
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet, Megaphone, Monitor, Receipt,
  RefreshCw, Search, FileSpreadsheet,
  TrendingUp, AlertCircle
} from "lucide-react";

type FinanceRow = Record<string, string>;

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

function toNumber(value: unknown): number {
  const cleaned = String(value ?? "")
    .replace(/[₹,\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1");

  const number = Number(cleaned);
  return cleaned && Number.isFinite(number) ? number : 0;
}

// function getMonth(value: string): string {
//   const match = value.match(
//     /^(January|February|March|April|May|June|July|August|September|October|November|December)\b/i
//   );

//   if (!match) return "Other";

//   return match[1].charAt(0).toUpperCase() +
//     match[1].slice(1).toLowerCase();
// }

function getMonth(value: string): string {
  const text = String(value ?? "").trim().toLowerCase();

  const monthMap: Record<string, string> = {
    jan: "January",
    january: "January",
    feb: "February",
    february: "February",
    mar: "March",
    march: "March",
    apr: "April",
    april: "April",
    may: "May",
    jun: "June",
    june: "June",
    jul: "July",
    july: "July",
    aug: "August",
    august: "August",
    sep: "September",
    sept: "September",
    september: "September",
    oct: "October",
    october: "October",
    nov: "November",
    november: "November",
    dec: "December",
    december: "December",
  };

  const match = text.match(
    /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/
  );

  if (!match) return "Other";

  return monthMap[match[1]] ?? "Other";
}


export default function Finance() {
  const [rawRows, setRawRows] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("All Months");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/google-sheet", {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("API request failed");

      const result = await response.json();

      setRawRows(
        Array.isArray(result.data) ? result.data : []
      );
    } catch {
      setError("Unable to fetch finance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const columns = useMemo(
    () => Object.keys(rawRows[0] ?? {}),
    [rawRows]
  );

  const monthColumn =
    columns.find((c) => c.trim().toLowerCase() === "month") ??
    columns[0];

  const expenseColumns = useMemo(
    () => columns.filter((column) => {
      const name = column.toLowerCase().trim();

      return (
        name !== "month" &&
        !name.includes("total") &&
        !name.includes("remark") &&
        !name.includes("quantity") &&
        !name.startsWith("__empty")
      );
    }),
    [columns]
  );

  // Weekly detail rows are the source for dashboard calculations.
  // This avoids counting monthly subtotal rows twice.
  const weeklyRows = useMemo(
    () => rawRows.filter((row) =>
      /\bweek\s*\d+\b/i.test(String(row[monthColumn] ?? ""))
    ),
    [rawRows, monthColumn]
  );

  const months = useMemo(
    () => Array.from(
      new Set(
        weeklyRows.map((row) =>
          getMonth(String(row[monthColumn] ?? ""))
        )
      )
    ).filter((m) => m !== "Other"),
    [weeklyRows, monthColumn]
  );

  const selectedRows = useMemo(
    () => weeklyRows.filter((row) =>
      month === "All Months" ||
      getMonth(String(row[monthColumn] ?? "")) === month
    ),
    [weeklyRows, month, monthColumn]
  );

  const categoryTotals = useMemo(
    () => expenseColumns.map((name) => ({
      name,
      amount: selectedRows.reduce(
        (sum, row) => sum + toNumber(row[name]), 0
      ),
    })).filter((item) => item.amount !== 0)
      .sort((a, b) => b.amount - a.amount),
    [expenseColumns, selectedRows]
  );

  const getCategoryTotal = (term: string) =>
    categoryTotals
      .filter((item) =>
        item.name.toLowerCase().includes(term.toLowerCase())
      )
      .reduce((sum, item) => sum + item.amount, 0);

  const totalExpenses = categoryTotals.reduce(
    (sum, item) => sum + item.amount, 0
  );

  const advertising = categoryTotals
    .filter((item) => /meta ads|google ads|advertis|influencer/i.test(item.name))
    .reduce((sum, item) => sum + item.amount, 0);

  const software = categoryTotals
    .filter((item) => /firebase|msg91|software/i.test(item.name))
    .reduce((sum, item) => sum + item.amount, 0);

  const otherExpenses = totalExpenses - advertising - software;

  const visibleRows = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return selectedRows;

    return selectedRows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      )
    );
  }, [selectedRows, search]);

  const cards = [
    {
      title: "Total Expenses",
      value: totalExpenses,
      icon: Wallet,
    },
    {
      title: "Advertising Spend",
      value: advertising,
      icon: Megaphone,
    },
    {
      title: "Software & Tools",
      value: software,
      icon: Monitor,
    },
    {
      title: "Other Expenses",
      value: otherExpenses,
      icon: Receipt,
    },
  ];

  return (
    <div className="min-w-0 space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Finance Overview
            </h1>
            <p className="text-sm text-muted-foreground">
              Insstanto Marketing & Operational Expenses
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option>All Months</option>
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          Loading finance report...
        </div>
      ) : !error && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ title, value, icon: Icon }) => (
              <div
                key={title}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {title}
                  </span>
                  <Icon className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="mt-3 break-words text-2xl font-bold tabular-nums">
                  {formatMoney(value)}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {month === "All Months" ? "All available months" : month}
                </p>
              </div>
            ))}
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                <h2 className="font-semibold">Expense Breakdown</h2>
              </div>

              <div className="space-y-4">
                {categoryTotals.slice(0, 8).map((item) => (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatMoney(item.amount)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{
                          width: `${Math.max(0, item.amount) / Math.max(1, categoryTotals[0]?.amount ?? 1) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-5 font-semibold">Key Expense Channels</h2>
              <div className="space-y-4">
                {[
                  ["Meta Ads", getCategoryTotal("meta ads")],
                  ["Google Ads", getCategoryTotal("google ads")],
                  ["MSG91", getCategoryTotal("msg91")],
                  ["RazorpayX", getCategoryTotal("razorpay x")],
                  ["Firebase", getCategoryTotal("firebase")],
                ].map(([label, amount]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(Number(amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <h2 className="font-semibold">Detailed Expense Report</h2>
                <p className="text-xs text-muted-foreground">
                  {visibleRows.length} weekly records
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search records..."
                  className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm sm:w-64"
                />
              </div>
            </div>

            <div className="max-w-full overflow-x-auto">
              <table className="w-max min-w-full text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap border-b px-4 py-3 text-left text-xs font-semibold"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {visibleRows.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b transition-colors hover:bg-muted/40"
                    >
                      {columns.map((column) => (
                        <td
                          key={column}
                          className="whitespace-nowrap px-4 py-3 tabular-nums"
                        >
                          {row[column] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {visibleRows.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No weekly records found for the selected filters.
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Dashboard totals are calculated from weekly expense entries.
            Monthly subtotal rows are excluded to avoid double counting.
            Compare totals with the Google Sheet before using them
            for financial reporting.
          </p>
        </>
      )}
    </div>
  );
}
