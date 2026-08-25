"use client"

import { useEffect, useState } from "react"
import { CalendarDays, CheckCircle2, Clock3, IndianRupee, Star, TrendingUp, UserCheck, XCircle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { fetchBookingStats, type BookingStats } from "@/lib/queries/fetchBookingStats"

type Props = { fromDate: string; toDate: string }

const visuals = [
  { icon: CalendarDays, style: "bg-blue-50 text-blue-600", accent: "bg-blue-500" },
  { icon: CheckCircle2, style: "bg-emerald-50 text-emerald-600", accent: "bg-emerald-500" },
  { icon: Clock3, style: "bg-amber-50 text-amber-600", accent: "bg-amber-500" },
  { icon: UserCheck, style: "bg-cyan-50 text-cyan-600", accent: "bg-cyan-500" },
  { icon: IndianRupee, style: "bg-violet-50 text-violet-600", accent: "bg-violet-500" },
  { icon: Star, style: "bg-yellow-50 text-yellow-600", accent: "bg-yellow-500" },
  { icon: TrendingUp, style: "bg-indigo-50 text-indigo-600", accent: "bg-indigo-500" },
  { icon: XCircle, style: "bg-red-50 text-red-600", accent: "bg-red-500" },
]

export default function BookingStatsView({ fromDate, toDate }: Props) {
  const [stats, setStats] = useState<BookingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    fetchBookingStats(fromDate, toDate)
      .then((data) => active && setStats(data))
      .catch((reason) => active && setError(reason?.message || "Failed to load booking statistics"))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fromDate, toDate])

  const cards = [
    { title: "Total bookings", value: stats?.totalBookings.toLocaleString() || "0", description: "Within selected period" },
    { title: "Completed", value: stats?.completedBookings.toLocaleString() || "0", description: "Successfully finished" },
    { title: "Pending", value: stats?.pendingBookings.toLocaleString() || "0", description: "Awaiting confirmation" },
    { title: "Accepted", value: stats?.confirmedBookings.toLocaleString() || "0", description: "Confirmed by partner" },
    { title: "Total revenue", value: `₹${Math.round(stats?.totalRevenue || 0).toLocaleString()}`, description: "Recorded booking revenue" },
    { title: "Average rating", value: stats?.averageRating ? stats.averageRating.toFixed(2) : "—", description: "Customer booking rating" },
    { title: "Completion rate", value: `${(stats?.completionRate || 0).toFixed(1)}%`, description: "Completed out of total" },
    { title: "Cancelled", value: stats?.cancelledByCustomer.toLocaleString() || "0", description: "Cancelled after acceptance" },
  ]

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>

  return (
    <section aria-label="Booking statistics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => {
        const visual = visuals[index]
        const Icon = visual.icon
        return <Card key={card.title} className="relative overflow-hidden border-slate-200 bg-white shadow-sm"><div className={`absolute inset-y-0 left-0 w-1 ${visual.accent}`} /><CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-500">{card.title}</p>{loading ? <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-100" /> : <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">{card.value}</p>}<p className="mt-1 truncate text-xs text-slate-400">{card.description}</p></div><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${visual.style}`}><Icon className="h-5 w-5" /></div></CardContent></Card>
      })}
    </section>
  )
}
