"use client"

import { useEffect, useState } from "react"
import { Activity, BarChart3, Calendar, CalendarRange, DollarSign, LayoutDashboard, RefreshCcw, RotateCcw, Star, TrendingUp, Users } from "lucide-react"

import AiAnalysisChatbot from "@/components/admin/AiAnalysisChatbot"
import { AdminHeader } from "@/components/admin-header"
import { ProtectedRoute } from "@/components/auth/protected-route"
import CACGraph from "@/components/dashboard/cac-graph"
import { ChartPlaceholder } from "@/components/dashboard/chart-placeholder"
import { DailyOverviewCard } from "@/components/dashboard/daily-overview"
import { ExpensePieChart } from "@/components/dashboard/expense-pie-chart"
import { GraphPlaceholder } from "@/components/dashboard/graph-placeholder"
import HomePageAlert from "@/components/dashboard/HomePageAlert"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { PerformanceMetrics } from "@/components/dashboard/performance-metrics"
import { PnLGraph } from "@/components/dashboard/PnLGraph"
import { TopPartnersCard } from "@/components/dashboard/top-partners-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fetchBookingStats } from "@/lib/queries/dashboard"

function formatDateInput(date: Date) {
  return date.toLocaleDateString("en-CA")
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
}

export default function DashboardPage() {
  const today = new Date()
  const defaultStart = new Date(2025, 3, 1)
  const [fromDate, setFromDate] = useState(formatDateInput(defaultStart))
  const [toDate, setToDate] = useState(formatDateInput(today))
  const [kpiData, setKpiData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const resetDates = () => {
    setFromDate(formatDateInput(defaultStart))
    setToDate(formatDateInput(new Date()))
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetchBookingStats(fromDate, toDate)
      .then((data) => {
        if (!active) return
        setKpiData([
          { title: "Completed bookings", value: data.completedBookings.toLocaleString(), change: `${data.completedBookingsChange}%`, trend: data.completedBookingsChange >= 0 ? "up" : "down", icon: Calendar, color: "text-primary", description: "Successfully completed" },
          { title: "Total sales", value: `₹${Math.round(data.totalRevenue).toLocaleString()}`, change: `${data.totalRevenueChange}%`, trend: data.totalRevenueChange >= 0 ? "up" : "down", icon: DollarSign, color: "text-secondary", description: "Gross booking revenue" },
          { title: "Net revenue", value: `₹${Math.round(data.netRevenue).toLocaleString()}`, change: `${data.netRevenueChange}%`, trend: data.netRevenueChange >= 0 ? "up" : "down", icon: TrendingUp, color: "text-chart-3", description: "Revenue after discounts" },
          { title: "CAC", value: `₹${Math.round(data.cac).toLocaleString()}`, change: `${data.cacChange}%`, trend: data.cacChange >= 0 ? "up" : "down", icon: Star, color: "text-chart-2", description: "Customer acquisition cost", onClickContent: <CACGraph title="Customer Acquisition Cost Trend" description="Month-over-month CAC variation" /> },
          { title: "Net P&L", value: `₹${Math.round(data.netPnL).toLocaleString()}`, change: `${data.netRevenueChange}%`, trend: data.netPnL >= 0 ? "up" : "down", icon: DollarSign, color: data.netPnL >= 0 ? "text-green-600" : "text-red-600", description: "After operating expenses" },
          { title: "Per order value", value: `₹${Math.round(data.perOrderValue).toLocaleString()}`, change: `${data.perOrderValueChange}%`, trend: data.perOrderValueChange >= 0 ? "up" : "down", icon: Users, color: "text-chart-4", description: "Average completed order" },
        ])
      })
      .catch((reason) => { console.error(reason); if (active) setError("Dashboard metrics could not be loaded.") })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fromDate, toDate, refreshKey])

  return <ProtectedRoute>
    <div className="flex min-h-screen w-full flex-col bg-slate-50/80">
      <div className="flex min-w-0 flex-1 flex-col sm:gap-4 sm:py-4">
        <AdminHeader title="Dashboard Overview" />
        <HomePageAlert />
        <main className="mx-auto w-full max-w-[1800px] flex-1 space-y-8 p-3 sm:p-5 lg:p-6">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-lg">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" /><div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="max-w-2xl"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10"><LayoutDashboard className="h-5 w-5" /></div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Business command centre</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Performance at a glance</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Track bookings, revenue, profitability, customers, partners, and daily operations from one responsive workspace.</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur-sm"><div className="mb-2 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300"><CalendarRange className="h-4 w-4" />Reporting period</p><Button type="button" variant="ghost" size="sm" onClick={() => setRefreshKey((value) => value + 1)} className="h-8 text-slate-200 hover:bg-white/10 hover:text-white"><RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div><div className="grid gap-3 sm:grid-cols-[minmax(145px,1fr)_auto_minmax(145px,1fr)_auto] sm:items-end"><div className="space-y-1.5"><Label htmlFor="dashboard-from" className="text-xs text-slate-300">From</Label><Input id="dashboard-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} max={toDate || formatDateInput(today)} className="border-white/15 bg-white text-slate-950" /></div><span className="hidden pb-2 text-xs text-slate-400 sm:block">to</span><div className="space-y-1.5"><Label htmlFor="dashboard-to" className="text-xs text-slate-300">To</Label><Input id="dashboard-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} min={fromDate || undefined} max={formatDateInput(today)} className="border-white/15 bg-white text-slate-950" /></div><Button variant="secondary" onClick={resetDates} className="bg-white text-slate-900 hover:bg-slate-100"><RotateCcw className="mr-2 h-4 w-4" />Reset</Button></div></div>
            </div>
          </section>

          <section className="space-y-4"><SectionHeading eyebrow="Overview" title="Business snapshot" description="Core performance indicators for the selected reporting period." />{error ? <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><Button variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>Try again</Button></div> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{loading ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />) : kpiData.map((kpi) => <KpiCard key={kpi.title} {...kpi} />)}</div>}</section>

          <section className="space-y-4"><SectionHeading eyebrow="Trends" title="Bookings and revenue movement" description="Six-month operational and revenue trends with historical navigation." /><div className="grid gap-4 xl:grid-cols-2"><ChartPlaceholder title="Monthly Bookings Trend" description="Booking volume over the selected range" icon={BarChart3} iconColor="text-blue-600" /><GraphPlaceholder title="Monthly Revenue Trend" description="Revenue from real completed bookings" icon={Activity} iconColor="text-indigo-600" /></div></section>

          <section className="space-y-4"><SectionHeading eyebrow="Financials" title="Profitability and expense mix" description="Compare settlements, expenses, and net profit across reporting periods." /><div className="grid gap-4 xl:grid-cols-2"><PnLGraph title="Net Profit & Loss Overview" description="Monthly earnings, expenses, and overall profit or loss trend" icon={BarChart3} /><ExpensePieChart /></div></section>

          <section className="space-y-4"><SectionHeading eyebrow="Today" title="Operational pulse" description="Partner performance and current-day availability." /><div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><TopPartnersCard /><DailyOverviewCard /></div></section>

          <section className="space-y-4"><SectionHeading eyebrow="Insights" title="Performance breakdown" description="Peak booking slots, leading categories, and customer behaviour." /><PerformanceMetrics fromDate={fromDate} toDate={toDate} /></section>

          <AiAnalysisChatbot module="dashboard" />
        </main>
      </div>
    </div>
  </ProtectedRoute>
}
