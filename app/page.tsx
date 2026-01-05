"use client";
import { useEffect, useState } from "react";
import { fetchBookingStats } from "@/lib/queries/dashboard";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminHeader } from "@/components/admin-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartPlaceholder } from "@/components/dashboard/chart-placeholder";
import { GraphPlaceholder } from "@/components/dashboard/graph-placeholder";
import { PerformanceMetrics } from "@/components/dashboard/performance-metrics";
import { Calendar, Users, DollarSign, TrendingUp, UserPlus, Star, Activity, BarChart3 } from "lucide-react";
import { CACGraph } from "@/components/dashboard/cac-graph";
import { ExpensePieChart } from "@/components/dashboard/expense-pie-chart";
import { TopPartnersCard } from "@/components/dashboard/top-partners-card";
import {DailyOverviewCard} from "@/components/dashboard/daily-overview"
import { PnLGraph } from "@/components/dashboard/PnLGraph";

function formatDateInput(d: Date) {
  return d.toLocaleDateString("en-CA"); // ✅ Formats as YYYY-MM-DD
}

export default function DashboardPage() {
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // ---- Fetch Data (with date range filter) ----
  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await fetchBookingStats(fromDate, toDate); // Pass selected date range
      setKpiData([
        {
          title: "Completed Bookings",
          value: data.completedBookings.toLocaleString(),
          change: `${data.completedBookingsChange}%`,
          trend: data.completedBookingsChange >= 0 ? "up" : "down",
          icon: Calendar,
          color: "text-primary",
          description: "Completed Bookings",
        },
        {
          title: "Total Sales",
          value: `₹${Math.round(data.totalRevenue).toLocaleString()}`,
          change: `${data.totalRevenueChange}%`,
          trend: data.totalRevenueChange >= 0 ? "up" : "down",
          icon: DollarSign,
          color: "text-secondary",
          description: "Gross revenue",
        },
        {
          title: "Net Revenue",
          value: `₹${Math.round(data.netRevenue).toLocaleString()}`,
          change: `${data.netRevenueChange}%`,
          trend: data.netRevenueChange >= 0 ? "up" : "down",
          icon: TrendingUp,
          color: "text-chart-3",
          description: "After discounts",
        },
        {
          title: "CAC",
          value: `₹${Math.round(data.cac).toLocaleString()}`,
          change: `${data.cacChange}%`,
          trend: data.cacChange >= 0 ? "up" : "down",
          icon: Star,
          color: "text-chart-2",
          description: "Customer Acquisition Cost",
          hoverContent: (
            <CACGraph
              title="Customer Acquisition Cost Trend"
              description="Month-over-month CAC variation"
              icon={Star}
              iconColor="text-chart-2"
            />
          ),
        },
        {
          title: "Net P&L",
          value: `₹${Math.round(data.netPnL).toLocaleString()}`,
          change: `${data.netRevenueChange}%`, // optional or can be computed later
          trend: data.netPnL >= 0 ? "up" : "down",
          icon: DollarSign,
          color: data.netPnL >= 0 ? "text-green-600" : "text-red-500",
          description: "P&L after expenses",
        },
        {
          title: "Per Order Value",
          value: `₹${Math.round(data.perOrderValue).toLocaleString()}`,
          change: `${data.perOrderValueChange}%`,
          trend: data.perOrderValueChange >= 0 ? "up" : "down",
          icon: Users,
          color: "text-chart-4",
          description: "Average per booking",
        },




      ]);
    } catch (err) {
      console.error(err);
      setError("Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate]);

  // ---- Render Page ----
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AdminSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <AdminHeader title="Dashboard Overview" />
          <main className="flex-1 space-y-6 p-4 md:p-6">
            {/* ---- Date Range Filter ---- */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-lg font-semibold"> Track key business metrics and performance here </p>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border rounded px-2 py-1"
                  max={formatDateInput(today)}  // Disable future dates
                />
                <span>to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border rounded px-2 py-1"
                  max={formatDateInput(today)}  // Disable future dates
                />
                <button onClick={clearFilter} className="bg-gray-200 hover:bg-gray-300 text-sm px-3 py-1 rounded">
                  Show Overall Performance
                </button>
              </div>
            </div>
            {/* ---- KPI Cards ---- */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {loading ? (
                <div>Loading...</div>
              ) : error ? (
                <div>{error}</div>
              ) : (
                kpiData.map((kpi, index) => <KpiCard key={index} {...kpi} />)
              )}
            </div>
            {/* ---- Charts ---- */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <ChartPlaceholder title="Monthly Bookings Trend" description="Booking volume over the selected range" icon={BarChart3} iconColor="text-primary" className="col-span-2" />
              <GraphPlaceholder title="Revenue Distribution" description="Revenue by service category" icon={Activity} iconColor="text-secondary" className="col-span-2" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <PnLGraph title="Net Profit & Loss Overview" description="Monthly earnings, expenses, and overall profit or loss trend" icon={BarChart3} className="col-span-2" />
              <ExpensePieChart className="col-span-2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <TopPartnersCard />
              {/* <TodayBookingsCard /> will come next */}
              <DailyOverviewCard/>
            </div>

            {/* ---- Performance Metrics ---- */}
            <PerformanceMetrics fromDate={""} toDate={""} />

          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}