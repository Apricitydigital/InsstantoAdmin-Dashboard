"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart3, Loader2 } from "lucide-react"
import { fetchServiceAnalytics } from "@/lib/queries/analytics"
import type { TopCategory } from "@/lib/queries/top-services"

type Props = { fromDate: string; toDate: string }

export function ServicePerformance({ fromDate, toDate }: Props) {
  const [categories, setCategories] = useState<TopCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    fetchServiceAnalytics(fromDate, toDate)
      .then((result) => active && setCategories(result.slice(0, 5)))
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Service analytics could not be loaded."))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fromDate, toDate])

  const totalBookings = useMemo(() => categories.reduce((sum, item) => sum + item.totalBookings, 0), [categories])

  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-secondary" />Service Performance</CardTitle><CardDescription>Top completed-booking categories from live data</CardDescription></CardHeader>
    <CardContent>
      {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading services…</div> : error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p> :
      <div className="space-y-4">{categories.map((category) => {
        const share = totalBookings ? (category.totalBookings / totalBookings) * 100 : 0
        const averageValue = category.totalBookings ? category.totalRevenue / category.totalBookings : 0
        return <div key={category.categoryName} className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-3"><div><h4 className="font-medium">{category.categoryName}</h4><Badge variant="outline" className="mt-1 text-xs">Top service: {category.mostBookedService || "Not available"}</Badge></div><div className="text-right"><p className="font-semibold text-primary">₹{Math.round(category.totalRevenue).toLocaleString("en-IN")}</p><p className="text-sm text-muted-foreground">{category.totalBookings} bookings</p></div></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>{share.toFixed(1)}% of top-category bookings</span><span>₹{Math.round(averageValue).toLocaleString("en-IN")} avg.</span></div><Progress value={share} className="mt-2 h-2" />
        </div>
      })}{!categories.length && <p className="py-10 text-center text-sm text-muted-foreground">No completed services found in this period.</p>}</div>}
    </CardContent>
  </Card>
}
