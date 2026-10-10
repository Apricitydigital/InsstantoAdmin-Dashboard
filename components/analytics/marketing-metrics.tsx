"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, FileClock, Loader2, MessageCircle, TrendingUp, Users } from "lucide-react"
import { fetchDailyWhatsAppReport, fetchMarketingAnalytics, type MarketingAnalytics } from "@/lib/queries/analytics"
import { useToast } from "@/hooks/use-toast"

type Props = { fromDate: string; toDate: string }

export function MarketingMetrics({ fromDate, toDate }: Props) {
  const [data, setData] = useState<MarketingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sendingReport, setSendingReport] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    fetchMarketingAnalytics(fromDate, toDate)
      .then((result) => active && setData(result))
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Marketing analytics could not be loaded."))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fromDate, toDate])

  async function handleSendWhatsAppReport() {
    setSendingReport(true)
    try {
      const report = await fetchDailyWhatsAppReport()
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedBookings: report.totalBookings,
          cancelledBookings: report.cancelledBookings,
          totalBookingAmount: report.totalBookingAmount,
          netProfit: report.netProfit,
          marginPercentage: report.marginPercentage,
          avgOrderValue: report.avgOrderValue,
          customerAcquisitionCost: report.customerAcquisitionCost,
          cleaning: report.cleaning,
          electrical: report.electrical,
          security: report.security,
          driver: report.driver,
          maid: report.maid,
          totalComplaints: report.totalComplaints,
          resolvedComplaints: report.resolvedComplaints,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to send WhatsApp report")
      toast({ title: "Success", description: "WhatsApp report sent successfully." })
    } catch (cause) {
      toast({
        title: "Error",
        description: cause instanceof Error ? cause.message : "Failed to send WhatsApp report",
        variant: "destructive",
      })
    } finally {
      setSendingReport(false)
    }
  }

  return <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-chart-4" />Marketing Analytics</CardTitle><CardDescription>Live customer acquisition data plus pending external sources</CardDescription></div><div className="flex items-center gap-2"><Badge variant="outline">Partially connected</Badge><Button onClick={handleSendWhatsAppReport} disabled={sendingReport} variant="outline" size="sm">{sendingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}{sendingReport ? "Sending..." : "Send WhatsApp Report"}</Button></div></div></CardHeader><CardContent>
    {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading customer acquisition…</div> : error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-muted/50 p-3"><Users className="mb-2 h-4 w-4 text-primary" /><p className="text-sm text-muted-foreground">Customer sign-ups</p><p className="text-2xl font-bold">{data?.customerSignUps.toLocaleString() ?? 0}</p></div><div className="rounded-lg bg-muted/50 p-3"><TrendingUp className="mb-2 h-4 w-4 text-emerald-600" /><p className="text-sm text-muted-foreground">Customers with bookings</p><p className="text-2xl font-bold">{data?.acquiredCustomers.toLocaleString() ?? 0}</p></div><div className="rounded-lg bg-muted/50 p-3"><CreditCard className="mb-2 h-4 w-4 text-violet-600" /><p className="text-sm text-muted-foreground">Dashboard CAC</p><p className="text-2xl font-bold">{data?.customerAcquisitionCost === null ? "—" : `₹${Math.round(data?.customerAcquisitionCost ?? 0).toLocaleString("en-IN")}`}</p></div></div>
      <div className="rounded-lg border border-dashed p-4"><div className="flex gap-3"><FileClock className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><p className="font-medium">External marketing files pending</p><p className="mt-1 text-sm text-muted-foreground">Ad spend, lead source, campaign conversion, ROAS, organic/paid traffic and lifetime value will remain blank until their source files are attached and mapped. No dummy values are displayed.</p></div></div></div>
    </div>}
  </CardContent></Card>
}
