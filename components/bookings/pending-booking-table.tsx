"use client"

import { useEffect, useMemo, useState } from "react"
import {
  collection,
  DocumentData,
  DocumentReference,
  getDoc,
  onSnapshot,
  query,
} from "firebase/firestore"
import { CalendarClock, ChevronLeft, ChevronRight, Download, Loader2, Search } from "lucide-react"

import { getFirestoreDb } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type PendingBookingTableProps = {
  collectionName: "pending_bookings" | "web_pending_bookings"
  sourceLabel: "App" | "Web"
  fromDate: string
  toDate: string
}

type PendingBooking = {
  id: string
  customer: string
  phone: string
  service: string
  address: string
  amount: number
  status: string
  createdAt: Date | null
}

const PAGE_SIZE = 20

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate()
  }
  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000)
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return ""
}

function amountFrom(data: DocumentData) {
  const value = data.amount_paid ?? data.amount ?? data.totalAmount ?? data.total_amount
    ?? data.finalAmount ?? data.subTotal ?? data.subtotal ?? data.price ?? 0
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function dateFrom(data: DocumentData) {
  return toDate(
    data.createdAt ?? data.created_at ?? data.created_time ?? data.date
      ?? data.bookingDate ?? data.booking_date ?? data.timestamp ?? data.timeSlot
  )
}

function addressFrom(data: DocumentData) {
  const value = data.bookingAddress ?? data.booking_address ?? data.customer_address ?? data.address
  if (typeof value === "string") return value
  if (value && typeof value === "object") {
    return firstText(value.formatted_address, value.formattedAddress, value.address, value.fullAddress)
  }
  return ""
}

function customerReference(data: DocumentData): DocumentReference<DocumentData> | null {
  const value = data.customer_id ?? data.customerId ?? data.customer_ref ?? data.customerRef
  return value && typeof value === "object" && "path" in value
    ? value as DocumentReference<DocumentData>
    : null
}

function formatDate(value: Date | null) {
  return value
    ? value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—"
}

function csvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

export function PendingBookingTable({
  collectionName,
  sourceLabel,
  fromDate,
  toDate,
}: PendingBookingTableProps) {
  const db = getFirestoreDb()
  const [records, setRecords] = useState<PendingBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    setError("")

    const unsubscribe = onSnapshot(
      query(collection(db, collectionName)),
      async (snapshot) => {
        try {
          const customerCache = new Map<string, Promise<DocumentData>>()
          const readCustomer = (reference: DocumentReference<DocumentData>) => {
            if (!customerCache.has(reference.path)) {
              customerCache.set(reference.path, getDoc(reference).then((result) => result.exists() ? result.data() : {}))
            }
            return customerCache.get(reference.path)!
          }

          const next = await Promise.all(snapshot.docs.map(async (record) => {
            const data = record.data()
            const reference = customerReference(data)
            const customerData: DocumentData = reference
              ? await readCustomer(reference).catch(() => ({} as DocumentData))
              : {}

            return {
              id: record.id,
              customer: firstText(
                data.customerName,
                data.customer_name,
                data.display_name,
                data.name,
                data.customer?.name,
                customerData.customer_name,
                customerData.display_name,
                customerData.name
              ),
              phone: firstText(
                data.customerPhone,
                data.customer_phone,
                data.phone_number,
                data.phone,
                data.contact_no,
                data.customer?.phone,
                customerData.phone_number,
                customerData.phone
              ),
              service: firstText(
                data.serviceName,
                data.service_name,
                data.subcategory_name,
                data.service_subcategory_name,
                data.categoryName,
                data.service_category_name,
                data.service?.name
              ),
              address: addressFrom(data),
              amount: amountFrom(data),
              status: firstText(data.bookingStatus, data.booking_status, data.status, data.payment_status) || "Pending",
              createdAt: dateFrom(data),
            } satisfies PendingBooking
          }))

          setRecords(next)
          setPage(1)
        } catch (cause) {
          console.error(`Failed to process ${collectionName}:`, cause)
          setError(cause instanceof Error ? cause.message : "Could not process pending bookings.")
        } finally {
          setLoading(false)
        }
      },
      (cause) => {
        console.error(`Failed to read ${collectionName}:`, cause)
        setError(cause.message || "Could not load pending bookings.")
        setLoading(false)
      }
    )

    return unsubscribe
  }, [collectionName, db])

  const statuses = useMemo(
    () => [...new Set(records.map((record) => record.status).filter(Boolean))].sort(),
    [records]
  )

  const filtered = useMemo(() => {
    const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const end = toDate ? new Date(`${toDate}T23:59:59.999`) : null
    const term = search.trim().toLowerCase()

    return records
      .filter((record) => {
        const matchesDate = !record.createdAt
          || ((!start || record.createdAt >= start) && (!end || record.createdAt <= end))
        const matchesStatus = statusFilter === "all" || record.status === statusFilter
        const matchesSearch = !term || [
          record.id,
          record.customer,
          record.phone,
          record.service,
          record.address,
          record.status,
        ].join(" ").toLowerCase().includes(term)
        return matchesDate && matchesStatus && matchesSearch
      })
      .sort((first, second) => (second.createdAt?.getTime() || 0) - (first.createdAt?.getTime() || 0))
  }, [fromDate, records, search, statusFilter, toDate])

  useEffect(() => setPage(1), [fromDate, search, statusFilter, toDate])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalValue = filtered.reduce((sum, record) => sum + record.amount, 0)

  const exportCsv = () => {
    const rows = filtered.map((record) => [
      record.id,
      sourceLabel,
      record.customer,
      record.phone,
      record.service,
      record.address,
      record.amount,
      record.status,
      formatDate(record.createdAt),
    ])
    const csv = [
      ["Booking ID", "Source", "Customer", "Phone", "Service", "Address", "Amount", "Status", "Created"],
      ...rows,
    ].map((row) => row.map(csvValue).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${collectionName}_${fromDate}_to_${toDate}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Pending records</p><p className="mt-1 text-2xl font-bold text-slate-950">{filtered.length.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Source</p><p className="mt-1 text-2xl font-bold text-slate-950">{sourceLabel}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Recorded value</p><p className="mt-1 text-2xl font-bold text-slate-950">₹{totalValue.toLocaleString("en-IN")}</p></CardContent></Card>
      </section>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><CalendarClock className="h-4 w-4" /></span>{sourceLabel} pending bookings</CardTitle>
            <CardDescription className="mt-1">Live records from <code>{collectionName}</code></CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_180px_auto]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pending bookings..." className="bg-slate-50 pl-9" /></div>
            <select aria-label={`Filter ${sourceLabel} pending bookings by status`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-md border border-input bg-white px-3 text-sm"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="mr-2 h-4 w-4" />Export</Button>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-5">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table exportable={false} className="min-w-[1200px]">
              <TableHeader><TableRow className="bg-slate-50/80"><TableHead>Booking ID</TableHead><TableHead>Created</TableHead><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Service</TableHead><TableHead>Address</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={8} className="py-14 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading {sourceLabel.toLowerCase()} pending bookings...</TableCell></TableRow>
                  : error ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-red-600">{error}</TableCell></TableRow>
                    : visible.length === 0 ? <TableRow><TableCell colSpan={8} className="py-14 text-center text-slate-500">No pending bookings found.</TableCell></TableRow>
                      : visible.map((record) => <TableRow key={record.id}><TableCell className="max-w-[190px] truncate font-medium" title={record.id}>{record.id}</TableCell><TableCell className="whitespace-nowrap">{formatDate(record.createdAt)}</TableCell><TableCell>{record.customer || "—"}</TableCell><TableCell>{record.phone || "—"}</TableCell><TableCell className="max-w-[220px] truncate" title={record.service}>{record.service || "—"}</TableCell><TableCell className="max-w-[260px] truncate" title={record.address}>{record.address || "—"}</TableCell><TableCell className="text-right font-semibold">₹{record.amount.toLocaleString("en-IN")}</TableCell><TableCell><Badge variant="secondary">{record.status}</Badge></TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">Page {page} of {totalPages}{filtered.length > 0 && ` (${filtered.length.toLocaleString()} records)`}</p>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
