"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Heart, Loader2, Repeat, UserCheck, Users, XCircle } from "lucide-react"
import { fetchOperationalAnalytics, type OperationalAnalytics } from "@/lib/queries/analytics"

type Props = { fromDate: string; toDate: string }

export function OperationalMetrics({ fromDate, toDate }: Props) {
  const [data, setData] = useState<OperationalAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    fetchOperationalAnalytics(fromDate, toDate)
      .then((result) => active && setData(result))
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Operational analytics could not be loaded."))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fromDate, toDate])

  const metrics = data ? [
    { title: "Onboarded Partners", value: data.onboardedPartners.toLocaleString(), description: "Currently onboarded", icon: UserCheck, color: "text-primary", bg: "bg-primary/10" },
    { title: "Completed Bookings", value: data.completedBookings.toLocaleString(), description: "Selected period", icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
    { title: "Completion Rate", value: `${data.completionRate.toFixed(1)}%`, description: "Completed out of total", icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Customer Rating", value: data.totalRatings ? `${data.customerSatisfaction.toFixed(2)}/5` : "—", description: data.totalRatings ? `${data.totalRatings} ratings` : "No ratings in period", icon: Heart, color: "text-pink-600", bg: "bg-pink-100" },
    { title: "Repeat Customer Rate", value: `${data.repeatCustomerRate.toFixed(1)}%`, description: "Among customers who booked", icon: Repeat, color: "text-purple-600", bg: "bg-purple-100" },
    { title: "Cancellation Rate", value: `${data.cancellationRate.toFixed(1)}%`, description: "Cancelled out of total", icon: XCircle, color: "text-red-600", bg: "bg-red-100" },
  ] : []

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-chart-3" />Operational Metrics</CardTitle><CardDescription>Live booking, partner, customer and review indicators</CardDescription></CardHeader><CardContent>
    {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading operations…</div> : error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : <div className="grid gap-4 md:grid-cols-2">{metrics.map((metric) => <div key={metric.title} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"><div className={`rounded-lg p-2 ${metric.bg}`}><metric.icon className={`h-4 w-4 ${metric.color}`} /></div><div><p className="text-sm text-muted-foreground">{metric.title}</p><p className={`text-lg font-semibold ${metric.color}`}>{metric.value}</p><p className="text-xs text-muted-foreground">{metric.description}</p></div></div>)}</div>}
  </CardContent></Card>
}
