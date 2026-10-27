"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { getAuth } from "firebase/auth"
import { collection, doc, DocumentData, DocumentReference, getDoc, onSnapshot, query } from "firebase/firestore"
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, Loader2, Search, ShieldCheck } from "lucide-react"

import { getFirestoreDb } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Props = {
  collectionName: "pending_bookings" | "web_pending_bookings"
  sourceLabel: "App" | "Web"
  fromDate: string
  toDate: string
}

type PendingBooking = {
  id: string; customerId: string; customer: string; phone: string
  service: string; serviceId: string; subCategoryId: string; cartId: string
  address: string; city: string; bookingAt: Date | null; slotAt: Date | null; slotLabel: string
  amount: number; servicePrice: number; tax: number; discount: number; walletAmount: number
  tip: number; partnerFare: number; credits: number; serviceCredits: number
  couponUsed: string; carType: string; chemicals: number
  latitude: number | null; longitude: number | null
  expectedAmount: number; expectedOnlineAmount: number
  razorpayOrderId: string; razorpayPaymentId: string; clientPaymentId: string
  status: string; createdAt: Date | null; updatedAt: Date | null
}

const PAGE_SIZE = 20

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate()
  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") return new Date(value.seconds * 1000)
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return ""
}

function number(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function nullableNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function mergedData(raw: DocumentData): DocumentData {
  const nested = raw.bookingData
  return nested && typeof nested === "object" && !Array.isArray(nested) ? { ...nested, ...raw } : raw
}

function referenceFrom(data: DocumentData): DocumentReference<DocumentData> | null {
  const value = data.customer_id ?? data.customerId ?? data.customer_ref ?? data.customerRef
  return value && typeof value === "object" && "path" in value ? value as DocumentReference<DocumentData> : null
}

function addressFrom(data: DocumentData) {
  const value = data.bookingAddress ?? data.booking_address ?? data.customer_address ?? data.address
  if (typeof value === "string") return value
  return value && typeof value === "object"
    ? text(value.formatted_address, value.formattedAddress, value.address, value.fullAddress)
    : ""
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"
}

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

function csvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === "" || value === null || value === undefined
  return <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 p-3"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{empty ? "—" : value}</dd></div>
}

export function PendingBookingTable({ collectionName, sourceLabel, fromDate, toDate }: Props) {
  const db = getFirestoreDb()
  const [records, setRecords] = useState<PendingBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<PendingBooking | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [recoverMessage, setRecoverMessage] = useState<{ id: string; ok: boolean; text: string } | null>(null)

  const recoverBooking = async (record: PendingBooking) => {
    if (busyId || record.status === "BOOKING_CREATED") return
    if (!window.confirm(`Verify payment and recover booking ${record.id}? This will update Firestore and cannot be undone.`)) return

    setBusyId(record.id)
    setRecoverMessage(null)
    try {
      const user = getAuth().currentUser
      if (!user) throw new Error("Admin session expired. Please sign in again.")

      const token = await user.getIdToken()
      const response = await fetch("/api/recover-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ collectionName, pendingId: record.id }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `Recovery failed (${response.status})`)

      setRecoverMessage({ id: record.id, ok: true, text: result.message || `Booking ${record.id} created successfully.` })
    } catch (cause) {
      setRecoverMessage({ id: record.id, ok: false, text: cause instanceof Error ? cause.message : "Recovery failed" })
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    setLoading(true)
    setError("")
    const unsubscribe = onSnapshot(query(collection(db, collectionName)), async (snapshot) => {
      try {
        const customerCache = new Map<string, Promise<DocumentData>>()
        const readCustomer = (reference: DocumentReference<DocumentData>) => {
          if (!customerCache.has(reference.path)) customerCache.set(reference.path, getDoc(reference).then((result) => result.exists() ? result.data() : {}))
          return customerCache.get(reference.path)!
        }

        const next = await Promise.all(snapshot.docs.map(async (record) => {
          const raw = record.data()
          const data = mergedData(raw)
          const reference = referenceFrom(raw) || referenceFrom(data)
          const customerId = reference?.id || text(raw.customerUid, raw.customer_uid, data.customerUid, data.customer_uid)
          const customer: DocumentData = reference
            ? await readCustomer(reference).catch(() => ({} as DocumentData))
            : customerId && !customerId.includes("/")
              ? await readCustomer(doc(db, "customer", customerId)).catch(() => ({} as DocumentData))
              : {}

          return {
            id: record.id,
            customerId,
            customer: text(data.customerName, data.customer_name, data.display_name, data.name, data.customer?.name, customer.customer_name, customer.display_name, customer.name),
            phone: text(data.customerPhone, data.customer_phone, data.phone_number, data.phone, data.contact_no, data.customer?.phone, customer.phone_number, customer.mobile_number, customer.contact_no, customer.phone),
            service: text(data.serviceName, data.service_name, data.subcategory_name, data.service_subcategory_name, data.categoryName, data.service_category_name, data.service?.name),
            serviceId: text(data.serviceId, data.service_id),
            subCategoryId: text(data.subCategoryId, data.sub_category_id),
            cartId: text(data.subCategoryCartId, data.subCategoryCart_id),
            address: addressFrom(data),
            city: text(data.city, data.cityName),
            bookingAt: parseDate(data.bookingDateMillis ?? data.bookingDate ?? data.booking_date),
            slotAt: parseDate(data.slotDateTimeMillis ?? data.slotDateTime ?? data.timeSlot),
            slotLabel: text(data.time, data.slotTime),
            amount: number(data.finalPaidAmount, data.amount_paid, data.amount, data.totalAmount, data.total_amount, data.finalAmount, data.subTotal, data.subtotal, data.price),
            servicePrice: number(data.totalservicePrice, data.totalServicePrice, data.servicePrice),
            tax: number(data.taxAmt, data.taxAmount, data.tax_amount),
            discount: number(data.discountAmount, data.discount_amount),
            walletAmount: number(data.walletAmount, data.walletAmountUsed, data.wallet_amount),
            tip: number(data.tip, data.tipAmount),
            partnerFare: number(data.partnerFare, data.partner_fare),
            credits: number(data.credits),
            serviceCredits: number(data.serviceCredits, data.service_credits),
            couponUsed: text(data.couponUsed, data.coupon_used),
            carType: text(data.carType, data.car_type),
            chemicals: number(data.chemicals1, data.chemicals),
            latitude: nullableNumber(data.bookingLat, data.latitude, data.lat),
            longitude: nullableNumber(data.bookingLng, data.longitude, data.lng),
            expectedAmount: number(raw.expectedAmountPaise, data.expectedAmountPaise) / 100,
            expectedOnlineAmount: number(raw.expectedOnlineAmount, data.expectedOnlineAmount) / 100,
            razorpayOrderId: text(raw.razorpayOrderId, data.razorpayOrderId),
            razorpayPaymentId: text(raw.razorpayPaymentId, data.razorpayPaymentId),
            clientPaymentId: text(raw.clientPaymentId, data.clientPaymentId),
            status: text(raw.status, data.bookingStatus, data.booking_status, data.status, data.payment_status) || "Pending",
            createdAt: parseDate(raw.createdAt ?? raw.created_at ?? raw.created_time ?? data.bookingDateMillis ?? data.bookingDate ?? data.date),
            updatedAt: parseDate(raw.updatedAt ?? raw.updated_at),
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
    }, (cause) => {
      console.error(`Failed to read ${collectionName}:`, cause)
      setError(cause.message || "Could not load pending bookings.")
      setLoading(false)
    })
    return unsubscribe
  }, [collectionName, db])

  const statuses = useMemo(() => [...new Set(records.map((record) => record.status).filter(Boolean))].sort(), [records])
  const filtered = useMemo(() => {
    const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const end = toDate ? new Date(`${toDate}T23:59:59.999`) : null
    const term = search.trim().toLowerCase()
    return records.filter((record) => {
      const matchesDate = !record.createdAt || ((!start || record.createdAt >= start) && (!end || record.createdAt <= end))
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(record.status)
      const matchesSearch = !term || [record.id, record.customerId, record.customer, record.phone, record.service, record.serviceId, record.address, record.city, record.razorpayOrderId, record.status].join(" ").toLowerCase().includes(term)
      return matchesDate && matchesStatus && matchesSearch
    }).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
  }, [fromDate, records, search, statusFilter, toDate])

  useEffect(() => setPage(1), [fromDate, search, statusFilter, toDate])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalValue = filtered.reduce((sum, record) => sum + record.amount, 0)

  const exportCsv = () => {
    const rows = filtered.map((r) => [r.id, sourceLabel, r.customer, r.customerId, r.phone, r.service, r.serviceId, r.subCategoryId, r.cartId, r.address, r.city, formatDate(r.bookingAt), formatDate(r.slotAt), r.slotLabel, r.amount, r.servicePrice, r.tax, r.discount, r.walletAmount, r.tip, r.partnerFare, r.credits, r.serviceCredits, r.couponUsed, r.carType, r.chemicals, r.latitude, r.longitude, r.expectedAmount, r.expectedOnlineAmount, r.razorpayOrderId, r.razorpayPaymentId, r.clientPaymentId, r.status, formatDate(r.createdAt), formatDate(r.updatedAt)])
    const headers = ["Booking ID", "Source", "Customer", "Customer UID", "Phone", "Service", "Service ID", "Subcategory ID", "Cart ID", "Address", "City", "Booking date", "Slot date", "Slot", "Paid amount", "Service price", "Tax", "Discount", "Wallet", "Tip", "Partner fare", "Credits", "Service credits", "Coupon used", "Car type", "Chemicals", "Latitude", "Longitude", "Expected amount", "Expected online amount", "Razorpay order ID", "Razorpay payment ID", "Client payment ID", "Status", "Created", "Updated"]
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${collectionName}_${fromDate}_to_${toDate}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <div className="space-y-4">
    <section className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Pending records</p><p className="mt-1 text-2xl font-bold text-slate-950">{filtered.length.toLocaleString()}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Source</p><p className="mt-1 text-2xl font-bold text-slate-950">{sourceLabel}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Recorded value</p><p className="mt-1 text-2xl font-bold text-slate-950">{formatMoney(totalValue)}</p></CardContent></Card>
    </section>

    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div><CardTitle className="flex items-center gap-2 text-lg"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><CalendarClock className="h-4 w-4" /></span>{sourceLabel} pending bookings</CardTitle><CardDescription className="mt-1">Live records from <code>{collectionName}</code></CardDescription></div>
        <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_180px_auto]">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pending bookings..." className="bg-slate-50 pl-9" /></div>
          <MultiSelectFilter aria-label={`Filter ${sourceLabel} pending bookings by status`} value={statusFilter} onValueChange={setStatusFilter} allLabel="All statuses" options={statuses.map((status) => ({ value: status, label: status }))} className="w-full sm:w-48" />
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="mr-2 h-4 w-4" />Export</Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-5">
        {recoverMessage && (
          <div role="status" className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${recoverMessage.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {recoverMessage.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span><strong>{recoverMessage.id}:</strong> {recoverMessage.text}</span>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table exportable={false} className="min-w-[1600px]">
            <TableHeader><TableRow className="bg-slate-50/80"><TableHead>Booking ID</TableHead><TableHead>Created</TableHead><TableHead>Slot</TableHead><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Service</TableHead><TableHead>City / address</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Recovery</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader>
            <TableBody>{loading
              ? <TableRow><TableCell colSpan={11} className="py-14 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading {sourceLabel.toLowerCase()} pending bookings...</TableCell></TableRow>
              : error ? <TableRow><TableCell colSpan={11} className="py-10 text-center text-red-600">{error}</TableCell></TableRow>
              : visible.length === 0 ? <TableRow><TableCell colSpan={11} className="py-14 text-center text-slate-500">No pending bookings found.</TableCell></TableRow>
              : visible.map((r) => <TableRow key={r.id}>
                <TableCell className="max-w-[190px] truncate font-medium" title={r.id}>{r.id}</TableCell><TableCell className="whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
                <TableCell className="whitespace-nowrap"><p>{r.slotLabel || formatDate(r.slotAt)}</p>{r.slotLabel && r.slotAt && <p className="text-xs text-slate-500">{formatDate(r.slotAt)}</p>}</TableCell>
                <TableCell><p>{r.customer || "—"}</p>{r.customerId && <p className="max-w-[160px] truncate text-xs text-slate-500" title={r.customerId}>{r.customerId}</p>}</TableCell><TableCell>{r.phone || "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate" title={r.service}>{r.service || "—"}</TableCell><TableCell className="max-w-[280px]"><p className="font-medium">{r.city || "—"}</p><p className="truncate text-xs text-slate-500" title={r.address}>{r.address || "—"}</p></TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(r.amount)}</TableCell><TableCell><Badge variant="secondary">{r.status}</Badge></TableCell><TableCell>
                  {r.status === "BOOKING_CREATED" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Created</span>
                  ) : (
                    <Button type="button" size="sm" variant="outline" className="gap-2 whitespace-nowrap" disabled={!!busyId || !r.razorpayOrderId} onClick={() => recoverBooking(r)} title={!r.razorpayOrderId ? "No Razorpay order ID; cannot verify payment" : "Server verifies captured payment and checks duplicates before creating"}>
                      {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      {busyId === r.id ? "Verifying…" : "Create Booking"}
                    </Button>
                  )}
                </TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setSelected(r)}><Eye className="mr-1 h-4 w-4" />View</Button></TableCell>
              </TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">Page {page} of {totalPages}{filtered.length > 0 && ` (${filtered.length.toLocaleString()} records)`}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>
      </CardContent>
    </Card>

    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Pending booking details</DialogTitle><DialogDescription>{selected ? `${sourceLabel} booking ${selected.id}` : "Complete pending booking information"}</DialogDescription></DialogHeader>
        {selected && <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Customer" value={selected.customer} /><Detail label="Customer UID" value={selected.customerId} /><Detail label="Phone" value={selected.phone} />
          <Detail label="Service" value={selected.service} /><Detail label="Service ID" value={selected.serviceId} /><Detail label="Subcategory ID" value={selected.subCategoryId} /><Detail label="Cart ID" value={selected.cartId} />
          <Detail label="City" value={selected.city} /><Detail label="Address" value={selected.address} /><Detail label="Coordinates" value={selected.latitude !== null && selected.longitude !== null ? `${selected.latitude}, ${selected.longitude}` : "—"} />
          <Detail label="Created" value={formatDate(selected.createdAt)} /><Detail label="Updated" value={formatDate(selected.updatedAt)} /><Detail label="Booking date" value={formatDate(selected.bookingAt)} /><Detail label="Slot date/time" value={formatDate(selected.slotAt)} /><Detail label="Slot label" value={selected.slotLabel} /><Detail label="Status" value={selected.status} />
          <Detail label="Final paid amount" value={formatMoney(selected.amount)} /><Detail label="Service price" value={formatMoney(selected.servicePrice)} /><Detail label="Tax" value={formatMoney(selected.tax)} /><Detail label="Discount" value={formatMoney(selected.discount)} /><Detail label="Wallet amount" value={formatMoney(selected.walletAmount)} /><Detail label="Tip" value={formatMoney(selected.tip)} /><Detail label="Partner fare" value={formatMoney(selected.partnerFare)} /><Detail label="Expected amount" value={formatMoney(selected.expectedAmount)} /><Detail label="Expected online amount" value={formatMoney(selected.expectedOnlineAmount)} />
          <Detail label="Credits" value={selected.credits} /><Detail label="Service credits" value={selected.serviceCredits} /><Detail label="Coupon used" value={selected.couponUsed} /><Detail label="Car type" value={selected.carType} /><Detail label="Chemicals" value={selected.chemicals} />
          <Detail label="Razorpay order ID" value={selected.razorpayOrderId} /><Detail label="Razorpay payment ID" value={selected.razorpayPaymentId} /><Detail label="Client payment ID" value={selected.clientPaymentId} />
        </dl>}
      </DialogContent>
    </Dialog>
  </div>
}
