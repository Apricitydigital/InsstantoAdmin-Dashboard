"use client"

import { useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminHeader } from "@/components/admin-header"
import { RevenueChart } from "@/components/analytics/revenue-chart"
import { ServicePerformance } from "@/components/analytics/service-performance"
import { OperationalMetrics } from "@/components/analytics/operational-metrics"
import { MarketingMetrics } from "@/components/analytics/marketing-metrics"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function dateValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function initialRange() {
  const to = new Date()
  const from = new Date(to.getFullYear(), to.getMonth() - 5, 1)
  return { from: dateValue(from), to: dateValue(to) }
}

export default function AnalyticsPage() {
  const [range, setRange] = useState(initialRange)

  return <ProtectedRoute requiredPermission="analytics:view"><div className="flex min-h-screen w-full flex-col bg-muted/40"><div className="flex flex-col sm:gap-4 sm:py-4"><AdminHeader title="Analytics Hub" /><main className="flex-1 space-y-4 p-4 md:p-6">
    <section className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-semibold">Live business analytics</h1><p className="mt-1 text-sm text-muted-foreground">All displayed figures come from connected dashboard data. External-file metrics are marked as pending.</p></div><div className="grid grid-cols-2 gap-3"><label className="space-y-1"><Label htmlFor="analytics-from">From</Label><Input id="analytics-from" type="date" value={range.from} max={range.to} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label><label className="space-y-1"><Label htmlFor="analytics-to">To</Label><Input id="analytics-to" type="date" value={range.to} min={range.from} max={dateValue(new Date())} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label></div></section>
    <div className="grid gap-4 md:grid-cols-3"><RevenueChart fromDate={range.from} toDate={range.to} /><ServicePerformance fromDate={range.from} toDate={range.to} /></div>
    <div className="grid gap-4 xl:grid-cols-2"><OperationalMetrics fromDate={range.from} toDate={range.to} /><MarketingMetrics fromDate={range.from} toDate={range.to} /></div>
  </main></div></div></ProtectedRoute>
}
