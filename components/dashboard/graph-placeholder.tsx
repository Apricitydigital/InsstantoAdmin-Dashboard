"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon, ChevronLeft, ChevronRight } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts"
import { collection, query, where, getDocs, doc } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { Button } from "@/components/ui/button"

interface GraphPlaceholderProps {
  title: string
  description: string
  icon: LucideIcon
  iconColor?: string
  children?: React.ReactNode
  className?: string
}

type RevenuePoint = {
  month: string
  revenue: number
  walletUsed: number
  discount: number
  netRevenue: number
  changePct?: number | null
  changeDir?: "up" | "down" | "flat"
  changeLabel?: string
}

export function GraphPlaceholder({
  title,
  description,
  icon: Icon,
  iconColor = "text-primary/50",
  children,
  className = "",
}: GraphPlaceholderProps) {
  const [data, setData] = useState<RevenuePoint[]>([])
  const [monthOffset, setMonthOffset] = useState(0) // 👈 Shift by 6 months per click

  const fetchRevenueData = async (offset: number) => {
    const db = getFirestoreDb()

    const providerIds = [
      "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
      "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
      "VxxapfO7l8YM5f6xmFqpThc17eD3",
      "Q0kKYbdOKVbeZsdiLGsJoM5BWQl1",
      "7KlujhUyJbeCTPG6Pty8exlxXuM2",
      "fGLJCCFDEneQZ7ciz71Q29WBgGQ2",
      "MstGdrDCHkZ1KKf0xtZctauIovf2",

    ]
    const providerRefs = providerIds.map((id) => doc(db, "customer", id))

    const now = new Date()
    // Calculate date range based on offset
    const startOldest = new Date(now.getFullYear(), now.getMonth() - 5 - offset, 1)
    const endNewest = new Date(now.getFullYear(), now.getMonth() + 1 - offset, 1)

    const monthBuckets = Array.from({ length: 6 }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - 5 - offset + i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - 4 - offset + i, 1)
      const label = start.toLocaleString("default", { month: "short", year: "2-digit" })
      return { label, start, end }
    })

    const bookingsRef = collection(db, "bookings")
    const q = query(
      bookingsRef,
      where("provider_id", "in", providerRefs),
      where("status", "==", "Service_Completed")
    )
    const snap = await getDocs(q)

    const revenueByMonth: RevenuePoint[] = monthBuckets.map((m) => ({
      month: m.label,
      revenue: 0,
      walletUsed: 0,
      discount: 0,
      netRevenue: 0,
    }))

    snap.forEach((docSnap) => {
      const b = docSnap.data() as any
      const when: Date = b?.timeSlot?.toDate ? b.timeSlot.toDate() : new Date(b.timeSlot)
      if (!when) return

      const amt = Number(b?.amount_paid ?? 0) || 0
      const wallet = Number(b?.walletAmountUsed ?? 0) || 0
      const discount = Number(b?.discount_amount ?? 0) || 0

      const idx = monthBuckets.findIndex((m) => when >= m.start && when < m.end)
      if (idx !== -1) {
        revenueByMonth[idx].revenue += amt
        revenueByMonth[idx].walletUsed += wallet
        revenueByMonth[idx].discount += discount
        revenueByMonth[idx].netRevenue += amt - wallet - discount
      }
    })

    const withChanges: RevenuePoint[] = revenueByMonth.map((d, i, arr) => {
      if (i === 0) return { ...d, changePct: null, changeDir: "flat", changeLabel: "—" }
      const prev = arr[i - 1].revenue
      if (prev <= 0) return { ...d, changePct: null, changeDir: "flat", changeLabel: "—" }

      const pct = ((d.revenue - prev) / prev) * 100
      const roundedAbs = Math.abs(pct) < 10 ? Math.round(Math.abs(pct) * 10) / 10 : Math.round(Math.abs(pct))
      const dir: "up" | "down" | "flat" = pct > 0 ? "up" : pct < 0 ? "down" : "flat"
      const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "–"
      const label = dir === "flat" ? "0%" : `${arrow} ${roundedAbs}%`
      return { ...d, changePct: pct, changeDir: dir, changeLabel: label }
    })

    setData(withChanges)
  }

  useEffect(() => {
    fetchRevenueData(monthOffset)
  }, [monthOffset])

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(v)

  const renderChangeLabel = (props: any) => {
    const { x, y, index, value } = props
    if (value == null || index == null) return null
    const point: RevenuePoint | undefined = data[index]
    const color =
      point?.changeDir === "up" ? "#16a34a" : point?.changeDir === "down" ? "#dc2626" : "#6b7280"
    return (
      <text x={x} y={y - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill={color}>
        {value}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload as RevenuePoint
      const change =
        p?.changeDir === "up"
          ? `▲ ${Math.abs(p.changePct ?? 0).toFixed(1)}%`
          : p?.changeDir === "down"
            ? `▼ ${Math.abs(p.changePct ?? 0).toFixed(1)}%`
            : "—"

      return (
        <div className="bg-white border border-gray-300 p-2 rounded shadow">
          <p className="font-semibold">Month: {label}</p>
          <p style={{ color: "#8884d8" }}>
            Revenue: {formatCurrency(p.revenue)} ({change})
          </p>
          <p style={{ color: "#8884d8" }}>Net Revenue: {formatCurrency(p.netRevenue)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card
      className={`border-l-4 border-gray-300 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md ${className}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${iconColor.replace("/50", "")}`} />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

          {/* 👇 Month Navigation Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonthOffset((prev) => prev + 6)}
              title="Previous 6 months"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonthOffset((prev) => (prev > 0 ? prev - 6 : 0))}
              disabled={monthOffset === 0}
              title="Next 6 months"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {children || (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 40, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => formatCurrency(v).replace("₹", "₹ ")} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8884d8"
                  strokeWidth={3}
                  dot={{ r: 6, stroke: "#8884d8", strokeWidth: 2, fill: "#8884d8" }}
                  activeDot={{ r: 7 }}
                >
                  <LabelList dataKey="changeLabel" content={renderChangeLabel} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}