"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, doc, DocumentData, DocumentReference, getDocs, query, Timestamp, where } from "firebase/firestore"
import { CalendarDays, ChevronLeft, ChevronRight, Download, IndianRupee, Loader2, Search, Users } from "lucide-react"
import * as XLSX from "xlsx"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getFirestoreDb } from "@/lib/firebase"

type CustomerDoc = {
  id: string
  uid?: string
  email?: string
  display_name?: string
  customer_name?: string
  phone_number?: string
  contact_no?: number
  created_time?: Timestamp
  photo_url?: string
  referralBy?: string
  referralCode?: string
}

type BookingDoc = {
  id: string
  customer_id?: DocumentReference<DocumentData> | string | null
  status?: string
  date?: Timestamp
  timeSlot?: Timestamp
  amount_paid?: number | string
}

type ReferralBooking = BookingDoc & { referredCustomer: CustomerDoc }

const PAGE_SIZE = 5
const COMPLETED_STATUSES = new Set(["completed", "service_completed", "service-completed"])

interface CustomerReferralsTabProps {
  customer: CustomerDoc
}

const toAmount = (value: unknown) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const toDate = (value?: Timestamp) => value?.toDate?.() || null

const isWithinRange = (value: Date | null, fromDate: string, toDateValue: string) => {
  if (!value) return !fromDate && !toDateValue
  const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null
  const end = toDateValue ? new Date(`${toDateValue}T23:59:59.999`) : null
  return (!start || value >= start) && (!end || value <= end)
}

const customerName = (customer: CustomerDoc) =>
  customer.display_name || customer.customer_name || "Unknown customer"

const customerPhone = (customer: CustomerDoc) =>
  customer.phone_number || (customer.contact_no ? String(customer.contact_no) : "—")

export function CustomerReferralsTab({ customer }: CustomerReferralsTabProps) {
  const db = getFirestoreDb()
  const [referredCustomers, setReferredCustomers] = useState<CustomerDoc[]>([])
  const [referredBookings, setReferredBookings] = useState<Record<string, BookingDoc[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDateValue, setToDateValue] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [bookingSearch, setBookingSearch] = useState("")
  const [customerPage, setCustomerPage] = useState(1)
  const [bookingPage, setBookingPage] = useState(1)

  useEffect(() => {
    if (!customer.id) return
    let active = true

    const fetchReferrals = async () => {
      setLoading(true)
      setError("")

      if (!customer.referralCode) {
        setReferredCustomers([])
        setReferredBookings({})
        setLoading(false)
        return
      }

      try {
        const referralSnapshot = await getDocs(query(collection(db, "customer"), where("referralBy", "==", customer.referralCode)))
        const referrals = referralSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })) as CustomerDoc[]

        const bookingEntries = await Promise.all(
          referrals.map(async (referral) => {
            const customerReference = doc(db, "customer", referral.id)
            const snapshots = await Promise.all([
              getDocs(query(collection(db, "bookings"), where("customer_id", "==", customerReference))),
              // Some older bookings store the customer ID as a string.
              getDocs(query(collection(db, "bookings"), where("customer_id", "==", referral.id))).catch(() => null),
            ])
            const uniqueBookings = new Map<string, BookingDoc>()
            snapshots.forEach((snapshot) => snapshot?.docs.forEach((bookingSnapshot) =>
              uniqueBookings.set(bookingSnapshot.id, { id: bookingSnapshot.id, ...bookingSnapshot.data() } as BookingDoc)
            ))
            return [referral.id, Array.from(uniqueBookings.values())] as const
          })
        )

        if (!active) return
        setReferredCustomers(referrals.sort((first, second) =>
          (toDate(second.created_time)?.getTime() || 0) - (toDate(first.created_time)?.getTime() || 0)
        ))
        setReferredBookings(Object.fromEntries(bookingEntries))
      } catch (reason) {
        console.error("Failed to load referral activity:", reason)
        if (active) {
          setReferredCustomers([])
          setReferredBookings({})
          setError("Unable to load referral customers and bookings.")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchReferrals()
    return () => { active = false }
  }, [customer.id, customer.referralCode, db])

  const hasInvalidRange = Boolean(fromDate && toDateValue && fromDate > toDateValue)

  const dateFilteredCustomers = useMemo(() => referredCustomers.filter((referral) =>
    !hasInvalidRange && isWithinRange(toDate(referral.created_time), fromDate, toDateValue)
  ), [fromDate, hasInvalidRange, referredCustomers, toDateValue])

  const dateFilteredBookings = useMemo<ReferralBooking[]>(() => {
    if (hasInvalidRange) return []
    return referredCustomers.flatMap((referral) =>
      (referredBookings[referral.id] || [])
        .filter((booking) => isWithinRange(toDate(booking.date), fromDate, toDateValue))
        .map((booking) => ({ ...booking, referredCustomer: referral }))
    ).sort((first, second) =>
      (toDate(second.date)?.getTime() || 0) - (toDate(first.date)?.getTime() || 0)
    )
  }, [fromDate, hasInvalidRange, referredBookings, referredCustomers, toDateValue])

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase()
    if (!term) return dateFilteredCustomers
    return dateFilteredCustomers.filter((referral) =>
      [referral.id, referral.uid, customerName(referral), referral.email, customerPhone(referral)].join(" ").toLowerCase().includes(term)
    )
  }, [customerSearch, dateFilteredCustomers])

  const filteredBookings = useMemo(() => {
    const term = bookingSearch.trim().toLowerCase()
    if (!term) return dateFilteredBookings
    return dateFilteredBookings.filter((booking) =>
      [booking.id, booking.status, customerName(booking.referredCustomer), booking.referredCustomer.email, customerPhone(booking.referredCustomer)]
        .join(" ").toLowerCase().includes(term)
    )
  }, [bookingSearch, dateFilteredBookings])

  const customerPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE))
  const bookingPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE))
  const paginatedCustomers = filteredCustomers.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE)
  const paginatedBookings = filteredBookings.slice((bookingPage - 1) * PAGE_SIZE, bookingPage * PAGE_SIZE)

  useEffect(() => setCustomerPage(1), [customerSearch, fromDate, toDateValue])
  useEffect(() => setBookingPage(1), [bookingSearch, fromDate, toDateValue])
  useEffect(() => { if (customerPage > customerPages) setCustomerPage(customerPages) }, [customerPage, customerPages])
  useEffect(() => { if (bookingPage > bookingPages) setBookingPage(bookingPages) }, [bookingPage, bookingPages])

  const referralRevenue = dateFilteredBookings
    .filter((booking) => COMPLETED_STATUSES.has(String(booking.status || "").toLowerCase()))
    .reduce((total, booking) => total + toAmount(booking.amount_paid), 0)

  const formatDate = (timestamp?: Timestamp) => toDate(timestamp)?.toLocaleString("en-IN", {
    dateStyle: "medium", timeStyle: "short",
  }) || "—"
  const formatCurrency = (amount: unknown) => `₹${toAmount(amount).toLocaleString("en-IN")}`

  const handleDownloadExcel = () => {
    const customerRows = filteredCustomers.map((referral) => ({
      "Customer ID": referral.id,
      Name: customerName(referral),
      Email: referral.email || "",
      Phone: customerPhone(referral),
      "Referred On": formatDate(referral.created_time),
      "Bookings In Range": dateFilteredBookings.filter((booking) => booking.referredCustomer.id === referral.id).length,
    }))
    const bookingRows = filteredBookings.map((booking) => ({
      "Booking ID": booking.id,
      "Referred Customer": customerName(booking.referredCustomer),
      "Customer ID": booking.referredCustomer.id,
      Date: formatDate(booking.date),
      Status: booking.status || "Unknown",
      "Amount Paid (₹)": toAmount(booking.amount_paid),
    }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customerRows), "Referred Customers")
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(bookingRows), "Referral Bookings")
    XLSX.writeFile(workbook, `referrals_${customer.id}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const Pagination = ({ page, pages, total, setPage }: { page: number; pages: number; total: number; setPage: (page: number) => void }) => (
    <div className="flex flex-col items-center justify-between gap-3 border-t p-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">Page {page} of {pages} · {total} result{total === 1 ? "" : "s"}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    </div>
  )

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Referral activity</h3>
          <p className="text-sm text-muted-foreground">Customers and bookings attributed to referral code {customer.referralCode || "—"}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span className="block">From date</span>
            <Input type="date" value={fromDate} max={toDateValue || undefined} onChange={(event) => setFromDate(event.target.value)} className="w-[155px] bg-white" />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span className="block">To date</span>
            <Input type="date" value={toDateValue} min={fromDate || undefined} onChange={(event) => setToDateValue(event.target.value)} className="w-[155px] bg-white" />
          </label>
          {(fromDate || toDateValue) && <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDateValue("") }}>Clear dates</Button>}
          <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={loading || hasInvalidRange}><Download className="mr-2 h-4 w-4" /> Export both lists</Button>
        </div>
      </div>

      {hasInvalidRange && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">The from date must be before or equal to the to date.</p>}

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Referred customers", value: dateFilteredCustomers.length.toLocaleString(), icon: Users, color: "bg-blue-50 text-blue-600" },
          { label: "Referral bookings", value: dateFilteredBookings.length.toLocaleString(), icon: CalendarDays, color: "bg-emerald-50 text-emerald-600" },
          { label: "Completed revenue", value: formatCurrency(referralRevenue), icon: IndianRupee, color: "bg-violet-50 text-violet-600" },
        ].map((stat) => (
          <Card key={stat.label} className="border-slate-200 shadow-sm"><CardContent className="flex items-center gap-4 p-4"><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color}`}><stat.icon className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="text-2xl font-bold">{stat.value}</p></div></CardContent></Card>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border bg-white text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading referral activity...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{error}</div>
      ) : !customer.referralCode ? (
        <div className="rounded-xl border bg-slate-50 p-8 text-center text-sm text-muted-foreground">This customer does not have a referral code yet.</div>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border bg-white">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h4 className="font-semibold">Referred customers</h4><p className="text-sm text-muted-foreground">Customers who joined using this referral code</p></div>
              <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customers..." className="pl-9" /></div>
            </div>
            <Table exportable={false}>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Referred on</TableHead><TableHead className="text-right">Bookings in range</TableHead></TableRow></TableHeader>
              <TableBody>
                {paginatedCustomers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No referred customers found in this date range.</TableCell></TableRow>
                ) : paginatedCustomers.map((referral) => {
                  const name = customerName(referral)
                  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
                  const bookingCount = dateFilteredBookings.filter((booking) => booking.referredCustomer.id === referral.id).length
                  return <TableRow key={referral.id}>
                    <TableCell><div className="flex items-center gap-3"><Avatar className="h-9 w-9"><AvatarImage src={referral.photo_url} alt={name} /><AvatarFallback>{initials || "CU"}</AvatarFallback></Avatar><div><p className="font-medium">{name}</p><p className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">{referral.uid || referral.id}</p></div></div></TableCell>
                    <TableCell>{referral.email || "—"}</TableCell><TableCell>{customerPhone(referral)}</TableCell><TableCell>{formatDate(referral.created_time)}</TableCell><TableCell className="text-right font-medium">{bookingCount}</TableCell>
                  </TableRow>
                })}
              </TableBody>
            </Table>
            <Pagination page={customerPage} pages={customerPages} total={filteredCustomers.length} setPage={setCustomerPage} />
          </section>

          <section className="overflow-hidden rounded-xl border bg-white">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h4 className="font-semibold">Bookings from referrals</h4><p className="text-sm text-muted-foreground">Bookings placed by customers referred by this customer</p></div>
              <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} placeholder="Search bookings..." className="pl-9" /></div>
            </div>
            <Table exportable={false}>
              <TableHeader><TableRow><TableHead>Booking ID</TableHead><TableHead>Referred customer</TableHead><TableHead>Booking date</TableHead><TableHead>Time slot</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount paid</TableHead></TableRow></TableHeader>
              <TableBody>
                {paginatedBookings.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No referral bookings found in this date range.</TableCell></TableRow>
                ) : paginatedBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="max-w-[180px] truncate font-mono text-xs" title={booking.id}>{booking.id}</TableCell>
                    <TableCell><p className="font-medium">{customerName(booking.referredCustomer)}</p><p className="text-xs text-muted-foreground">{customerPhone(booking.referredCustomer)}</p></TableCell>
                    <TableCell>{formatDate(booking.date)}</TableCell><TableCell>{formatDate(booking.timeSlot)}</TableCell>
                    <TableCell><Badge variant={COMPLETED_STATUSES.has(String(booking.status || "").toLowerCase()) ? "default" : "secondary"}>{String(booking.status || "Unknown").replaceAll("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(booking.amount_paid)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={bookingPage} pages={bookingPages} total={filteredBookings.length} setPage={setBookingPage} />
          </section>
        </>
      )}
    </div>
  )
}
