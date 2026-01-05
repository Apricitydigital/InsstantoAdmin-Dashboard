"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileX } from "lucide-react";
import * as XLSX from "xlsx";

type RecordType = {
  type: "PAYMENT" | "SETTLEMENT" | "REFUND";
  id: string;
  customer: { name: string; email: string; contact?: string };
  service: string;
  amount: number;
  method: string;
  status: string;
  utr: string | null;
  date: string;
  parentPayment?: string;
};

export default function PaymentTable({ records }: { records: RecordType[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ✅ Filtering
  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        r.id.toLowerCase().includes(search.toLowerCase()) ||
        r.customer.name.toLowerCase().includes(search.toLowerCase()) ||
        r.customer.email.toLowerCase().includes(search.toLowerCase()) ||
        (r.customer.contact || "").includes(search);

      const matchesStatus =
        statusFilter === "ALL" || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, search, statusFilter]);

  // ✅ Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  // ✅ Export
  const handleExport = () => {
    const exportData = filtered.map((r) => ({
      ID: r.id,
      Type: r.type,
      Customer: r.customer.name,
      Email: r.customer.email,
      Contact: r.customer.contact || "-",
      Amount: r.amount,
      Method: r.method,
      Status: r.status,
      Date: r.date,
      UTR: r.utr || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Records");
    XLSX.writeFile(wb, `records_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search payments/refunds/settlements..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="border pl-8 pr-3 py-1 rounded w-full"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border px-3 py-1 rounded"
          >
            <option value="ALL">All</option>
            <option value="CAPTURED">Captured</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="SETTLEMENT">Settlements</option>
          </select>
        </div>

        <Button onClick={handleExport}>Export</Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto border rounded-md bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileX className="h-10 w-10 mb-2 text-gray-400" />
            <p>No records found for this filter.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">UTR</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2">
                    {r.type === "PAYMENT" || r.type === "REFUND" ? (
                      <>
                        <div className="font-medium">{r.customer.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.customer.email}
                        </div>
                        {r.customer.contact && (
                          <div className="text-xs text-muted-foreground">
                            {r.customer.contact}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-semibold">₹{r.amount}</td>
                  <td className="px-3 py-2">{r.method}</td>
                  <td className="px-3 py-2">
                    <Badge
                      className={
                        r.status === "CAPTURED"
                          ? "bg-green-100 text-green-700"
                          : r.status === "FAILED"
                          ? "bg-red-100 text-red-700"
                          : r.status === "REFUNDED"
                          ? "bg-orange-100 text-orange-700"
                          : r.status === "SETTLEMENT"
                          ? "bg-teal-100 text-teal-700"
                          : "bg-gray-100 text-gray-700"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">
                    {r.type === "SETTLEMENT" ? r.utr : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-3 md:hidden">
        {paginated.length === 0 ? (
          <p className="text-center text-muted-foreground">No records found.</p>
        ) : (
          paginated.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">{r.id}</h3>
                <Badge
                  className={
                    r.status === "CAPTURED"
                      ? "bg-green-100 text-green-700"
                      : r.status === "FAILED"
                      ? "bg-red-100 text-red-700"
                      : r.status === "REFUNDED"
                      ? "bg-orange-100 text-orange-700"
                      : r.status === "SETTLEMENT"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-gray-100 text-gray-700"
                  }
                >
                  {r.status}
                </Badge>
              </div>

              {(r.type === "PAYMENT" || r.type === "REFUND") && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">{r.customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.customer.email}
                  </p>
                  {r.customer.contact && (
                    <p className="text-xs text-muted-foreground">
                      {r.customer.contact}
                    </p>
                  )}
                </div>
              )}

              {r.type === "SETTLEMENT" && (
                <p className="mt-2 text-sm">UTR: {r.utr}</p>
              )}

              <div className="mt-2 text-sm flex justify-between">
                <span>₹{r.amount}</span>
                <span>{r.method}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{r.date}</p>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {filtered.length > 0 && (
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <p>
            Page {currentPage} of {totalPages} — Showing {paginated.length} of{" "}
            {filtered.length} records
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
