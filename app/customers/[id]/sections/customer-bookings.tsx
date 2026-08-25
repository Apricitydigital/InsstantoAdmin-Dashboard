"use client"

import { useEffect, useMemo, useState } from "react"
import {
  collection,
  doc,
  DocumentData,
  DocumentReference,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore"
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  Phone,
  Search,
  XCircle,
} from "lucide-react"

import { DetailsSheet } from "@/components/bookings/booking-component"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getFirestoreDb } from "@/lib/firebase"

type BookingDoc = {
  id: string
  customer_id?: DocumentReference<DocumentData> | null
  provider_id?: DocumentReference<DocumentData> | null
  status?: string
  date?: Timestamp
  timeSlot?: Timestamp
  subCategoryCart_id?: unknown
  amount_paid?: number | string
  walletAmountUsed?: number | string
  discount_amount?: number | string
  partner_fare?: number | string
  otp?: number | string
  bookingAddress?: string
  city?: string
  address?: unknown
  [key: string]: unknown
}

type PartyInfo = { name?: string; phone?: string }
type PartyMap = Record<string, PartyInfo>
type ServiceMap = Record<string, string[]>

const PAGE_SIZE = 10

interface CustomerBookingsTabProps {
  customerId: string
}

const toAmount = (value: unknown) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const getReferencePath = (value: unknown) => {
  if (!value || typeof value !== "object") return ""
  const path = (value as { path?: unknown }).path
  return typeof path === "string" ? path : ""
}

const getAddress = (booking: BookingDoc) => {
  if (booking.bookingAddress) return booking.bookingAddress
  if (typeof booking.address === "string") return booking.address

  if (booking.address && typeof booking.address === "object") {
    const address = booking.address as Record<string, unknown>
    const value =
      address.formattedAddress ||
      address.fullAddress ||
      address.address ||
      address.label
    if (value) return String(value)
  }

  return booking.city || "—"
}

export function CustomerBookingsTab({ customerId }: CustomerBookingsTabProps) {
  const db = getFirestoreDb()

  const [bookings, setBookings] = useState<BookingDoc[]>([])
  const [customerMap, setCustomerMap] = useState<PartyMap>({})
  const [providerMap, setProviderMap] = useState<PartyMap>({})
  const [servicesMap, setServicesMap] = useState<ServiceMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [revenueFilter, setRevenueFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedBooking, setSelectedBooking] = useState<BookingDoc | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    if (!customerId) return

    let active = true

    const hydrateParties = async (bookingDocs: BookingDoc[]) => {
      const references = bookingDocs.flatMap((booking) =>
        [booking.customer_id, booking.provider_id].filter(
          (reference): reference is DocumentReference<DocumentData> =>
            Boolean(getReferencePath(reference))
        )
      )
      const uniqueReferences = Array.from(
        new Map(references.map((reference) => [reference.path, reference])).values()
      )
      const snapshots = await Promise.all(
        uniqueReferences.map((reference) => getDoc(reference))
      )
      const parties: PartyMap = {}

      snapshots.forEach((snapshot) => {
        if (!snapshot.exists()) return
        const data = snapshot.data()
        parties[snapshot.ref.path] = {
          name:
            data.display_name ||
            data.customer_name ||
            data.partner_name ||
            data.name ||
            "Unknown",
          phone: String(
            data.phone_number ||
              data.contact_no ||
              data.mobile_number ||
              ""
          ),
        }
      })

      if (!active) return
      setCustomerMap(parties)
      setProviderMap(parties)
    }

    const fetchServices = async (bookingDocs: BookingDoc[]) => {
      const services: ServiceMap = {}

      await Promise.all(
        bookingDocs.map(async (booking) => {
          const references = Array.isArray(booking.subCategoryCart_id)
            ? booking.subCategoryCart_id
            : booking.subCategoryCart_id
              ? [booking.subCategoryCart_id]
              : []
          const names: string[] = []

          for (const reference of references) {
            try {
              const cartSnapshot = await getDocs(
                query(
                  collection(db, "cart"),
                  where("subCategoryCartId", "==", reference)
                )
              )

              cartSnapshot.forEach((cartDocument) => {
                const data = cartDocument.data()
                const name =
                  data.service_name ||
                  data.serviceName ||
                  data.subCategoryName ||
                  data.sub_category_name
                if (name) names.push(String(name))
              })

              if (cartSnapshot.empty) {
                const referencePath = getReferencePath(reference)
                const fallbackReference = referencePath
                  ? doc(db, referencePath)
                  : typeof reference === "string"
                    ? doc(
                        db,
                        reference.includes("/")
                          ? reference
                          : `sub_categoryCart/${reference}`
                      )
                    : null

                if (fallbackReference) {
                  const fallbackSnapshot = await getDoc(fallbackReference)
                  if (fallbackSnapshot.exists()) {
                    const data = fallbackSnapshot.data()
                    const name =
                      data.service_name ||
                      data.serviceName ||
                      data.subCategoryName ||
                      data.sub_category_name ||
                      data.name
                    if (name) names.push(String(name))
                  }
                }
              }
            } catch (serviceError) {
              console.warn("Unable to load a booking service:", serviceError)
            }
          }

          services[booking.id] =
            names.length > 0
              ? Array.from(new Set(names))
              : ["Unknown Service"]
        })
      )

      if (active) setServicesMap(services)
    }

    const loadBookings = async () => {
      setLoading(true)
      setError("")

      try {
        const customerReference = doc(db, "customer", customerId)
        let snapshot

        try {
          snapshot = await getDocs(
            query(
              collection(db, "bookings"),
              where("customer_id", "==", customerReference),
              orderBy("date", "desc")
            )
          )
        } catch {
          snapshot = await getDocs(
            query(
              collection(db, "bookings"),
              where("customer_id", "==", customerReference)
            )
          )
        }

        const bookingDocs = snapshot.docs
          .map(
            (snapshotDocument): BookingDoc => ({
              id: snapshotDocument.id,
              ...snapshotDocument.data(),
            })
          )
          .sort((first, second) => {
            const firstDate = first.date?.toDate?.() || new Date(0)
            const secondDate = second.date?.toDate?.() || new Date(0)
            return secondDate.getTime() - firstDate.getTime()
          })

        if (!active) return
        setBookings(bookingDocs)

        await Promise.all([
          hydrateParties(bookingDocs),
          fetchServices(bookingDocs),
        ])
      } catch (loadError) {
        console.error("Failed to load customer bookings:", loadError)
        if (active) {
          setBookings([])
          setError("Unable to load this customer's bookings.")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadBookings()
    return () => {
      active = false
    }
  }, [customerId, db])

  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return bookings.filter((booking) => {
      const customer = customerMap[getReferencePath(booking.customer_id)] || {}
      const provider = providerMap[getReferencePath(booking.provider_id)] || {}
      const services = servicesMap[booking.id] || []
      const paidAmount = toAmount(booking.amount_paid)
      const walletAmount = toAmount(booking.walletAmountUsed)
      const hasNegativeRevenue = paidAmount < 0
      const isFullyWalletPaid =
        walletAmount > 0 && Math.abs(paidAmount - walletAmount) < 0.01

      const searchableText = [
        booking.id,
        booking.status,
        customer.name,
        customer.phone,
        provider.name,
        provider.phone,
        services.join(" "),
        getAddress(booking),
        booking.otp,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const normalizedStatus = String(booking.status || "")
        .toLowerCase()
        .replaceAll("_", "-")
        .replaceAll(" ", "-")
      const matchesSearch = !term || searchableText.includes(term)
      const matchesStatus =
        statusFilter === "all" || normalizedStatus === statusFilter
      const matchesRevenue =
        revenueFilter === "all" ||
        (revenueFilter === "issues" &&
          (hasNegativeRevenue || isFullyWalletPaid)) ||
        (revenueFilter === "negative" && hasNegativeRevenue) ||
        (revenueFilter === "wallet_equal" && isFullyWalletPaid)

      return matchesSearch && matchesStatus && matchesRevenue
    })
  }, [
    bookings,
    customerMap,
    providerMap,
    revenueFilter,
    searchTerm,
    servicesMap,
    statusFilter,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE))
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredBookings.slice(start, start + PAGE_SIZE)
  }, [currentPage, filteredBookings])

  useEffect(() => {
    setCurrentPage(1)
  }, [revenueFilter, searchTerm, statusFilter])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const formatDate = (timestamp?: Timestamp) =>
    timestamp?.toDate?.().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }) || "—"

  const formatCurrency = (value: unknown) =>
    `₹${toAmount(value).toLocaleString("en-IN")}`

  const getStatusBadge = (status?: string) => {
    const normalizedStatus = String(status || "")
      .toLowerCase()
      .replaceAll("_", "-")
      .replaceAll(" ", "-")

    switch (normalizedStatus) {
      case "completed":
      case "service-completed":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 size-3" /> Completed
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="mr-1 size-3" /> Pending
          </Badge>
        )
      case "cancelled":
      case "canceled":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 size-3" /> Cancelled
          </Badge>
        )
      case "confirmed":
      case "accepted":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <AlertCircle className="mr-1 size-3" /> Accepted
          </Badge>
        )
      case "in-progress":
        return (
          <Badge className="bg-purple-100 text-purple-800">
            <AlertCircle className="mr-1 size-3" /> In Progress
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Booking History ({filteredBookings.length} total)
          </h3>
          <p className="text-sm text-muted-foreground">
            Complete booking, service, provider and payment information
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <div className="relative min-w-0 flex-1 lg:w-80">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search booking, provider or service..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <div className="relative shrink-0">
              <select
                aria-label="Booking status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-[150px] appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="accepted">Accepted</option>
                <option value="in-progress">In Progress</option>
                <option value="service-completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-50" />
            </div>

            <div className="relative shrink-0">
              <select
                aria-label="Booking revenue"
                value={revenueFilter}
                onChange={(event) => setRevenueFilter(event.target.value)}
                className="h-10 w-[170px] appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="all">All Revenue</option>
                <option value="issues">Revenue Issues</option>
                <option value="negative">Negative Revenue</option>
                <option value="wallet_equal">Amount = Wallet</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-50" />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border shadow-sm">
        <Table className="min-w-[1600px] text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Booking ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Services</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Booking Date</TableHead>
              <TableHead>Time Slot</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount Paid</TableHead>
              <TableHead>Wallet Used</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Partner Fare</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={13} className="h-32 text-center">
                  <Loader2 className="mr-2 inline size-5 animate-spin" />
                  Loading bookings...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={13} className="h-32 text-center text-red-600">
                  {error}
                </TableCell>
              </TableRow>
            ) : paginatedBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="h-40 text-center">
                  <Calendar className="mx-auto mb-3 size-10 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== "all" || revenueFilter !== "all"
                      ? "No bookings found matching your filters."
                      : "No bookings found for this customer."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedBookings.map((booking, index) => {
                const customer =
                  customerMap[getReferencePath(booking.customer_id)] || {}
                const provider =
                  providerMap[getReferencePath(booking.provider_id)] || {}
                const services = servicesMap[booking.id] || ["Unknown Service"]
                const address = getAddress(booking)

                return (
                  <TableRow
                    key={booking.id}
                    className={index % 2 === 0 ? "bg-gray-50/70" : "bg-white"}
                  >
                    <TableCell className="max-w-[160px] truncate font-medium" title={booking.id}>
                      {booking.id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-medium">{customer.name || "—"}</p>
                      {customer.phone && (
                        <p className="flex items-center text-xs text-muted-foreground">
                          <Phone className="mr-1 size-3" /> {customer.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      {services.map((service) => (
                        <p key={service} className="truncate text-xs text-muted-foreground" title={service}>
                          {service}
                        </p>
                      ))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-medium">{provider.name || "—"}</p>
                      {provider.phone && (
                        <p className="flex items-center text-xs text-muted-foreground">
                          <Phone className="mr-1 size-3" /> {provider.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(booking.date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(booking.timeSlot)}</TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(booking.amount_paid)}</TableCell>
                    <TableCell>{formatCurrency(booking.walletAmountUsed)}</TableCell>
                    <TableCell>{formatCurrency(booking.discount_amount)}</TableCell>
                    <TableCell>{formatCurrency(booking.partner_fare)}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={address}>
                      {address}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking)
                          setDetailsOpen(true)
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
          {filteredBookings.length > 0 && (
            <span className="ml-2">
              ({(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filteredBookings.length)} of{" "}
              {filteredBookings.length})
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1 || loading}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            <ChevronLeft className="mr-1 size-4" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages || loading}
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          >
            Next <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>

      {selectedBooking && (
        <DetailsSheet
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          booking={selectedBooking}
          customer={customerMap[getReferencePath(selectedBooking.customer_id)] || {}}
          provider={providerMap[getReferencePath(selectedBooking.provider_id)] || {}}
          services={servicesMap[selectedBooking.id] || []}
        />
      )}
    </div>
  )
}
