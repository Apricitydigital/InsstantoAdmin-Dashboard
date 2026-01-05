"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
} from "recharts"
import { Button } from "@/components/ui/button"

interface PnLGraphProps {
  title: string
  description: string
  icon: LucideIcon
  iconColor?: string
  className?: string
}

type PnLPoint = {
  month: string
  expenses: number
  settlements: number
  netPnL: number
  changePct?: number
  barTop?: number
}

export function PnLGraph({
  title,
  description,
  icon: Icon,
  iconColor = "text-primary/50",
  className = "",
}: PnLGraphProps) {
  const [data, setData] = useState<PnLPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/pnl")
        if (!res.ok) throw new Error("Failed to fetch P&L data")
        const { data } = await res.json()

        // ✅ Calculate net P&L and percentage change
        const enriched = data.map((d: PnLPoint, i: number, arr: PnLPoint[]) => {
          const prev = arr[i - 1]?.netPnL ?? 0
          const netPnL = d.settlements - d.expenses
          const changePct = i === 0 ? 0 : prev !== 0 ? ((netPnL - prev) / Math.abs(prev)) * 100 : 0
          const barTop = Math.max(d.expenses, d.settlements)
          return {
            ...d,
            netPnL,
            changePct: Math.round(changePct * 10) / 10,
            barTop,
          }
        })

        // ✅ Show last 6 months by default
        const startIndex = Math.max(0, enriched.length - 6)
        setData(enriched)
        setOffset(startIndex)
      } catch (e) {
        console.error("Error fetching P&L:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ✅ Determine average trend (for line color)
  const trendColor = useMemo(() => {
    if (!data.length) return "#6366f1"
    const validChanges = data.filter((d) => typeof d.changePct === "number").map((d) => d.changePct ?? 0)
    const avgChange = validChanges.reduce((a, b) => a + b, 0) / validChanges.length
    return avgChange >= 0 ? "#16a34a" : "#dc2626"
  }, [data])

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(v)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload as PnLPoint
      const color = p.netPnL >= 0 ? "#16a34a" : "#dc2626"
      return (
        <div className="bg-white border border-gray-300 p-2 rounded shadow text-sm">
          <p className="font-semibold">{label}</p>
          <p style={{ color: "#dc2626" }}>Expenses: {formatCurrency(p.expenses)}</p>
          <p style={{ color: "#16a34a" }}>Settlements: {formatCurrency(p.settlements)}</p>
          <p style={{ color }}>
            Net {p.netPnL >= 0 ? "Profit" : "Loss"}: {formatCurrency(Math.abs(p.netPnL))}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Change: {p.changePct! >= 0 ? "▲" : "▼"} {Math.abs(p.changePct!).toFixed(1)}%
          </p>
        </div>
      )
    }
    return null
  }

  const visibleData = data.slice(offset, offset + 6).map((d) => ({
    ...d,
    trendValue: d.netPnL + Math.max(d.expenses, d.settlements) * 0.05, // float line above bars
  }))

  const handlePrev = () => setOffset((prev) => Math.max(prev - 6, 0))
  const handleNext = () => setOffset((prev) => (prev + 6 < data.length ? prev + 6 : prev))

  return (
    <Card
      className={`relative border-l-4 border-gray-300 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md ${className}`}
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 z-50 rounded-md">
          <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
          <p className="text-sm text-gray-600">Loading Profit & Loss data...</p>
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

          {data.length > 6 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={handlePrev} disabled={offset === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={offset + 6 >= data.length}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[340px] w-full">
          {visibleData.length === 0 ? (
            <p className="text-center text-gray-500 mt-10">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visibleData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                {/* ✅ Strong Gradients */}
                <defs>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bc3131ff" stopOpacity={1} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="settlementGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14532d" stopOpacity={1} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={1} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => formatCurrency(v).replace("₹", "₹ ")} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {/* ✅ Rounded Bars */}
                <Bar
                  dataKey="expenses"
                  fill="url(#expenseGradient)"
                  name="Expenses"
                  radius={[10, 10, 0, 0]}
                  barSize={24}
                />
                <Bar
                  dataKey="settlements"
                  fill="url(#settlementGradient)"
                  name="Settlements"
                  radius={[10, 10, 0, 0]}
                  barSize={24}
                />

                {/* ✅ Real P&L Trend Line */}
                <Line
                  type="monotone"
                  dataKey="trendValue"
                  stroke={trendColor}
                  strokeWidth={4}
                  strokeLinecap="round"
                  dot={({ cx, cy, payload }) => {
                    const color = payload.changePct >= 0 ? "#22c55e" : "#ef4444"
                    return (
                      <>
                        <circle cx={cx} cy={cy} r={5} fill="#6366f1" stroke="white" strokeWidth={2} />
                        {payload.changePct !== 0 && (
                          <text
                            x={cx + 10}
                            y={cy - 6}
                            fontSize={12}
                            fontWeight={600}
                            fill={color}
                          >
                            {payload.changePct >= 0
                              ? `▲${Math.abs(payload.changePct)}%`
                              : `▼${Math.abs(payload.changePct)}%`}
                          </text>
                        )}
                      </>
                    )
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}