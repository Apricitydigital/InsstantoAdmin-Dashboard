"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, FileSpreadsheet, IndianRupee, Loader2, MapPin, Phone, Search, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type SheetBooking = { id: string; bookingDate: string; customerName: string; service: string; phone: string; address: string; partnerName: string; source: string; amount: number; arriveTime: string; status: string; feedback: string }
type Props = { fromDate: string; toDate: string }
const PAGE_SIZE = 10

export function SheetBookingTable({ fromDate, toDate }: Props) {
  const [data, setData] = useState<SheetBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/bookings/sheet?from=${fromDate}&to=${toDate}`)
      .then((response) => response.json())
      .then((result) => {
        if (!active) return
        setData((result.data || []).map((booking: any) => ({
          id: booking.id, bookingDate: booking.bookingDate, customerName: booking.customerName || "", service: booking.service || "", phone: booking.phone || "", address: booking.address || "", partnerName: booking.partnerName || "", source: booking.source || "", amount: Number(booking.amount) || 0, arriveTime: booking.arriveTime || "", status: booking.status || "", feedback: booking.feedback || "",
        })))
        setPage(1)
      })
      .catch((reason) => { console.error("Sheet booking fetch failed", reason); if (active) setData([]) })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fromDate, toDate])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return data.filter((booking) => [booking.id, booking.customerName, booking.phone, booking.service, booking.source, booking.partnerName].join(" ").toLowerCase().includes(term)).sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
  }, [data, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const bookings = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return <Card className="overflow-hidden border-slate-200 shadow-sm">
    <CardHeader className="gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
      <div><CardTitle className="flex items-center gap-2 text-lg"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><FileSpreadsheet className="h-4 w-4" /></span>Sheet booking records</CardTitle><CardDescription className="mt-1">{filtered.length.toLocaleString()} matching record{filtered.length === 1 ? "" : "s"}</CardDescription></div>
      <div className="relative w-full lg:w-96"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search customer, service, source or partner" className="bg-slate-50 pl-9" /></div>
    </CardHeader>
    <CardContent className="p-3 sm:p-5">
      {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading sheet bookings...</div> : <>
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block"><Table exportable={false} className="min-w-[1450px]"><TableHeader><TableRow className="bg-slate-50/80"><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Service</TableHead><TableHead>Contact</TableHead><TableHead>Address</TableHead><TableHead>Partner</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Price</TableHead><TableHead>Arrival</TableHead><TableHead>Status</TableHead><TableHead>Feedback</TableHead></TableRow></TableHeader><TableBody>{bookings.length === 0 ? <TableRow><TableCell colSpan={11} className="py-12 text-center text-slate-500">No bookings found.</TableCell></TableRow> : bookings.map((booking) => <TableRow key={booking.id} className="hover:bg-slate-50/70"><TableCell className="whitespace-nowrap">{new Date(booking.bookingDate).toLocaleDateString("en-IN")}</TableCell><TableCell className="font-medium">{booking.customerName || "—"}</TableCell><TableCell className="max-w-[220px] truncate">{booking.service || "—"}</TableCell><TableCell>{booking.phone || "—"}</TableCell><TableCell className="max-w-[220px] truncate" title={booking.address}>{booking.address || "—"}</TableCell><TableCell>{booking.partnerName || "—"}</TableCell><TableCell>{booking.source || "—"}</TableCell><TableCell className="text-right font-semibold">₹{booking.amount.toLocaleString()}</TableCell><TableCell>{booking.arriveTime || "—"}</TableCell><TableCell><Badge variant="secondary">{booking.status || "—"}</Badge></TableCell><TableCell className="max-w-[240px] truncate" title={booking.feedback}>{booking.feedback || "—"}</TableCell></TableRow>)}</TableBody></Table></div>
        <div className="grid gap-3 md:hidden">{bookings.length === 0 ? <div className="rounded-xl border border-dashed py-12 text-center text-sm text-slate-500">No bookings found.</div> : bookings.map((booking) => <article key={booking.id} className="rounded-xl border border-slate-200 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-slate-950">{booking.customerName || "Unknown customer"}</p><p className="mt-1 truncate text-sm text-slate-500">{booking.service || "Service unavailable"}</p></div><Badge variant="secondary">{booking.status || "Unknown"}</Badge></div><div className="my-4 grid gap-2 text-sm text-slate-600"><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" />{new Date(booking.bookingDate).toLocaleDateString("en-IN")} {booking.arriveTime}</p><p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{booking.phone || "Phone unavailable"}</p><p className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{booking.address || "Address unavailable"}</span></p><p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" />{booking.partnerName || "Partner unassigned"}</p></div><div className="flex items-center justify-between border-t pt-3 text-sm"><span className="text-slate-500">{booking.source || "No source"}</span><span className="flex items-center font-bold"><IndianRupee className="h-4 w-4" />{booking.amount.toLocaleString()}</span></div></article>)}</div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">Page <span className="font-medium text-slate-900">{page}</span> of {totalPages || 1}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= (totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>
      </>}
    </CardContent>
  </Card>
}
