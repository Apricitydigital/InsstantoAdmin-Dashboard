"use client"

import { useEffect, useState } from "react"
import { CalendarDays, ListChecks, UserPlus, Users } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { fetchCustomerStats } from "@/lib/queries/customers"

type Stats = { totalCustomers: number; newCustomersToday: number; customersWithOneBooking: number; customersWithMultipleBookings: number }

interface CustomerStatsProps { fromDate: string; toDate: string }

const cardStyles = [
  { icon: Users, iconClass: "bg-blue-50 text-blue-600", accent: "bg-blue-500" },
  { icon: CalendarDays, iconClass: "bg-emerald-50 text-emerald-600", accent: "bg-emerald-500" },
  { icon: UserPlus, iconClass: "bg-amber-50 text-amber-600", accent: "bg-amber-500" },
  { icon: ListChecks, iconClass: "bg-violet-50 text-violet-600", accent: "bg-violet-500" },
]

export function CustomerStats({ fromDate, toDate }: CustomerStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchCustomerStats(fromDate, toDate).then((data) => active && setStats(data)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fromDate, toDate])

  const items = [
    { title: "Total sign-ups", value: stats?.totalCustomers ?? 0, description: "Registered in this period" },
    { title: "Today's sign-ups", value: stats?.newCustomersToday ?? 0, description: "New accounts today" },
    { title: "New customers", value: stats?.customersWithOneBooking ?? 0, description: "Exactly one booking" },
    { title: "Repeat customers", value: stats?.customersWithMultipleBookings ?? 0, description: "Multiple bookings" },
  ]

  return (
    <section aria-label="Customer statistics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const style = cardStyles[index]
        const Icon = style.icon
        return (
          <Card key={item.title} className="relative overflow-hidden border-slate-200 bg-white shadow-sm">
            <div className={`absolute inset-y-0 left-0 w-1 ${style.accent}`} />
            <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-500">{item.title}</p>
                {loading ? <div className="mt-2 h-8 w-16 animate-pulse rounded-md bg-slate-100" /> : <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{item.value.toLocaleString()}</p>}
                <p className="mt-1 truncate text-xs text-slate-400">{item.description}</p>
              </div>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconClass}`}><Icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
