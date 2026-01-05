"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminHeader } from "@/components/admin-header";
import BookingStats from "@/components/bookings/booking-stats";
import { BookingTable } from "@/components/bookings/booking-table";

function formatDateInput(d: Date) {
  return d.toLocaleDateString("en-CA"); // ✅ Formats as YYYY-MM-DD
}

export default function BookingsPage() {
  // ✅ Default range: From April 1, 2025 to today's date
  const today = new Date();
  const defaultStart = new Date(2025, 3, 1); // Month is 0-indexed → 3 = April
  const defaultEnd = today;
  
  const [fromDate, setFromDate] = useState<string>(formatDateInput(defaultStart));
  const [toDate, setToDate] = useState<string>(formatDateInput(defaultEnd));

  // ✅ Reset button now resets to April 1, 2025 → today
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
            {/* ---- Date Range Filter ---- */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-lg border">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Filter bookings by booking date
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={(e) => setFromDate(e.target.value)} 
                  className="border rounded px-3 py-2 text-sm"
                  max={formatDateInput(today)}  // Disable future dates
                />
                <span className="text-sm text-muted-foreground">to</span>
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={(e) => setToDate(e.target.value)} 
                  className="border rounded px-3 py-2 text-sm"
                  max={formatDateInput(today)}  // Disable future dates
                />
                <button 
                  onClick={clearFilter} 
                  className="bg-gray-200 hover:bg-gray-300 text-sm px-3 py-2 rounded whitespace-nowrap"
                >
                  Show All Time
                </button>
              </div>
            </div>

            <BookingStats fromDate={fromDate} toDate={toDate} />
            <BookingTable fromDate={fromDate} toDate={toDate} />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}