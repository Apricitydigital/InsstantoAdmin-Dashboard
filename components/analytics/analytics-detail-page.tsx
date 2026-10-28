"use client"

import { useState } from "react"
import { AdminHeader } from "@/components/admin-header"
import { MarketingMetrics } from "@/components/analytics/marketing-metrics"
import { OperationalMetrics } from "@/components/analytics/operational-metrics"
import { RevenueChart } from "@/components/analytics/revenue-chart"
import { ServicePerformance } from "@/components/analytics/service-performance"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AnalyticsKind = "revenue" | "operations" | "services" | "marketing"

const titles: Record<AnalyticsKind, string> = {
  revenue: "Revenue Analytics",
  operations: "Operations Analytics",
  services: "Service Performance",
  marketing: "Marketing Analytics",
}

const descriptions: Record<AnalyticsKind, string> = {
  revenue: "Sales and collected revenue from all non-cancelled bookings.",
  operations: "Booking fulfilment, customer retention, ratings and partner supply.",
  services: "Live category performance based on non-cancelled bookings.",
  marketing: "Connected acquisition data and external metrics awaiting source files.",
}

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

export function AnalyticsDetailPage({ kind }: { kind: AnalyticsKind }) {
  const [range, setRange] = useState(initialRange)

  return <ProtectedRoute requiredPermission="analytics:view">
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <AdminHeader title={titles[kind]} />
        <main className="flex-1 space-y-4 p-4 md:p-6">
          <section className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-xl font-semibold">{titles[kind]}</h1><p className="mt-1 text-sm text-muted-foreground">{descriptions[kind]}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1"><Label htmlFor={`${kind}-from`}>From</Label><Input id={`${kind}-from`} type="date" value={range.from} max={range.to} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label>
              <label className="space-y-1"><Label htmlFor={`${kind}-to`}>To</Label><Input id={`${kind}-to`} type="date" value={range.to} min={range.from} max={dateValue(new Date())} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label>
            </div>
          </section>
          {kind === "revenue" && <div className="grid gap-4 md:grid-cols-2"><RevenueChart fromDate={range.from} toDate={range.to} /></div>}
          {kind === "operations" && <OperationalMetrics fromDate={range.from} toDate={range.to} />}
          {kind === "services" && <ServicePerformance fromDate={range.from} toDate={range.to} />}
          {kind === "marketing" && <MarketingMetrics fromDate={range.from} toDate={range.to} />}
        </main>
      </div>
    </div>
  </ProtectedRoute>
}
