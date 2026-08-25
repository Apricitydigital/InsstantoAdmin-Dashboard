"use client"

import { useEffect, useMemo, useState } from "react"
import { IndianRupee, Megaphone, UserRoundCheck, Rows3 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

type SheetBooking = { bookingDate: string; employeeName: string; leadSource: string; amount: number }
type Props = { fromDate: string; toDate: string }

const visuals = [
  { icon: Rows3, style: "bg-blue-50 text-blue-600", accent: "bg-blue-500" },
  { icon: IndianRupee, style: "bg-emerald-50 text-emerald-600", accent: "bg-emerald-500" },
  { icon: UserRoundCheck, style: "bg-violet-50 text-violet-600", accent: "bg-violet-500" },
  { icon: Megaphone, style: "bg-amber-50 text-amber-600", accent: "bg-amber-500" },
]

export default function SheetBookingStats({ fromDate, toDate }: Props) {
  const [data, setData] = useState<SheetBooking[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/bookings/sheet?from=${fromDate}&to=${toDate}`)
      .then((response) => response.json())
      .then((result) => active && setData(result.data || []))
      .catch((reason) => { console.error("Failed to load sheet statistics", reason); if (active) setData([]) })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fromDate, toDate])

  const stats = useMemo(() => {
    const employees: Record<string, number> = {}
    const sources: Record<string, number> = {}
    let revenue = 0
    data.forEach((booking) => {
      revenue += booking.amount || 0
      if (booking.employeeName) employees[booking.employeeName] = (employees[booking.employeeName] || 0) + 1
      if (booking.leadSource) sources[booking.leadSource] = (sources[booking.leadSource] || 0) + 1
    })
    return {
      total: data.length,
      revenue,
      employee: Object.entries(employees).sort((a, b) => b[1] - a[1])[0]?.[0] || "—",
      source: Object.entries(sources).sort((a, b) => b[1] - a[1])[0]?.[0] || "—",
    }
  }, [data])

  const cards = [
    { title: "Sheet bookings", value: stats.total.toLocaleString(), description: "Rows in selected period" },
    { title: "Recorded revenue", value: `₹${stats.revenue.toLocaleString()}`, description: "Sheet service total" },
    { title: "Top employee", value: stats.employee, description: "Most assigned bookings" },
    { title: "Top lead source", value: stats.source, description: "Highest booking source" },
  ]

  return <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card, index) => { const visual = visuals[index]; const Icon = visual.icon; return <Card key={card.title} className="relative overflow-hidden border-slate-200 shadow-sm"><div className={`absolute inset-y-0 left-0 w-1 ${visual.accent}`} /><CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-500">{card.title}</p>{loading ? <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-100" /> : <p className="mt-1 truncate text-2xl font-bold text-slate-950">{card.value}</p>}<p className="mt-1 truncate text-xs text-slate-400">{card.description}</p></div><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${visual.style}`}><Icon className="h-5 w-5" /></div></CardContent></Card> })}</section>
}
