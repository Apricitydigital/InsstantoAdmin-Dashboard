"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Loader2, TrendingUp } from "lucide-react"
import { fetchRevenueAnalytics, type RevenuePoint } from "@/lib/queries/analytics"

type Props = { fromDate: string; toDate: string }

const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`

export function RevenueChart({ fromDate, toDate }: Props) {
  const [data, setData] = useState<RevenuePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    fetchRevenueAnalytics(fromDate, toDate)
      .then((result) => active && setData(result))
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Revenue analytics could not be loaded."))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fromDate, toDate])

  const totals = useMemo(() => {
    const comparable = data.map((item) => item.growth).filter((value): value is number => value !== null)
    return {
      gross: data.reduce((sum, item) => sum + item.revenue, 0),
      net: data.reduce((sum, item) => sum + item.netRevenue, 0),
      growth: comparable.length ? comparable.reduce((sum, value) => sum + value, 0) / comparable.length : null,
    }
  }, [data])

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />Revenue Analytics</CardTitle>
        <CardDescription>Sales and collected revenue from all non-cancelled bookings in live Firestore data</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading revenue analytics…</div> :
        error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div><p className="text-sm text-muted-foreground">Total sales</p><p className="text-2xl font-bold text-primary">{money(totals.gross)}</p></div>
            <div><p className="text-sm text-muted-foreground">Net revenue</p><p className="text-2xl font-bold text-emerald-600">{money(totals.net)}</p></div>
            <div><p className="text-sm text-muted-foreground">Average MoM growth</p><p className="flex items-center gap-1 text-2xl font-bold"><TrendingUp className="h-5 w-5" />{totals.growth === null ? "—" : `${totals.growth.toFixed(1)}%`}</p></div>
          </div>
          <div className="space-y-3">
            {data.map((item) => <div key={item.month} className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-4"><div className="flex h-12 w-16 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">{item.month}</div><div><p className="font-medium">{money(item.revenue)}</p><p className="text-sm text-muted-foreground">{money(item.netRevenue)} collected · {item.bookings} non-cancelled</p></div></div>
              <div className={`rounded-full px-2 py-1 text-sm font-medium ${item.growth === null ? "bg-muted text-muted-foreground" : item.growth >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{item.growth === null ? "Baseline" : `${item.growth >= 0 ? "+" : ""}${item.growth}%`}</div>
            </div>)}
            {!data.length && <p className="py-10 text-center text-sm text-muted-foreground">No non-cancelled bookings found in this period.</p>}
          </div>
        </>}
      </CardContent>
    </Card>
  )
}
