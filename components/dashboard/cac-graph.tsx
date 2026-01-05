"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts"
import { Button } from "@/components/ui/button"
import { fetchCustomerStats } from "@/lib/queries/customers"

type CACPoint = {
  month: string
  totalExpense: number
  newCustomers: number
  cac: number
  changePct?: number | null
  changeDir?: "up" | "down" | "flat"
  changeLabel?: string
}

interface CACGraphProps {
  title: string
  description: string
  icon: LucideIcon
  iconColor?: string
  className?: string
}

const cache = new Map<string, number>() // 🔹 Cache month → customers count

export function CACGraph({
  title,
  description,
  icon: Icon,
  iconColor = "text-primary/50",
  className = "",
}: CACGraphProps) {
  const [data, setData] = useState<CACPoint[]>([])
  const [monthOffset, setMonthOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchCACData = async (offset: number) => {
    try {
      setLoading(true)

      const sheetUrl =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv"
      const res = await fetch(sheetUrl)
      const text = await res.text()
      const rows = text.trim().split("\n").map((r) => r.split(","))
      const header = rows[0]
      const monthIndex = header.findIndex((col) => col.toLowerCase().includes("month"))
      const totalIndex = header.findIndex((col) => col.toLowerCase().includes("total"))
      const validRows = rows.slice(1).filter((r) => parseFloat(r[totalIndex]) > 0)

      const currentYear = new Date().getFullYear()
      const visibleRows = validRows.slice(-12 - offset, -offset || undefined)

      // ✅ Run all customer stats fetches in parallel
      const tasks = visibleRows.map(async (row) => {
        const monthName = row[monthIndex]
        const total = parseFloat(row[totalIndex])
        const monthIdx = new Date(`${monthName} 1, ${currentYear}`).getMonth()

        const start = new Date(currentYear, monthIdx, 1)
        const end = new Date(currentYear, monthIdx + 1, 0)
        const pad = (n: number) => String(n).padStart(2, "0")
        const fromDate = `${currentYear}-${pad(monthIdx + 1)}-01`
        const toDate = `${currentYear}-${pad(monthIdx + 1)}-${pad(end.getDate())}`

        // 🔹 Use cache if available
        if (cache.has(monthName)) {
          const cachedCustomers = cache.get(monthName)!
          return { month: monthName, totalExpense: total, newCustomers: cachedCustomers }
        }

        const { customersWithOneBooking } = await fetchCustomerStats(fromDate, toDate)
        cache.set(monthName, customersWithOneBooking)
        return { month: monthName, totalExpense: total, newCustomers: customersWithOneBooking }
      })

      const results = await Promise.all(tasks)

      // 🔹 Compute CAC + percentage changes
      const cacData: CACPoint[] = results.map((r) => ({
        ...r,
        cac: r.newCustomers > 0 ? r.totalExpense / r.newCustomers : 0,
      }))

      const withChanges: CACPoint[] = cacData.map((d, i, arr) => {
        if (i === 0) return { ...d, changePct: null, changeDir: "flat", changeLabel: "—" }
        const prev = arr[i - 1].cac
        if (prev <= 0) return { ...d, changePct: null, changeDir: "flat", changeLabel: "—" }

        const pct = ((d.cac - prev) / prev) * 100
        const roundedAbs = Math.abs(pct) < 10 ? Math.round(Math.abs(pct) * 10) / 10 : Math.round(Math.abs(pct))
        const dir: "up" | "down" | "flat" = pct > 0 ? "up" : pct < 0 ? "down" : "flat"
        const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "–"
        const label = dir === "flat" ? "0%" : `${arrow} ${roundedAbs}%`
        return { ...d, changePct: pct, changeDir: dir, changeLabel: label }
      })

      setData(withChanges)
    } catch (error) {
      console.error("Error fetching CAC data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCACData(monthOffset)
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
    const point: CACPoint | undefined = data[index]
    const color =
      point?.changeDir === "up" ? "#dc2626" : point?.changeDir === "down" ? "#16a34a" : "#6b7280"
    return (
      <text x={x} y={y - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill={color}>
        {value}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload as CACPoint
      const change =
        p?.changeDir === "up"
          ? `▲ ${Math.abs(p.changePct ?? 0).toFixed(1)}%`
          : p?.changeDir === "down"
          ? `▼ ${Math.abs(p.changePct ?? 0).toFixed(1)}%`
          : "—"

      return (
        <div className="bg-white border border-gray-300 p-2 rounded shadow">
          <p className="font-semibold">Month: {label}</p>
          <p style={{ color: "#8884d8" }}>CAC: {formatCurrency(p.cac)} ({change})</p>
          <p style={{ color: "#16a34a" }}>Customers: {p.newCustomers}</p>
          <p style={{ color: "#f97316" }}>Expense: {formatCurrency(p.totalExpense)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card
      className={`relative border-l-4 border-gray-300 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md ${className}`}
    >
      {/* Spinner Overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 z-50 rounded-md">
          <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
          <p className="text-sm text-gray-600">Loading CAC data...</p>
        </div>
      )}

      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${iconColor.replace("/50", "")}`} />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

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
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 40, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => formatCurrency(v).replace("₹", "₹ ")} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="cac"
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
      </CardContent>
    </Card>
  )
}