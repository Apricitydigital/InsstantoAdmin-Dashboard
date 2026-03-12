import Papa from "papaparse"
import { addMonths } from "date-fns"

/* ------------------------------
HELPERS
------------------------------ */

function monthKey(d: Date) {
const y = d.getFullYear()
const m = String(d.getMonth() + 1).padStart(2, "0")
return `${y}-${m}`
}

function parseSheetMonthToKey(raw: string, fallbackYear: number): string | null {
const s = (raw || "").trim()
if (!s) return null

if (/^\d{4}-\d{2}$/.test(s)) return s

const m = s.match(/^([A-Za-z]+)\s+(\d{2})$/)
if (m) {
const yy = Number(m[2])
const year = yy < 50 ? 2000 + yy : 1900 + yy
const d = new Date(`${m[1]} 1, ${year}`)
if (!isNaN(d.getTime())) return monthKey(d)
}

const d1 = new Date(`${s} 1`)
if (!isNaN(d1.getTime())) return monthKey(d1)

const d2 = new Date(`${s} 1, ${fallbackYear}`)
if (!isNaN(d2.getTime())) return monthKey(d2)

return null
}

/* ------------------------------
GOOGLE SHEET EXPENSES
------------------------------ */

async function fetchSheetExpenses() {
const SHEET_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv"

const sheetRes = await fetch(SHEET_URL)
const sheetText = await sheetRes.text()

const parsed = Papa.parse<Record<string, string>>(sheetText, {
header: true,
skipEmptyLines: true,
})

const rows = parsed.data
const expenseByMonth: Record<string, number> = {}

if (rows.length > 0) {
const columns = Object.keys(rows[0])
const monthCol = columns.find(c => c.toLowerCase().includes("month"))
const totalCol = columns.find(c => c.toLowerCase().includes("total"))


if (monthCol && totalCol) {
  for (const r of rows) {
    const rawMonth = r[monthCol]
    const rawTotal = r[totalCol]

    if (!rawMonth || !rawTotal) continue

    const total = parseFloat(rawTotal.replace(/,/g, "")) || 0
    if (total <= 0) continue

    const key = parseSheetMonthToKey(rawMonth, new Date().getFullYear())
    if (!key) continue

    expenseByMonth[key] = (expenseByMonth[key] || 0) + total
  }
}


}

return expenseByMonth
}

/* ------------------------------
RAZORPAY SETTLEMENTS
------------------------------ */

async function fetchSettlements(from: Date, to: Date) {
const keyId = process.env.RAZORPAY_KEY_ID!
const keySecret = process.env.RAZORPAY_KEY_SECRET!

const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")

const fromUnix = Math.floor(from.getTime() / 1000)
const toUnix = Math.floor(to.getTime() / 1000)

const LIMIT = 100
let skip = 0
let all: any[] = []

while (true) {
const params = new URLSearchParams({
count: LIMIT.toString(),
skip: skip.toString(),
from: fromUnix.toString(),
to: toUnix.toString(),
})


const res = await fetch(
  `https://api.razorpay.com/v1/settlements?${params}`,
  { headers: { Authorization: `Basic ${auth}` } }
)

if (!res.ok) break

const data = await res.json()
const items = data.items ?? []

all.push(...items)

if (items.length < LIMIT) break
skip += LIMIT


}

const settlementByMonth: Record<string, number> = {}

for (const s of all) {
const d = new Date(s.created_at * 1000)
const key = monthKey(d)


settlementByMonth[key] =
  (settlementByMonth[key] || 0) + (s.amount ?? 0) / 100


}

return settlementByMonth
}

/* ------------------------------
MAIN SHARED FUNCTION
------------------------------ */

export async function getPnLData() {

const now = new Date()
const start = addMonths(now, -11)

const expenseByMonth = await fetchSheetExpenses()
const settlementByMonth = await fetchSettlements(start, now)

const months = Array.from({ length: 12 }).map((_, i) =>
addMonths(start, i)
)

return months.map(d => {
const key = monthKey(d)

const expenses = expenseByMonth[key] || 0
const settlements = settlementByMonth[key] || 0

const netPnL = settlements - expenses

return {
  key,
  monthDate: d,
  expenses,
  settlements,
  netPnL,
}


})
}
