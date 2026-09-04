"use client"

import { useEffect, useState, useMemo } from "react"
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  documentId,
  Timestamp,
  DocumentReference,
  DocumentData,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Phone, Calendar, Search, Filter, ChevronDown, Eye, MapPin, Clock3, IndianRupee, RotateCcw } from "lucide-react"
import { DetailsSheet } from "@/components/bookings/booking-component"

// ✅ import from partner.ts
import { getOnboardedPartnerIdSet } from "@/lib/queries/partners"

// ---------- Types ----------
type BookingDoc = {
  id: string
  customer_id?: DocumentReference<DocumentData> | null
  provider_id?: DocumentReference<DocumentData> | null
  status?: string
  subCategoryCart_id?: any
  amount_paid?: number | string
  walletAmountUsed?: number | string
  discount_amount?: number | string
  date?: Timestamp
  timeSlot?: Timestamp
  bookingAddress?: string
  city?: string
}

type PartyInfo = { name?: string; phone?: string }
type ServiceMap = Record<string, string[]>
type SortField = "bookingDate" | "timeSlot"

const PAGE_SIZE = 20
const FIRESTORE_IN_LIMIT = 30

const INTERNAL_CUSTOMER_ID = "aZ0kM3TQB1TuDq52bS7AEeVWQ6V2"

const toAmount = (value: unknown) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const formatStatusLabel = (status: string) =>
  status
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.toLowerCase() === "otp"
      ? "OTP"
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")

const normalizeStatus = (status: unknown) =>
  (status ?? "").toString().trim().toLowerCase().replace(/[\s-]+/g, "_")

const chunkArray = <T,>(values: T[], size = FIRESTORE_IN_LIMIT) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  )

async function mapWithConcurrency<T, R>(
  values: T[],
  worker: (value: T) => Promise<R>,
  concurrency = 3
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0

  const runners = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++
        results[index] = await worker(values[index])
      }
    }
  )

  await Promise.all(runners)
  return results
}

const referenceKey = (value: unknown) => {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "path" in value) {
    return String((value as { path: unknown }).path)
  }
  return ""
}

interface BookingTableProps {
  fromDate: string
  toDate: string
}

export function BookingTable({ fromDate, toDate }: BookingTableProps) {
  const db = getFirestoreDb()

  const [allBookings, setAllBookings] = useState<BookingDoc[]>([])
  const [customerMap, setCustomerMap] = useState<Record<string, PartyInfo>>({})
  const [providerMap, setProviderMap] = useState<Record<string, PartyInfo>>({})
  const [servicesMap, setServicesMap] = useState<ServiceMap>({})
  const [onboardedPartnerIds, setOnboardedPartnerIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [bookingTypeFilter, setBookingTypeFilter] = useState("real")
  const [revenueFilter, setRevenueFilter] = useState("all")
  const [sortField, setSortField] = useState<SortField>("bookingDate")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedBooking, setSelectedBooking] = useState<BookingDoc | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError("")
    let active = true
    let unsubscribe = () => {}

    const start = fromDate
      ? new Date(`${fromDate}T00:00:00`)
      : new Date(2025, 3, 1)
    const end = toDate
      ? new Date(`${toDate}T23:59:59.999`)
      : new Date()

    getOnboardedPartnerIdSet(db)
      .then((partnerIds) => {
        if (!active) return
        setOnboardedPartnerIds(partnerIds)

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("date", ">=", Timestamp.fromDate(start)),
          where("date", "<=", Timestamp.fromDate(end))
        )

        unsubscribe = onSnapshot(
          bookingsQuery,
          async (snapshot) => {
            try {
              const docs: BookingDoc[] = snapshot.docs.map((booking) => ({
                id: booking.id,
                ...(booking.data() as Omit<BookingDoc, "id">),
              }))

              if (!active) return
              setAllBookings(docs)
              setLoading(false)
              await Promise.allSettled([hydrateParties(docs), fetchServicesInfo(docs)])
            } catch (err: any) {
              if (!active) return
              console.error("Realtime booking error:", err)
              setError(err?.message || "Realtime update failed.")
              setLoading(false)
            }
          },
          (err) => {
            if (!active) return
            console.error("Booking listener failed:", err)
            setError(err?.message || "Realtime listener failed.")
            setLoading(false)
          }
        )
      })
      .catch((err: any) => {
        if (!active) return
        console.error("Partner filter failed:", err)
        setError(err?.message || "Failed to load onboarded partners.")
        setLoading(false)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [db, fromDate, toDate])

  const hydrateParties = async (docs: BookingDoc[]) => {
    const refs = (key: keyof BookingDoc) =>
      docs.map((d) => d[key]).filter(Boolean) as DocumentReference<DocumentData>[]

    const unique = (arr: DocumentReference<DocumentData>[]) =>
      Array.from(new Map(arr.map((r) => [r.path, r])).values())

    const customerRefs = unique(refs("customer_id"))
    const providerRefs = unique(refs("provider_id"))
    const allRefs = unique([...customerRefs, ...providerRefs])
    const snapshots = await mapWithConcurrency(
      chunkArray(allRefs.map((ref) => ref.id)),
      (ids) => getDocs(
        query(collection(db, "customer"), where(documentId(), "in", ids))
      )
    )

    const partyByPath: Record<string, PartyInfo> = {}
    snapshots.forEach((snapshot) => snapshot.forEach((customer) => {
      const data = customer.data()
      partyByPath[customer.ref.path] = {
        name: data.customer_name || data.display_name,
        phone: data.phone_number,
      }
    }))

    const newCust = Object.fromEntries(
      customerRefs.map((ref) => [ref.path, partyByPath[ref.path] || {}])
    )
    const newProv = Object.fromEntries(
      providerRefs.map((ref) => [ref.path, partyByPath[ref.path] || {}])
    )

    setCustomerMap((prev) => ({ ...prev, ...newCust }))
    setProviderMap((prev) => ({ ...prev, ...newProv }))
  }

  const fetchServicesInfo = async (bookingDocs: BookingDoc[]) => {
    try {
      const servicesInfo: ServiceMap = {}

      const uniqueCartRefs = Array.from(new Map(
        bookingDocs.flatMap((booking) => {
          const refs = Array.isArray(booking.subCategoryCart_id)
            ? booking.subCategoryCart_id
            : booking.subCategoryCart_id ? [booking.subCategoryCart_id] : []
          return refs.map((ref: unknown) => [referenceKey(ref), ref] as const)
        }).filter(([key]) => Boolean(key))
      ).values())

      const cartSnapshots = await mapWithConcurrency(
        chunkArray(uniqueCartRefs),
        (refs) => getDocs(
          query(collection(db, "cart"), where("subCategoryCartId", "in", refs))
        )
      )

      const namesByCartRef = new Map<string, string[]>()
      cartSnapshots.forEach((snapshot) => snapshot.forEach((cartDocument) => {
        const data = cartDocument.data()
        const key = referenceKey(data.subCategoryCartId)
        if (!key) return
        const names = namesByCartRef.get(key) || []
        names.push(data.service_name || data.serviceName || "Unknown Service")
        namesByCartRef.set(key, names)
      }))

      bookingDocs.forEach((booking) => {
        const refs = Array.isArray(booking.subCategoryCart_id)
          ? booking.subCategoryCart_id
          : booking.subCategoryCart_id ? [booking.subCategoryCart_id] : []
        const names = refs.flatMap((ref: unknown) =>
          namesByCartRef.get(referenceKey(ref)) || []
        )
        servicesInfo[booking.id] = names.length > 0 ? names : ["Unknown Service"]
      })

      setServicesMap((prev) => ({ ...prev, ...servicesInfo }))
    } catch (error) {
      console.error("Error fetching services info:", error)
    }
  }

  const normalize = (v: unknown) => (v ?? "").toString().toLowerCase()

  const fmtDate = (t?: Timestamp) =>
    t?.toDate?.()?.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }) || "—"

  const amountPaid = (b: BookingDoc) => toAmount(b.amount_paid)

  const statusOptions = useMemo(() => {
    const statuses = new Map<string, string>()

    allBookings.forEach((booking) => {
      const rawStatus = booking.status?.trim()
      if (!rawStatus) return

      const value = normalizeStatus(rawStatus)
      if (!statuses.has(value)) statuses.set(value, formatStatusLabel(rawStatus))
    })

    return Array.from(statuses, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [allBookings])

  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    const matchingBookings = allBookings.filter((b) => {
      const services = servicesMap[b.id]?.join(" ") || ""
      const cust = customerMap[b.customer_id?.path ?? ""] || {}
      const prov = providerMap[b.provider_id?.path ?? ""] || {}

      const providerId = b.provider_id?.id
      const customerId = b.customer_id?.id

      const isRealBooking =
        !!providerId &&
        onboardedPartnerIds.has(providerId) &&
        customerId !== INTERNAL_CUSTOMER_ID

      const matchesBookingType =
        bookingTypeFilter === "all" || isRealBooking

      const text = [
        b.id,
        cust.name,
        prov.name,
        cust.phone,
        prov.phone,
        services,
        b.status,
        b.bookingAddress,
        b.city,
      ]
        .map(normalize)
        .join(" ")

      const matchesSearch = !term || text.includes(term)
      const matchesStatus =
        statusFilter === "all" || normalizeStatus(b.status) === statusFilter
      const paidAmount = toAmount(b.amount_paid)
      const walletAmount = toAmount(b.walletAmountUsed)
      const netRevenue = paidAmount
      const hasNegativeRevenue = netRevenue < 0
      const isFullyWalletPaid = walletAmount > 0 && Math.abs(paidAmount - walletAmount) < 0.01
      const matchesRevenue = revenueFilter === "all"
        || (revenueFilter === "issues" && (hasNegativeRevenue || isFullyWalletPaid))
        || (revenueFilter === "negative" && hasNegativeRevenue)
        || (revenueFilter === "wallet_equal" && isFullyWalletPaid)

      return matchesBookingType && matchesSearch && matchesStatus && matchesRevenue
    })

    return matchingBookings.sort((a, b) => {
      const selectedDateA = sortField === "timeSlot" ? a.timeSlot : a.date
      const selectedDateB = sortField === "timeSlot" ? b.timeSlot : b.date
      const selectedTimeA = selectedDateA?.toDate?.()?.getTime() ?? 0
      const selectedTimeB = selectedDateB?.toDate?.()?.getTime() ?? 0

      if (selectedTimeA !== selectedTimeB) return selectedTimeB - selectedTimeA

      const bookingTimeA = a.date?.toDate?.()?.getTime() ?? 0
      const bookingTimeB = b.date?.toDate?.()?.getTime() ?? 0
      return bookingTimeB - bookingTimeA
    })
  }, [
    allBookings,
    searchTerm,
    statusFilter,
    bookingTypeFilter,
    revenueFilter,
    customerMap,
    providerMap,
    servicesMap,
    sortField,
    onboardedPartnerIds,
  ])

  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredBookings.slice(start, start + PAGE_SIZE)
  }, [filteredBookings, currentPage])

  const totalPages = Math.ceil(filteredBookings.length / PAGE_SIZE)
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, bookingTypeFilter, revenueFilter, sortField])

  const statusColors: Record<string, string> = {
    pending: "bg-orange-100 text-orange-800",
    accepted: "bg-blue-100 text-blue-800",
    in_progress: "bg-purple-100 text-purple-800",
    at_location: "bg-indigo-100 text-indigo-800",
    otp_created: "bg-cyan-100 text-cyan-800",
    service_completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    rescheduled: "bg-yellow-100 text-yellow-800",
    default: "bg-gray-100 text-gray-800",
  }

  const resetTableFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setBookingTypeFilter("real")
    setRevenueFilter("all")
    setSortField("bookingDate")
  }

  const openBooking = (booking: BookingDoc) => {
    setSelectedBooking(booking)
    setDetailsOpen(true)
  }

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="gap-4 border-b border-slate-100 bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-950"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Calendar className="h-4 w-4" /></span>Booking directory</CardTitle>
          <CardDescription className="mt-1">{filteredBookings.length.toLocaleString()} matching booking{filteredBookings.length === 1 ? "" : "s"}</CardDescription>
        </div>
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search ID, customer, partner or service" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="bg-slate-50 pl-9" />
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-5">
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Filter className="h-4 w-4" />Filters</p><Button variant="ghost" size="sm" onClick={resetTableFilters} className="h-8 text-xs"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset</Button></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">

            <label className="space-y-1"><span className="text-[11px] font-medium text-slate-500">Booking type</span><div className="relative">
              <select
                aria-label="Booking type"
                value={bookingTypeFilter}
                onChange={(event) => setBookingTypeFilter(event.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="real">Real Booking</option>
                <option value="all">All Bookings</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-50" />
            </div></label>

            <label className="space-y-1"><span className="text-[11px] font-medium text-slate-500">Status</span><div className="relative">
              <select
                aria-label="Booking status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-50" />
            </div></label>

            <label className="space-y-1"><span className="text-[11px] font-medium text-slate-500">Revenue</span><div className="relative">
              <select
                aria-label="Booking revenue"
                value={revenueFilter}
                onChange={(event) => setRevenueFilter(event.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Revenue</option>
                <option value="issues">Revenue Issues</option>
                <option value="negative">Negative Revenue</option>
                <option value="wallet_equal">Amount = Wallet</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-50" />
            </div></label>

            <label className="space-y-1"><span className="text-[11px] font-medium text-slate-500">Sort by</span><div className="relative">
              <select
                aria-label="Sort bookings by"
                value={sortField}
                onChange={(event) => setSortField(event.target.value as SortField)}
                className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="bookingDate">Booking Date (Newest First)</option>
                <option value="timeSlot">Time Slot (Latest First)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-50" />
            </div></label>
          </div>
        </div>

        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
          <Table exportable={false} className="min-w-[1280px] text-sm">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Booking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time Slot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading bookings...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-red-600 p-4">
                    {error}
                  </TableCell>
                </TableRow>
              ) : paginatedBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {searchTerm
                      ? "No bookings found matching your search."
                      : "No bookings found in this date range."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBookings.map((b, index) => {
                  const cust = customerMap[b.customer_id?.path ?? ""] || {}
                  const prov = providerMap[b.provider_id?.path ?? ""] || {}
                  const services = servicesMap[b.id] || ["Unknown Service"]

                  return (
                    <TableRow
                      key={`${b.id}-${index}`}
                      className={`${
                        index % 2 === 0 ? "bg-gray-50" : "bg-white"
                      } hover:bg-muted/40 transition`}
                    >
                      <TableCell className="font-medium truncate max-w-[140px]" title={b.id}>
                        {b.id}
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium truncate">{cust.name || "—"}</div>
                        {cust.phone && (
                          <div className="text-xs text-muted-foreground flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {cust.phone}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="truncate max-w-[220px]" title={services.join(", ")}>
                        {services.map((s, i) => (
                          <div
                            key={`${b.id}-${i}`}
                            className="text-xs text-muted-foreground truncate"
                          >
                            {s}
                          </div>
                        ))}
                      </TableCell>

                      <TableCell className="truncate max-w-[160px]" title={prov.name}>
                        {prov.name || "—"}
                      </TableCell>

                      <TableCell className="whitespace-nowrap">{fmtDate(b.date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(b.timeSlot)}</TableCell>

                      <TableCell>
                        <Badge className={statusColors[normalizeStatus(b.status)] || statusColors.default}>
                          {(b.status ?? "—").replace("_", " ")}
                        </Badge>
                      </TableCell>

                      <TableCell>₹{amountPaid(b).toLocaleString()}</TableCell>

                      <TableCell className="truncate max-w-[150px]" title={b.bookingAddress}>
                        {b.bookingAddress || "—"}
                      </TableCell>

                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openBooking(b)}><Eye className="mr-1.5 h-4 w-4" />View details</Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:hidden">
          {loading ? <div className="flex items-center justify-center gap-2 rounded-xl border py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading bookings...</div> : error ? <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : paginatedBookings.length === 0 ? <div className="rounded-xl border border-dashed py-12 text-center text-sm text-slate-500">No bookings found.</div> : paginatedBookings.map((booking) => {
            const customer = customerMap[booking.customer_id?.path ?? ""] || {}
            const provider = providerMap[booking.provider_id?.path ?? ""] || {}
            const services = servicesMap[booking.id] || ["Loading service..."]
            return <article key={booking.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-xs font-semibold text-slate-500">{booking.id}</p><p className="mt-1 truncate font-semibold text-slate-950">{customer.name || "Customer details loading"}</p></div><Badge className={statusColors[normalizeStatus(booking.status)] || statusColors.default}>{booking.status ? formatStatusLabel(booking.status) : "Unknown"}</Badge></div>
              <div className="my-4 grid gap-2 text-sm text-slate-600"><p className="truncate font-medium text-slate-800">{services.join(", ")}</p><p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" />{fmtDate(booking.date)}</p><p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />{fmtDate(booking.timeSlot)}</p><p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{customer.phone || "Phone unavailable"}</p><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /><span className="truncate">{booking.bookingAddress || booking.city || "Address unavailable"}</span></p></div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><div><p className="text-[11px] text-slate-400">Partner</p><p className="max-w-[150px] truncate text-sm font-medium">{provider.name || "Unassigned"}</p></div><p className="flex items-center font-bold text-slate-950"><IndianRupee className="h-4 w-4" />{amountPaid(booking).toLocaleString()}</p></div>
              <Button variant="outline" size="sm" onClick={() => openBooking(booking)} className="mt-4 w-full"><Eye className="mr-2 h-4 w-4" />View complete details</Button>
            </article>
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
            {filteredBookings.length > 0 && (
              <span className="ml-2">
                ({(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, filteredBookings.length)} of{" "}
                {filteredBookings.length})
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={!hasPrev}
            >
              Prev
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasNext}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>

      {selectedBooking && (
        <DetailsSheet
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          booking={selectedBooking}
          customer={customerMap[selectedBooking.customer_id?.path ?? ""] || {}}
          provider={providerMap[selectedBooking.provider_id?.path ?? ""] || {}}
          services={servicesMap[selectedBooking.id] || []}
        />
      )}
    </Card>
  )
}
