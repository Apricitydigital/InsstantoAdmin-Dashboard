
"use client";

import { useEffect, useMemo, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

type Payout = {
  id: string;
  amount: number;
  fees?: number | null;
  tax?: number | null;
  status: string;
  created_at: number;
  currency: string;
  fund_account_id?: string;
  reference_id?: string;
  purpose?: string;
  mode?: string;
  utr?: string | null;
  narration?: string;
};

type Report = {
  success: boolean;
  payouts: Payout[];
  totals: {
    totalRecords: number;
    totalProcessed: number;
    totalProcessing: number;
    totalReversed: number;
    totalFailed: number;
    totalPending?: number;
    totalQueued?: number;
    totalFees: number;
    totalTax: number;
  };
};

const currency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);

const dateText = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

function csvCell(value: unknown) {
  const text = String(value ?? "");

  // Prevent spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(text)
    ? "'" + text
    : text;

  return `"${safe.replace(/"/g, '""')}"`;
}

export default function RazorpayXPayoutsPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const isLoggedIn = Boolean(
    user && user.role !== "unauthorized"
  );

  async function loadPayouts() {
    if (!isLoggedIn) {
      setReport(null);
      setError("Please sign in to access payout history.");
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);

    try {
      if (from && to && from > to) {
        throw new Error(
          "Start date cannot be after end date."
        );
      }

      const params = new URLSearchParams();

      if (from) {
        params.set(
          "from",
          String(
            Math.floor(
              new Date(`${from}T00:00:00+05:30`)
                .getTime() / 1000
            )
          )
        );
      }

      if (to) {
        params.set(
          "to",
          String(
            Math.floor(
              new Date(`${to}T23:59:59+05:30`)
                .getTime() / 1000
            )
          )
        );
      }

      // Same Firebase instance as existing Admin.
      const auth = getFirebaseAuth();

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error(
          "Firebase session not found. Please sign in again."
        );
      }

      // Get a valid login token.
      const token = await firebaseUser.getIdToken();

      // Call protected server-side RazorpayX API.
      const response = await fetch(
        `/api/razorpayx/payouts?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 401) {
          throw new Error(
            data.error ||
              "Authentication failed. Please sign in again."
          );
        }

        throw new Error(
          data.error || "Unable to load payout history."
        );
      }

      setReport(data);
    } catch (err) {
      setReport(null);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // Load only after AuthProvider has resolved login.
  useEffect(() => {
    if (authLoading || !isLoggedIn) return;

    void loadPayouts();

    // Initial authenticated fetch only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn]);

  const filtered = useMemo(() => {
    return (report?.payouts ?? []).filter((p) => {
      const matchesStatus =
        status === "all" || p.status === status;

      const keyword = search.trim().toLowerCase();

      const matchesSearch =
        !keyword ||
        [
          p.id,
          p.reference_id,
          p.fund_account_id,
          p.narration,
          p.utr,
        ].some((value) =>
          (value ?? "").toLowerCase().includes(keyword)
        );

      return matchesStatus && matchesSearch;
    });
  }, [report, status, search]);

  function exportCSV() {
    if (!report || filtered.length === 0) return;

    const headings = [
      "Date",
      "Payout ID",
      "Fund Account",
      "Reference",
      "Purpose",
      "Mode",
      "Amount INR",
      "Fees INR",
      "Tax INR",
      "Status",
      "UTR",
      "Narration",
    ];

    const rows = filtered.map((p) => [
      dateText(p.created_at),
      p.id,
      p.fund_account_id,
      p.reference_id,
      p.purpose,
      p.mode,
      (p.amount / 100).toFixed(2),
      ((p.fees ?? 0) / 100).toFixed(2),
      ((p.tax ?? 0) / 100).toFixed(2),
      p.status,
      p.utr,
      p.narration,
    ]);

    const csv = [headings, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "insstanto-razorpayx-payouts.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  const cards = report
    ? [
        [
          "Total Payout Records",
          report.totals.totalRecords.toString(),
        ],
        [
          "Successfully Paid",
          currency(report.totals.totalProcessed),
        ],
        [
          "Processing",
          currency(report.totals.totalProcessing),
        ],
        [
          "Reversed",
          currency(report.totals.totalReversed),
        ],
        [
          "Failed",
          currency(report.totals.totalFailed),
        ],
        [
          "Fees + Tax",
          currency(
            report.totals.totalFees +
              report.totals.totalTax
          ),
        ],
      ]
    : [];

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-sm text-slate-500">
          Checking your login session...
        </p>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-bold text-red-700">
            Login Required
          </h1>
          <p className="mt-2 text-sm text-red-600">
            Please sign in with an authorized Insstanto
            Admin account to access payout history.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              RazorpayX Payout History
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Insstanto Finance Management
            </p>
          </div>

          <button
            type="button"
            onClick={exportCSV}
            disabled={
              !report || loading || filtered.length === 0
            }
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-w-0 rounded-lg border p-2 text-sm"
          />

          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-w-0 rounded-lg border p-2 text-sm"
          />

          <select
            aria-label="Payout status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-w-0 rounded-lg border p-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="processed">Processed</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
            <option value="queued">Queued</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <input
            type="search"
            aria-label="Search payouts"
            placeholder="Search payout / UTR"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 rounded-lg border p-2 text-sm"
          />

          <button
            type="button"
            onClick={() => void loadPayouts()}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Fetch Payouts"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b p-4 font-semibold text-slate-900">
            Transactions ({filtered.length})
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  {[
                    "Date",
                    "Payout ID",
                    "Reference",
                    "Mode",
                    "Amount",
                    "Fees + Tax",
                    "Status",
                    "UTR",
                  ].map((head) => (
                    <th
                      key={head}
                      className="whitespace-nowrap p-3 font-semibold"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap p-3">
                      {dateText(p.created_at)}
                    </td>

                    <td className="p-3">{p.id}</td>

                    <td className="p-3">
                      {p.reference_id || "—"}
                    </td>

                    <td className="p-3">
                      {p.mode || "—"}
                    </td>

                    <td className="whitespace-nowrap p-3 font-semibold">
                      {currency(p.amount / 100)}
                    </td>

                    <td className="whitespace-nowrap p-3">
                      {currency(
                        ((p.fees ?? 0) +
                          (p.tax ?? 0)) / 100
                      )}
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-medium capitalize ${
                          p.status === "processed"
                            ? "bg-green-100 text-green-700"
                            : p.status === "failed" ||
                                p.status === "reversed"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="p-3">
                      {p.utr || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && filtered.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                {error
                  ? "Unable to load payout records."
                  : "No payout records found."}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
