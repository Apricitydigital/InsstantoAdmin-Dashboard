"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "../../components/admin-header";
import { AdminSidebar } from "../../components/admin-sidebar";
import PaymentStatsCards from "../../components/payments/payment-stats";
import PaymentTable from "../../components/payments/payment-table";

function formatDateInput(d: Date) {
  return d.toLocaleDateString("en-CA");
}

export default function PaymentsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const [fromDate, setFromDate] = useState<string>(formatDateInput(firstDay));
  const [toDate, setToDate] = useState<string>(formatDateInput(lastDay));

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (fromDate) {
        const fromUTC = new Date(fromDate + "T00:00:00Z");
        params.set("from", Math.floor(fromUTC.getTime() / 1000).toString());
      }
      if (toDate) {
        const toUTC = new Date(toDate + "T23:59:59Z");
        params.set("to", Math.floor(toUTC.getTime() / 1000).toString());
      }

      const res = await fetch(`/api/payments?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `API error: ${res.status}`);
      }

      const resData = await res.json();
      const { payments: pItems, settlements: sItems, refunds: rItems, stats } = resData;

      // ✅ Normalize PAYMENTS (exclude refunded ones)
      const mappedPayments = (pItems ?? [])
        .filter((p: any) => String(p.status).toUpperCase() !== "REFUNDED")
        .map((p: any) => ({
          type: "PAYMENT",
          id: p.id,
          customer: {
            name: p.email?.split("@")[0] || p.contact || "Unknown",
            email: p.email || "N/A",
            contact: p.contact || "-",
          },
          service: p.description || "N/A",
          amount: (p.amount ?? 0) / 100,
          method: p.method ? String(p.method).toUpperCase() : "N/A",
          status: p.status ? String(p.status).toUpperCase() : "N/A",
          utr: null,
          ts: (p.created_at ?? 0) * 1000,
          date: new Date((p.created_at ?? 0) * 1000).toLocaleDateString("en-IN"),
        }));

      // ✅ Normalize REFUNDS (with parent payment details)
      const mappedRefunds = (rItems ?? []).map((r: any) => ({
        type: "REFUND",
        id: r.id,
        customer: {
          name: r.customer_name || "-",
          email: r.customer_email || "-",
          contact: r.customer_contact || "-",
        },
        service: "-",
        amount: (r.amount ?? 0) / 100,
        method: r.parent_method || "-",
        status: "REFUNDED",
        utr: null,
        parentPayment: r.parent_payment_id || "—",
        ts: (r.created_at ?? 0) * 1000,
        date: new Date((r.created_at ?? 0) * 1000).toLocaleDateString("en-IN"),
      }));

      // ✅ Normalize SETTLEMENTS
      const mappedSettlements = (sItems ?? []).map((s: any) => ({
        type: "SETTLEMENT",
        id: s.id,
        customer: { name: "-", email: "-", contact: "-" },
        service: "-",
        amount: (s.amount ?? 0) / 100,
        method: "-",
        status: "SETTLEMENT",
        utr: s.utr || "—",
        ts: (s.created_at ?? 0) * 1000,
        date: new Date((s.created_at ?? 0) * 1000).toLocaleDateString("en-IN"),
      }));

      // ✅ Combine and sort all records (latest first)
      const combined = [...mappedPayments, ...mappedRefunds, ...mappedSettlements].sort(
        (a, b) => b.ts - a.ts
      );

      setRecords(combined);
      setStats(stats);
    } catch (err: any) {
      setError(err?.message || "Failed to load payments");
      setRecords([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const clearFilter = () => {
    setFromDate(formatDateInput(firstDay));
    setToDate(formatDateInput(lastDay));
  };

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <AdminHeader title="Payment Management" />

        <main className="flex-1 space-y-6 p-6">
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-lg font-semibold">
                  Monitor, track, and manage all payment, refund & settlement data
                </p>
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border rounded px-2 py-1"
                  max={formatDateInput(today)}
                />
                <span>to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border rounded px-2 py-1"
                  max={formatDateInput(today)}
                />
                <button
                  onClick={clearFilter}
                  className="bg-gray-200 hover:bg-gray-300 text-sm px-3 py-1 rounded"
                >
                  Reset to Current Month
                </button>
              </div>
            </div>

            {/* Data Section */}
            {loading && <p>Loading...</p>}

            {!loading && error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            {!loading && !error && (
              <>
                {stats && <PaymentStatsCards stats={stats} />}
                <PaymentTable records={records} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
