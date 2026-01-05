"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, CheckCircle, Users, DollarSign, Star, TrendingUp, XCircle } from "lucide-react"
import { fetchBookingStats, type BookingStats } from "@/lib/queries/fetchBookingStats"

type BookingStatsProps = {
  fromDate: string;
  toDate: string;
};

export default function BookingStats({ fromDate, toDate }: BookingStatsProps) {
  const [stats, setStats] = useState<BookingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // ✅ Pass date range to Firestore query
        const data = await fetchBookingStats(fromDate, toDate)
        if (mounted) setStats(data)
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load stats")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [fromDate, toDate])

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading stats…</div>
  if (error) return <div className="p-4 text-sm text-destructive">Error: {error}</div>
  if (!stats) return null

  const cards = [
    {
      title: "Total Bookings",
      value: stats.totalBookings.toLocaleString(),
      description: "All time bookings",
      icon: Calendar,
      color: "text-teal-600",
      bgColor: "bg-teal-100",
      borderColor: "border-teal-600"
    },
    {
      title: "Completed Bookings",
      value: stats.completedBookings.toLocaleString(),
      description: "Successfully finished",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      borderColor: "border-blue-600"
    },
    {
      title: "Pending Bookings",
      value: stats.pendingBookings,
      description: "Awaiting confirmation",
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      borderColor: "border-orange-600"
    },
    {
      title: "Accepted Bookings",
      value: stats.confirmedBookings.toLocaleString(),
      description: "Ready to start",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
      borderColor: "border-green-600"
    },
    {
      title: "Total Revenue",
      value: `₹${Math.round(stats.totalRevenue).toLocaleString()}`,
      description: "Sum of totalAmount",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
      borderColor: "border-emerald-600"
    },
    {
      title: "Avg. Rating",
      value: stats.averageRating ? stats.averageRating.toFixed(2) : "—",
      description: "Average of rating",
      icon: Star,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      borderColor: "border-yellow-600"
    },
    {
      title: "Completion Rate",
      value: `${stats.completionRate.toFixed(1)}%`,
      description: "Completed / Total",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      borderColor: "border-purple-600"
    },
    {
      title: "Cancelled Bookings",
      value: stats.cancelledBookings.toLocaleString(),
      description: "Cancelled After Service Accepted",
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
      borderColor: "border-red-600"
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card
          key={c.title}
          className={`border-l-4 ${c.borderColor} ${c.bgColor} shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
            <div className={`p-2 rounded-lg ${c.bgColor.replace("100", "200")}`}>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <p className="text-xs text-muted-foreground">{c.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}