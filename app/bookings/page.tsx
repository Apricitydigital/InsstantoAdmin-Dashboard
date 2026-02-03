"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminHeader } from "@/components/admin-header";

import BookingStats from "@/components/bookings/booking-stats";
import { BookingTable } from "@/components/bookings/booking-table";

import SheetBookingStats from "@/components/bookings/sheet-booking-stats";
import { SheetBookingTable } from "@/components/bookings/sheet-booking-table";

function formatDateInput(d: Date) {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export default function BookingsPage() {
  // Default range: April 1, 2025 → Today
  const today = new Date();
  const defaultStart = new Date(2025, 3, 1);
  const defaultEnd = today;

  const [fromDate, setFromDate] = useState(formatDateInput(defaultStart));
  const [toDate, setToDate] = useState(formatDateInput(defaultEnd));
  const [activeTab, setActiveTab] = useState<"backend" | "sheet">("backend");

  const clearFilter = () => {
    setFromDate(formatDateInput(defaultStart));
    setToDate(formatDateInput(defaultEnd));
  };

  return (
    <ProtectedRoute requiredPermission="bookings:view">
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AdminSidebar />

        <div className="flex flex-col sm:gap-4 sm:py-4">
          <AdminHeader title="Booking & Scheduling" />

          <main className="flex-1 space-y-4 p-4 md:p-6">

            {/* ---------- Date Range Filter ---------- */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-lg border">
              <p className="text-muted-foreground text-sm font-medium">
                Filter bookings by booking date
              </p>

              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border rounded px-3 py-2 text-sm"
                  max={formatDateInput(today)}
                />

                <span className="text-sm text-muted-foreground">to</span>

                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border rounded px-3 py-2 text-sm"
                  max={formatDateInput(today)}
                />

                <button
                  onClick={clearFilter}
                  className="bg-gray-200 hover:bg-gray-300 text-sm px-3 py-2 rounded whitespace-nowrap"
                >
                  Show All Time
                </button>
              </div>
            </div>

            {/* ---------- Tabs ---------- */}
            <div className="flex gap-2 border-b">
              <button
                onClick={() => setActiveTab("backend")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  activeTab === "backend"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Backend Bookings
              </button>

              <button
                onClick={() => setActiveTab("sheet")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  activeTab === "sheet"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Sheet Bookings
              </button>
            </div>

            {/* ---------- Tab Content ---------- */}
            {activeTab === "backend" ? (
              <>
                <BookingStats fromDate={fromDate} toDate={toDate} />
                <BookingTable fromDate={fromDate} toDate={toDate} />
              </>
            ) : (
              <>
                <SheetBookingStats fromDate={fromDate} toDate={toDate} />
                <SheetBookingTable fromDate={fromDate} toDate={toDate} />
              </>
            )}

          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
