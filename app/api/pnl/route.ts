import { NextResponse } from "next/server"
import { format } from "date-fns"
import { getPnLData } from "@/lib/queries/getPnLdata"

export async function GET() {

const pnl = await getPnLData()

const data = pnl.map(m => ({
month: format(m.monthDate, "MMM yyyy"),
expenses: +m.expenses.toFixed(2),
settlements: +m.settlements.toFixed(2),
netPnL: +m.netPnL.toFixed(2),
}))

return NextResponse.json({ data })
}
