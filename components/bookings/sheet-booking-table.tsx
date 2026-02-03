"use client";

import { useEffect, useMemo, useState } from "react";

type SheetBooking = {
  id: string;
  bookingDate: string; // Date
  customerName: string; // Customer Name
  service: string; // Service
  phone: string; // Contact Info
  address: string; // Address
  partnerName: string; // Patner Name
  source: string; // Source (as-is)
  amount: number; // Service Pric
  arriveTime: string; // Arrive Time
  status: string; // Status
  feedback: string; // Feedback
};

type Props = {
  fromDate: string;
  toDate: string;
};

const PAGE_SIZE = 10;

export function SheetBookingTable({ fromDate, toDate }: Props) {
  const [data, setData] = useState<SheetBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/bookings/sheet?from=${fromDate}&to=${toDate}`
        );
        const json = await res.json();

        // Map API → exact sheet UI fields
        const mapped: SheetBooking[] = (json.data || []).map((b: any) => ({
          id: b.id,
          bookingDate: b.bookingDate,
          customerName: b.customerName,
          service: b.service,
          phone: b.phone,
          address: b.address,
          partnerName: b.partnerName,
          source: b.source,
          amount: b.amount,
          arriveTime: b.arriveTime || "",
          status: b.status,
          feedback: b.feedback,
        }));

        setData(mapped);
        setPage(1);
      } catch (err) {
        console.error("Sheet booking fetch failed", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [fromDate, toDate]);

  /* ---------- SEARCH + SORT (LATEST FIRST) ---------- */
  const filtered = useMemo(() => {
    return data
      .filter((b) => {
        const q = search.toLowerCase();
        return (
          b.customerName.toLowerCase().includes(q) ||
          b.phone.toLowerCase().includes(q) ||
          b.service.toLowerCase().includes(q) ||
          b.source.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.bookingDate).getTime() -
          new Date(a.bookingDate).getTime()
      );
  }, [data, search]);

  /* ---------- PAGINATION ---------- */
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedData = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  if (loading) {
    return (
      <div className="bg-white border rounded-lg p-6 text-sm">
        Loading sheet bookings…
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg">

      {/* SEARCH BAR */}
      <div className="p-4 border-b flex justify-between items-center gap-4">
        <input
          type="text"
          placeholder="Search customer, phone, service, source…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-full max-w-md"
        />
        <span className="text-sm text-muted-foreground">
          {filtered.length} bookings
        </span>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer Name</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Contact Info</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Patner Name</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3 text-right">Service Price</th>
              <th className="px-4 py-3">Arrive Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Feedback</th>
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((b) => (
              <tr key={b.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(b.bookingDate).toLocaleDateString("en-IN")}
                </td>

                <td className="px-4 py-3">
                  <div className="font-medium">{b.customerName}</div>
                </td>

                <td className="px-4 py-3">{b.service}</td>
                <td className="px-4 py-3">{b.phone}</td>
                <td className="px-4 py-3">{b.address}</td>
                <td className="px-4 py-3">{b.partnerName || "—"}</td>
                <td className="px-4 py-3">{b.source || "—"}</td>

                <td className="px-4 py-3 text-right font-medium">
                  ₹{b.amount.toLocaleString()}
                </td>

                <td className="px-4 py-3">{b.arriveTime || "—"}</td>

                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                    {b.status || "—"}
                  </span>
                </td>

                <td className="px-4 py-3 max-w-xs">
                  {b.feedback || "—"}
                </td>
              </tr>
            ))}

            {!paginatedData.length && (
              <tr>
                <td
                  colSpan={11}
                  className="p-6 text-center text-muted-foreground"
                >
                  No bookings found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center p-4 border-t">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Previous
          </button>

          <span className="text-sm">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
