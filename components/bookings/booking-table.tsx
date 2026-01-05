"use client"

import { useEffect, useState, useMemo } from "react"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
  Timestamp,
  DocumentReference,
  DocumentData
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Phone, Calendar, Search, Filter } from "lucide-react"
import { DetailsSheet } from "@/components/bookings/booking-component"

// ---------- Types ----------
type BookingDoc = {
  id: string
  customer_id?: DocumentReference<DocumentData> | null
  provider_id?: DocumentReference<DocumentData> | null
  status?: string
  subCategoryCart_id?: any
  amount_paid?: number
  date?: Timestamp
  timeSlot?: Timestamp
  bookingAddress?: string
  city?: string
}

type PartyInfo = { name?: string; phone?: string }
type ServiceMap = Record<string, string[]> // bookingId -> service names array

const PAGE_SIZE = 20

interface BookingTableProps {
  fromDate: string;
  toDate: string;
}

export function BookingTable({ fromDate, toDate }: BookingTableProps) {
  const db = getFirestoreDb()

  const [allBookings, setAllBookings] = useState<BookingDoc[]>([])
  const [customerMap, setCustomerMap] = useState<Record<string, PartyInfo>>({})
  const [providerMap, setProviderMap] = useState<Record<string, PartyInfo>>({})
  const [servicesMap, setServicesMap] = useState<ServiceMap>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedBooking, setSelectedBooking] = useState<BookingDoc | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // ---------- Fetch bookings within date range ----------
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true)
      setError("")
      try {
        // Convert date strings to Firestore Timestamps
        const startDate = fromDate ? new Date(fromDate + "T00:00:00Z") : new Date(2025, 3, 1);
        const endDate = toDate ? new Date(toDate + "T23:59:59Z") : new Date();

        const fromTimestamp = Timestamp.fromDate(startDate);
        const toTimestamp = Timestamp.fromDate(endDate);

        // Query bookings within date range
        const allBookingsQuery = query(
          collection(db, "bookings"),
          where("date", ">=", fromTimestamp),
          where("date", "<=", toTimestamp),
          orderBy("date", "desc")
        )

        const snapshot = await getDocs(allBookingsQuery)

        const docs: BookingDoc[] = snapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as any),
        }))

        setAllBookings(docs)
        await hydrateParties(docs)
        await fetchServicesInfo(docs)
      } catch (e: any) {
        console.error("Failed to load bookings:", e)
        setError(e.message ?? "Failed to load bookings.")
      } finally {
        setLoading(false)
      }
    }

    fetchAllData()
  }, [db, fromDate, toDate])

  // ---------- Real-time updates ----------
  useEffect(() => {
    if (allBookings.length === 0) return

    const realtimeQuery = query(collection(db, "bookings"), orderBy("date", "desc"), limit(5))
    const unsub = onSnapshot(realtimeQuery, async (snapshot) => {
      const newDocs: BookingDoc[] = []
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const docData = { id: change.doc.id, ...(change.doc.data() as any) }

          // Check if booking falls within date range
          const bookingDate = docData.date?.toDate();
          const startDate = new Date(fromDate + "T00:00:00Z");
          const endDate = new Date(toDate + "T23:59:59Z");

          if (bookingDate && bookingDate >= startDate && bookingDate <= endDate) {
            if (!allBookings.some(b => b.id === docData.id)) {
              newDocs.push(docData)
            }
          }
        }
      })
      if (newDocs.length > 0) {
        setAllBookings((prev) => {
          const combined = [...newDocs, ...prev]
          return combined.sort((a, b) => {
            const dateA = a.date?.toDate?.() || new Date(0)
            const dateB = b.date?.toDate?.() || new Date(0)
            return dateB.getTime() - dateA.getTime()
          })
        })
        await hydrateParties(newDocs)
        await fetchServicesInfo(newDocs)
      }
    })
    return () => unsub()
  }, [db, fromDate, toDate, allBookings.length])

  // ---------- Fetch customer/provider details ----------
  const hydrateParties = async (docs: BookingDoc[]) => {
    const refs = (key: keyof BookingDoc) =>
      docs.map(d => d[key]).filter(Boolean) as DocumentReference<DocumentData>[]

    const unique = (arr: DocumentReference<DocumentData>[]) =>
      Array.from(new Map(arr.map(r => [r.path, r])).values())

    const [custSnaps, provSnaps] = await Promise.all([
      Promise.all(unique(refs("customer_id")).map(r => getDoc(r))),
      Promise.all(unique(refs("provider_id")).map(r => getDoc(r))),
    ])

    const newCust: Record<string, PartyInfo> = {}
    custSnaps.forEach(s => {
      const d = s.data() as any
      newCust[s.ref.path] = { name: d?.customer_name || d?.display_name, phone: d?.phone_number }
    })

    const newProv: Record<string, PartyInfo> = {}
    provSnaps.forEach(s => {
      const d = s.data() as any
      newProv[s.ref.path] = { name: d?.customer_name || d?.display_name, phone: d?.phone_number }
    })

    setCustomerMap(prev => ({ ...prev, ...newCust }))
    setProviderMap(prev => ({ ...prev, ...newProv }))
  }

  // ---------- Fetch services from cart collection ----------
  const fetchServicesInfo = async (bookingDocs: BookingDoc[]) => {
    try {
      const servicesInfo: ServiceMap = {}

      await Promise.all(
        bookingDocs.map(async (booking) => {
          const serviceNames: string[] = []
          
          // Get subCategoryCart_id references (can be single or array)
          const cartRefs = Array.isArray(booking.subCategoryCart_id)
            ? booking.subCategoryCart_id
            : booking.subCategoryCart_id
              ? [booking.subCategoryCart_id]
              : []

          // For each subCategoryCart reference, query the cart collection
          for (const subCategoryRef of cartRefs) {
            try {
              // Query cart collection where subCategoryCartId matches the reference
              const cartQuery = query(
                collection(db, "cart"),
                where("subCategoryCartId", "==", subCategoryRef)
              )
              
              const cartSnapshot = await getDocs(cartQuery)
              
              // Extract service_name from each matching cart document
              cartSnapshot.forEach((cartDoc) => {
                const cartData = cartDoc.data()
                const serviceName = cartData.service_name || 
                                    cartData.serviceName || 
                                    "Unknown Service"
                serviceNames.push(serviceName)
              })
            } catch (err) {
              console.warn("Error querying cart collection:", err)
            }
          }

          // Store the service names for this booking
          servicesInfo[booking.id] = serviceNames.length > 0 
            ? serviceNames 
            : ["Unknown Service"]
        })
      )

      setServicesMap(prev => ({ ...prev, ...servicesInfo }))
    } catch (error) {
      console.error("Error fetching services info:", error)
    }
  }

  // ---------- Helpers ----------
  const normalize = (v: unknown) => (v ?? "").toString().toLowerCase()
  const fmtDate = (t?: Timestamp) =>
    t?.toDate?.()?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) || "—"
  const amountPaid = (b: BookingDoc) => (typeof b.amount_paid === "number" ? b.amount_paid : 0)

  // ---------- Filters ----------
  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return allBookings.filter((b) => {
      const services = servicesMap[b.id]?.join(" ") || ""
      const cust = customerMap[b.customer_id?.path ?? ""] || {}
      const prov = providerMap[b.provider_id?.path ?? ""] || {}

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
      const matchesStatus = statusFilter === "all" || normalize(b.status) === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [allBookings, searchTerm, statusFilter, customerMap, providerMap, servicesMap])

  // ---------- Pagination ----------
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredBookings.slice(start, start + PAGE_SIZE)
  }, [filteredBookings, currentPage])

  const totalPages = Math.ceil(filteredBookings.length / PAGE_SIZE)
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1

  useEffect(() => setCurrentPage(1), [searchTerm, statusFilter])

  // ---------- Status Colors ----------
  const statusColors: Record<string, string> = {
    Pending: "bg-orange-100 text-orange-800",
    Accepted: "bg-blue-100 text-blue-800",
    "in progress": "bg-purple-100 text-purple-800",
    Service_Completed: "bg-green-100 text-green-800",
    Cancelled: "bg-red-100 text-red-800",
    rescheduled: "bg-yellow-100 text-yellow-800",
    default: "bg-gray-100 text-gray-800",
  }

  // ---------- Render ----------
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Booking Management ({filteredBookings.length} bookings)
        </CardTitle>
        <CardDescription>Monitor and manage all customer bookings</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
          <div className="relative w-full sm:w-1/2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bookings, customers, or services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="in progress">In Progress</SelectItem>
                <SelectItem value="service_completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border shadow-sm">
          <Table className="min-w-[900px] w-full text-sm">
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={10} className="text-red-600 p-4">{error}</TableCell>
                </TableRow>
              ) : paginatedBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {filteredBookings.length === 0 ? (
                      searchTerm ? "No bookings found matching your search." : "No bookings found in this date range."
                    ) : (
                      "No more results on this page."
                    )}
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
                      className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"
                        } hover:bg-muted/40 transition`}
                    >
                      <TableCell className="font-medium truncate max-w-[140px]" title={b.id}>
                        {b.id}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium truncate">{cust.name || "—"}</div>
                        {cust.phone && (
                          <div className="text-xs text-muted-foreground flex items-center">
                            <Phone className="h-3 w-3 mr-1" /> {cust.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="truncate max-w-[220px]" title={services.join(", ")}>
                        {services.map((s, i) => (
                          <div key={`${b.id}-${i}`} className="text-xs text-muted-foreground truncate">
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
                        <Badge className={statusColors[b.status ?? ""] || statusColors.default}>
                          {(b.status ?? "—").replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>₹{amountPaid(b).toLocaleString()}</TableCell>
                      <TableCell className="truncate max-w-[150px]" title={b.bookingAddress}>
                        {b.bookingAddress || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(b);
                            setDetailsOpen(true);
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

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
            {filteredBookings.length > 0 && (
              <span className="ml-2">
                ({((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length})
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={!hasPrev}>
              Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={!hasNext}>
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