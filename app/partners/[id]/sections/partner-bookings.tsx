// =================== FULL UPDATED CODE WITH DATE FILTER ===================
"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
import {
    Calendar,
    Search,
    Filter,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    ChevronLeft,
    ChevronRight,
    BarChart3,
} from "lucide-react"
import { DetailsSheet } from "@/components/bookings/booking-component"


// ============================
// TYPES
// ============================

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
    itemOptions_id?: any
    walletAmountUsed?: any
    partner_fare?: any
    bookingAddress?: any
}

type ServiceInfo = string[]

interface PartnerBookingsSectionProps {
    partnerId: string
    fromDate?: string
    toDate?: string
}

const PAGE_SIZE = 10

// ==========================================================
// START COMPONENT
// ==========================================================

export function PartnerBookingsSection({ partnerId, fromDate = "", toDate = "" }: PartnerBookingsSectionProps) {
    const db = getFirestoreDb()

    const [bookings, setBookings] = useState<BookingDoc[]>([])
    const [servicesMap, setServicesMap] = useState<Record<string, ServiceInfo>>({})
    const [customerMap, setCustomerMap] = useState<Record<string, { name: string; phone: string }>>({})
    const [loading, setLoading] = useState(true)
    const [selectedBooking, setSelectedBooking] = useState<BookingDoc | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    // filters
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)

    // ==========================================================
    // FETCH BOOKINGS FOR PARTNER
    // ==========================================================

    useEffect(() => {
        const fetchBookings = async () => {
            if (!partnerId) return
            try {
                setLoading(true)
                const partnerRef = doc(db, "customer", partnerId)

                const bookingsQuery = query(
                    collection(db, "bookings"),
                    where("provider_id", "==", partnerRef),
                    orderBy("date", "desc")
                )

                const snapshot = await getDocs(bookingsQuery)
                const bookingDocs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as BookingDoc[]

                setBookings(bookingDocs)
                await fetchServicesInfo(bookingDocs)
                await fetchCustomerInfo(bookingDocs)

            } catch (err) {
                console.error("Failed to load partner bookings:", err)

                // fallback query without orderBy
                try {
                    const partnerRef = doc(db, "customer", partnerId)
                    const fallbackQuery = query(
                        collection(db, "bookings"),
                        where("provider_id", "==", partnerRef)
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
                    await fetchCustomerInfo(bookingDocs)

                } catch (fallbackErr) {
                    console.error("Fallback query also failed:", fallbackErr)
                }
            } finally {
                setLoading(false)
            }
        }

        fetchBookings()
    }, [partnerId, db])

    // ==========================================================
    // DATE RANGE FILTER LOGIC
    // ==========================================================

    const filteredByDate = useMemo(() => {
        if (!fromDate && !toDate) return bookings // ALL TIME

        const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null
        const end = toDate ? new Date(`${toDate}T23:59:59`) : null

        return bookings.filter(b => {
            if (!b.date?.toDate) return false
            const d = b.date.toDate()

            if (start && d < start) return false
            if (end && d > end) return false

            return true
        })
    }, [bookings, fromDate, toDate])

    // ==========================================================
    // FETCH SERVICES FOR EACH BOOKING
    // ==========================================================

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

                    for (const subCategoryRef of cartRefs) {
                        try {
                            const cartQuery = query(
                                collection(db, "cart"),
                                where("subCategoryCartId", "==", subCategoryRef)
                            )
                            const cartSnapshot = await getDocs(cartQuery)

                            cartSnapshot.forEach((cartDoc) => {
                                const cartData = cartDoc.data()
                                const serviceName =
                                    cartData.service_name ||
                                    cartData.serviceName ||
                                    "Unknown Service"

                                serviceNames.push(serviceName)
                            })

                        } catch (err) {
                            console.warn("Error querying cart:", err)
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

    // ==========================================================
    // FETCH CUSTOMER INFO
    // ==========================================================

    const fetchCustomerInfo = async (bookingDocs: BookingDoc[]) => {
        try {
            const refs = bookingDocs.map(b => b.customer_id).filter(Boolean)
            if (refs.length === 0) return

            const uniqueRefs = Array.from(new Set(refs.map(ref => ref?.path)))
            const customerData: Record<string, { name: string; phone: string }> = {}

            await Promise.all(
                uniqueRefs.map(async (refPath) => {
                    try {
                        if (!refPath) return
                        const customerRef = doc(db, refPath)
                        const customerDoc = await getDoc(customerRef)
                        if (customerDoc.exists()) {
                            const data = customerDoc.data()
                            customerData[refPath] = {
                                name: data.display_name || data.customer_name || "Unknown",
                                phone: data.phone_number || (data.contact_no ? String(data.contact_no) : "N/A"),
                            }
                        }
                    } catch {
                        customerData[refPath] = { name: "Unknown", phone: "N/A" }
                    }
                })
            )

            setCustomerMap(customerData)

        } catch (error) {
            console.error("Error fetching customer info:", error)
        }
    }

    // ==========================================================
    // UTILS
    // ==========================================================

    const formatDate = (timestamp?: Timestamp) => {
        if (!timestamp?.toDate) return "—"
        return timestamp.toDate().toLocaleString()
    }

    const formatCurrency = (amount?: number) => {
        if (typeof amount !== "number") return "₹0"
        return `₹${amount.toLocaleString()}`
    }

    const getStatusBadge = (status?: string) => {
        switch (status?.toLowerCase()) {
            case "completed":
            case "service_completed":
                return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
            case "pending":
                return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
            case "cancelled":
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>
            case "confirmed":
            case "accepted":
                return <Badge className="bg-blue-100 text-blue-800"><AlertCircle className="w-3 h-3 mr-1" />Accepted</Badge>
            case "in-progress":
                return <Badge className="bg-purple-100 text-purple-800"><AlertCircle className="w-3 h-3 mr-1" />In Progress</Badge>
            default:
                return <Badge variant="secondary">{status || "Unknown"}</Badge>
        }
    }

    const getServicesForBooking = (booking: BookingDoc): string[] => {
        return servicesMap[booking.id] || ["Unknown Service"]
    }

    // ==========================================================
    // JOB COUNTING LOGIC
    // ==========================================================

    const countJobsForServices = (services: string[]) => {
        let total = 0;

        services.forEach(service => {
            const bathroomMatch = service.match(/(\d+)\s*Bathroom/i);

            if (bathroomMatch) {
                total += parseInt(bathroomMatch[1], 10);
            } else {
                total += 1;
            }
        });

        return total;
    };

    // 🔥 UPDATED: Total jobs uses *date-filtered* bookings
    const totalJobs = useMemo(() => {
        return filteredByDate
            .filter(b => b.status?.toLowerCase() === "service_completed")
            .reduce((sum, booking) => {
                const services = servicesMap[booking.id] || [];
                return sum + countJobsForServices(services);
            }, 0);
    }, [filteredByDate, servicesMap]);

    // ==========================================================
    // FILTERED BOOKINGS (Search + Status on top of date filter)
    // ==========================================================

    const filteredBookings = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()

        return filteredByDate.filter((booking) => {
            const services = getServicesForBooking(booking).join(" ")
            const customer = customerMap[booking.customer_id?.path] || { name: "", phone: "" }

            const text = [
                booking.id,
                booking.status,
                services,
                booking.otp?.toString(),
                customer.name,
                customer.phone,
            ].map(v => (v ?? "").toString().toLowerCase()).join(" ")

            const matchesSearch = !term || text.includes(term)
            const matchesStatus = statusFilter === "all" || booking.status?.toLowerCase() === statusFilter.toLowerCase()

            return matchesSearch && matchesStatus
        })
    }, [filteredByDate, searchTerm, statusFilter, servicesMap, customerMap])

    // ==========================================================
    // PAGINATION
    // ==========================================================

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
    }, [searchTerm, statusFilter, fromDate, toDate])

    const goNext = () => { if (hasNextPage) setCurrentPage(prev => prev + 1) }
    const goPrev = () => { if (hasPrevPage) setCurrentPage(prev => prev - 1) }

    // ==========================================================
    // STATS (Use date-filtered bookings)
    // ==========================================================

    const stats = {
        total: filteredByDate.length,
        completed: filteredByDate.filter(b => b.status?.toLowerCase() === "service_completed").length,
        pending: filteredByDate.filter(b => b.status?.toLowerCase() === "pending").length,
        revenue: filteredByDate
            .filter(b => b.status?.toLowerCase() === "service_completed")
            .reduce((sum, b) => sum + (b.amount_paid || 0), 0),
    }

    // ==========================================================
    // RENDER
    // ==========================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading partner bookings...
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* =======================
                KPI CARDS
            ======================= */}
            <div className="grid gap-2 md:grid-cols-5">
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm font-medium">Total Bookings</p><p className="text-2xl font-bold">{stats.total}</p></div></div></CardContent></Card>

                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div><div><p className="text-sm font-medium">Completed</p><p className="text-2xl font-bold">{stats.completed}</p></div></div></CardContent></Card>

                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div><div><p className="text-sm font-medium">Pending</p><p className="text-2xl font-bold">{stats.pending}</p></div></div></CardContent></Card>

                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-100 rounded-lg"><BarChart3 className="w-5 h-5 text-purple-600" /></div><div><p className="text-sm font-medium">Revenue</p><p className="text-2xl font-bold">{formatCurrency(stats.revenue)}</p></div></div></CardContent></Card>

                {/* ⭐ NEW KPI CARD – TOTAL JOBS */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Total Jobs</p>
                                <p className="text-2xl font-bold">{totalJobs}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* =======================
                BOOKINGS TABLE
            ======================= */}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Partner Booking History ({filteredBookings.length} total)
                    </CardTitle>
                </CardHeader>
                <CardContent>

                    {/* 🔎 Filters */}
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
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
                                    <SelectItem value="service_completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Empty State */}
                    {filteredBookings.length === 0 ? (
                        <div className="text-center py-8">
                            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground">No bookings found for this partner.</p>
                        </div>
                    ) : (

                        <>
                            <div className="rounded-md border overflow-x-auto">
                                <Table className="min-w-[1200px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Booking ID</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Services</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Time Slot</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Partner Fare</TableHead>
                                            <TableHead>Address</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {paginatedBookings.map((booking) => {
                                            const services = getServicesForBooking(booking)
                                            const customer = customerMap[booking.customer_id?.path] || {
                                                name: "Unknown",
                                                phone: "N/A"
                                            }

                                            return (
                                                <TableRow key={booking.id}>
                                                    <TableCell className="font-medium">{booking.id}</TableCell>

                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium">{customer.name}</p>
                                                            <p className="text-xs text-muted-foreground">{customer.phone}</p>
                                                        </div>
                                                    </TableCell>

                                                    {/* Services Column */}
                                                    <TableCell className="min-w-[200px] max-w-[250px]">
                                                        <div className="space-y-1">
                                                            {services.map((s, i) => (
                                                                <div key={i} className="text-xs truncate" title={s}>
                                                                    <span className="font-medium">{s}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-sm whitespace-nowrap min-w-[150px]">
                                                        {formatDate(booking.date)}
                                                    </TableCell>

                                                    <TableCell className="text-sm whitespace-nowrap min-w-[150px]">
                                                        {formatDate(booking.timeSlot)}
                                                    </TableCell>

                                                    <TableCell>{getStatusBadge(booking.status)}</TableCell>

                                                    <TableCell className="font-medium">
                                                        {formatCurrency(booking.amount_paid)}
                                                    </TableCell>

                                                    <TableCell className="font-mono">{booking.partner_fare || "—"}</TableCell>

                                                    <TableCell className="truncate max-w-[150px]" title={booking.bookingAddress}>
                                                        {booking.bookingAddress || "—"}
                                                    </TableCell>

                                                    <TableCell>
                                                        <Button
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
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between mt-4">
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
                                        onClick={goPrev}
                                        disabled={!hasPrevPage || loading}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={goNext}
                                        disabled={!hasNextPage || loading}
                                    >
                                        Next <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}

                </CardContent>
            </Card>

            {/* Details Sheet */}
            {selectedBooking && (
                <DetailsSheet
                    open={detailsOpen}
                    onOpenChange={setDetailsOpen}
                    booking={selectedBooking}
                    customer={customerMap[selectedBooking.customer_id?.path] || {}}
                    provider={{}}
                    services={servicesMap[selectedBooking.id] || []}
                />
            )}

        </div>
    )
}
