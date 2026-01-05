"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar,
  Loader2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from "lucide-react"

type BookingDoc = {
  id: string
  customer_id?: any
  provider_id?: any
  status?: string
  date?: Timestamp
  timeSlot?: Timestamp
  subCategoryCart_id?: any
  service_id?: string
  package_id?: string
  amount_paid?: number
  otp?: number
  address?: any
  cartClone_id?: any
  itemOptions_id?: string
}

const PAGE_SIZE = 10

interface CustomerBookingsTabProps {
  customerId: string
}

export function CustomerBookingsTab({ customerId }: CustomerBookingsTabProps) {
  const db = getFirestoreDb()

  const [bookings, setBookings] = useState<BookingDoc[]>([])
  const [servicesMap, setServicesMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch bookings
  useEffect(() => {
    const fetchBookings = async () => {
      if (!customerId) return

      try {
        setLoading(true)
        const customerRef = doc(db, "customer", customerId)
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("customer_id", "==", customerRef),
          orderBy("date", "desc")
        )

        const snapshot = await getDocs(bookingsQuery)
        const bookingDocs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as BookingDoc[]

        setBookings(bookingDocs)
        await fetchServicesInfo(bookingDocs)
      } catch (err: any) {
        console.error("Failed to load bookings:", err)
        try {
          const customerRef = doc(db, "customer", customerId)
          const fallbackQuery = query(
            collection(db, "bookings"),
            where("customer_id", "==", customerRef)
          )
          const snapshot = await getDocs(fallbackQuery)
          const bookingDocs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as BookingDoc[]
          bookingDocs.sort((a, b) => {
            const dateA = a.date?.toDate?.() || new Date(0)
            const dateB = b.date?.toDate?.() || new Date(0)
            return dateB.getTime() - dateA.getTime()
          })
          setBookings(bookingDocs)
          await fetchServicesInfo(bookingDocs)
        } catch (fallbackErr) {
          console.error("Fallback query also failed:", fallbackErr)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [customerId, db])

  // Fetch service names from sub_categoryCart
  const fetchServicesInfo = async (bookingDocs: BookingDoc[]) => {
    try {
      const servicesInfo: Record<string, string[]> = {}

      await Promise.all(
        bookingDocs.map(async (booking) => {
          const serviceNames: string[] = []

          const cartRefs = Array.isArray(booking.subCategoryCart_id)
            ? booking.subCategoryCart_id
            : booking.subCategoryCart_id
            ? [booking.subCategoryCart_id]
            : []

          for (const ref of cartRefs) {
            try {
              const refPath = ref?.path || ref
              if (!refPath) continue

              const cartDocRef = refPath.includes("/")
                ? doc(db, refPath)
                : doc(db, "sub_categoryCart", refPath)

              const cartDoc = await getDoc(cartDocRef)
              if (cartDoc.exists()) {
                const data = cartDoc.data()
                const name =
                  data.serviceName ||
                  data.service_name ||
                  data.subCategoryName ||
                  data.sub_category_name ||
                  "Unknown Service"
                serviceNames.push(name)
              }
            } catch (err) {
              console.warn("Error fetching cart doc:", err)
            }
          }

          servicesInfo[booking.id] =
            serviceNames.length > 0 ? serviceNames : ["Unknown Service"]
        })
      )

      setServicesMap(servicesInfo)
    } catch (error) {
      console.error("Error fetching services info:", error)
    }
  }

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp?.toDate) return "—"
    return timestamp.toDate().toLocaleString()
  }

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== 'number') return "₹0"
    return `₹${amount.toLocaleString()}`
  }

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'service_completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>
      case 'confirmed':
      case 'accepted':
        return <Badge className="bg-blue-100 text-blue-800"><AlertCircle className="w-3 h-3 mr-1" />Confirmed</Badge>
      case 'in-progress':
        return <Badge className="bg-purple-100 text-purple-800"><AlertCircle className="w-3 h-3 mr-1" />In Progress</Badge>
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>
    }
  }

  const getServiceInfo = (booking: BookingDoc): string[] => {
    return servicesMap[booking.id] || ["Unknown Service"]
  }

  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return bookings.filter((booking) => {
      const services = getServiceInfo(booking)
      const serviceNames = services.join(" ")

      const text = [
        booking.id,
        booking.status,
        serviceNames,
        booking.otp?.toString(),
      ]
        .map(v => (v ?? "").toString().toLowerCase())
        .join(" ")

      const matchesSearch = !term || text.includes(term)
      const matchesStatus = statusFilter === "all" || booking.status?.toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesStatus
    })
  }, [bookings, searchTerm, statusFilter, servicesMap])

  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    const endIndex = startIndex + PAGE_SIZE
    return filteredBookings.slice(startIndex, endIndex)
  }, [filteredBookings, currentPage])

  const totalPages = Math.ceil(filteredBookings.length / PAGE_SIZE)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Booking History ({filteredBookings.length} total)</h3>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bookings, services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(searchTerm || statusFilter !== "all") && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredBookings.length} results
          {searchTerm && ` for "${searchTerm}"`}
          {statusFilter !== "all" && ` with status "${statusFilter}"`}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading bookings...
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== "all"
              ? "No bookings found matching your criteria."
              : "No bookings found for this customer."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time Slot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>OTP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedBookings.map((booking) => {
                  const services = getServiceInfo(booking)

                  return (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.id}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="space-y-1">
                          {services.map((service, index) => (
                            <div key={index} className="text-xs">
                              <span className="font-medium">{service}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(booking.date)}</TableCell>
                      <TableCell className="text-sm">{formatDate(booking.timeSlot)}</TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(booking.amount_paid)}</TableCell>
                      <TableCell className="font-mono">{booking.otp || "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages || 1}
              {filteredBookings.length > 0 && (
                <span className="ml-2">
                  ({((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length})
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => hasPrevPage && setCurrentPage(p => p - 1)}
                disabled={!hasPrevPage || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => hasNextPage && setCurrentPage(p => p + 1)}
                disabled={!hasNextPage || loading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}