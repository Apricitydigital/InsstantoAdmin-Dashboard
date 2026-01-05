// app/api/pnl/route.ts
import { NextResponse } from "next/server"
import { addMonths, format } from "date-fns"

export async function GET() {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID!
    const keySecret = process.env.RAZORPAY_KEY_SECRET!
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")

    // ✅ Fetch monthly expense data from Google Sheet
    const SHEET_URL =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv"

    const res = await fetch(SHEET_URL)
    const text = await res.text()
    const rows = text.trim().split("\n").map((r) => r.split(","))
    const header = rows[0]
    const monthIndex = header.findIndex((c) => c.toLowerCase().includes("month"))
    const totalIndex = header.findIndex((c) => c.toLowerCase().includes("total"))
    const validRows = rows.slice(1).filter((r) => parseFloat(r[totalIndex]) > 0)

    // ✅ Collect all settlements in the last 12 months
    const now = new Date()
    const start = addMonths(now, -12)
    const from = Math.floor(start.getTime() / 1000)
    const to = Math.floor(now.getTime() / 1000)

    const LIMIT = 100
    let skip = 0
    let allSettlements: any[] = []

    while (true) {
      const params = new URLSearchParams()
      params.set("count", LIMIT.toString())
      params.set("skip", skip.toString())
      params.set("from", from.toString())
      params.set("to", to.toString())

      const response = await fetch(
        `https://api.razorpay.com/v1/settlements?${params.toString()}`,
        { headers: { Authorization: `Basic ${auth}` } }
      )

      if (!response.ok) break
      const data = await response.json()
      const items = data.items ?? []
      allSettlements.push(...items)
      if (items.length < LIMIT) break
      skip += LIMIT
    }

    console.log("✅ Total settlements fetched:", allSettlements.length)

    // ✅ Group settlements by month (sum all daily entries)
    const settlementByMonth: Record<string, number> = {}

    for (const s of allSettlements) {
      const date = new Date(s.created_at * 1000)
      const monthKey = format(date, "MMMM").toLowerCase() // e.g. "april"
      const amount = (s.amount ?? 0) / 100
      settlementByMonth[monthKey] = (settlementByMonth[monthKey] || 0) + amount
    }

    // ✅ Prepare 12-month structure
    const months = Array.from({ length: 12 }).map((_, i) =>
      format(addMonths(new Date(), -11 + i), "MMMM").toLowerCase()
    )

    // ✅ Combine expenses and settlements
    const pnlData = months.map((m) => {
      const expenseRow = validRows.find((r) =>
        r[monthIndex].trim().toLowerCase().includes(m)
      )
      const expenses = expenseRow ? parseFloat(expenseRow[totalIndex]) : 0
      const settlements = settlementByMonth[m] ?? 0
      const netPnL = expenses - settlements
      const status = netPnL >= 0 ? "loss" : "profit"

      return {
        month: m.charAt(0).toUpperCase() + m.slice(1, 3), // e.g. "Apr"
        expenses,
        settlements,
        netPnL,
        status,
      }
    })

    return NextResponse.json({ data: pnlData })
  } catch (err: any) {
    console.error("P&L API Error:", err)
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    )
  }
}