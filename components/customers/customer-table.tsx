"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ChevronLeft, ChevronRight, Search, Users, Phone, Eye } from "lucide-react"

type LatLng =
  | { latitude: number; longitude: number }
  | { lat: number; lng: number }
  | null

type CustomerDoc = {
  id: string
  uid?: string
  email?: string
  display_name?: string
  customer_name?: string
  phone_number?: string
  contact_no?: number
  userType?: any
  created_time?: Timestamp
  location?: LatLng
  Subscription?: string
  bookingCount?: number
  referralBy?: string
}

const PAGE_SIZE = 20

interface CustomerTableProps {
  fromDate: string
  toDate: string
}

export function CustomerTable({ fromDate, toDate }: CustomerTableProps) {
  const db = getFirestoreDb()
  const router = useRouter()

  const [allCustomers, setAllCustomers] = useState<CustomerDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [bookingFilter, setBookingFilter] = useState<"all" | "0" | "1" | "2" | "2plus">("all")
  const [currentPage, setCurrentPage] = useState(1)

  const normalize = (v: unknown) => (v ?? "").toString().toLowerCase()

  // -----------------------------------------------------
  // LOAD CUSTOMERS + BOOKING COUNTS
  // -----------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError("")

      try {
        const startDate = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date(2025, 3, 1)
        const endDate = toDate ? new Date(`${toDate}T23:59:59`) : new Date()

        const fromTimestamp = Timestamp.fromDate(startDate)
        const toTimestamp = Timestamp.fromDate(endDate)

        // Load customers
        const customersQuery = query(
          collection(db, "customer"),
          where("userType.customer", "==", true),
          where("created_time", ">=", fromTimestamp),
          where("created_time", "<=", toTimestamp),
          orderBy("created_time", "desc")
        )

        const customerSnap = await getDocs(customersQuery)

        const customerDocs = customerSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any)
        })) as CustomerDoc[]

        // Load bookings for count
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("date", ">=", fromTimestamp),
          where("date", "<=", toTimestamp)
        )

        const bookingSnap = await getDocs(bookingsQuery)

        const bookingCountMap: Record<string, number> = {}

        bookingSnap.forEach((b) => {
          const ref = b.data().customer_id
          const id = ref?.id
          if (!id) return
          bookingCountMap[id] = (bookingCountMap[id] || 0) + 1
        })

        // Attach booking count
        const withCounts = customerDocs.map((c) => ({
          ...c,
          bookingCount: bookingCountMap[c.id] || 0
        }))

        setAllCustomers(withCounts)
      } catch (e: any) {
        setError(e.message ?? "Failed to load data.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [db, fromDate, toDate])

  // -----------------------------------------------------
  // REAL-TIME LISTENER (ONLY LATEST 10)
  // -----------------------------------------------------
  useEffect(() => {
    if (allCustomers.length === 0) return

    const realtimeQuery = query(
      collection(db, "customer"),
      where("userType.customer", "==", true),
      orderBy("created_time", "desc"),
      limit(10)
    )

    const unsub = onSnapshot(realtimeQuery, (snapshot) => {
      const added: CustomerDoc[] = []

      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return

        const doc = { id: change.doc.id, ...(change.doc.data() as any) } as CustomerDoc

        if (!allCustomers.some((c) => c.id === doc.id)) {
          const created = doc.created_time?.toDate()
          if (!created) return

          const start = new Date(fromDate + "T00:00:00")
          const end = new Date(toDate + "T23:59:59")

          if (created >= start && created <= end) {
            doc.bookingCount = 0
            added.push(doc)
          }
        }
      })

      if (added.length > 0) {
        setAllCustomers((prev) => {
          const combined = [...added, ...prev]
          return combined.sort((a, b) => {
            const dateA = a.created_time?.toDate?.() ?? new Date(0)
            const dateB = b.created_time?.toDate?.() ?? new Date(0)
            return dateB.getTime() - dateA.getTime()
          })
        })
      }
    })

    return () => unsub()
  }, [allCustomers.length, fromDate, toDate, db])

  // -----------------------------------------------------
  // FILTER + SEARCH
  // -----------------------------------------------------
  const filteredCustomers = useMemo(() => {
    let results = allCustomers
    const term = search.trim().toLowerCase()

    // Search
    if (term) {
      results = results.filter((c) => {
        const text = [
          c.customer_name,
          c.display_name,
          c.email,
          c.phone_number,
          c.contact_no,
          c.uid,
          c.referralBy,
        ]
          .map(normalize)
          .join(" ")

        return text.includes(term)
      })
    }

    // Booking filters
    if (bookingFilter === "0") results = results.filter((c) => c.bookingCount === 0)
    else if (bookingFilter === "1") results = results.filter((c) => c.bookingCount === 1)
    else if (bookingFilter === "2") results = results.filter((c) => c.bookingCount === 2)
    else if (bookingFilter === "2plus") results = results.filter((c) => c.bookingCount! >= 3)

    return results
  }, [allCustomers, search, bookingFilter])

  // Pagination
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredCustomers.slice(start, start + PAGE_SIZE)
  }, [filteredCustomers, currentPage])

  const totalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE)

  useEffect(() => setCurrentPage(1), [search, bookingFilter])

  // -----------------------------------------------------
  // HELPERS
  // -----------------------------------------------------
  const fmtDate = (t?: Timestamp) =>
    t?.toDate ? t.toDate().toLocaleString() : "—"

  const fmtPhone = (c: CustomerDoc) =>
    c.phone_number ?? c.contact_no?.toString() ?? "—"

  const fmtLatLng = (loc: LatLng) => {
    if (!loc) return "—"
    const lat = (loc as any).latitude ?? (loc as any).lat
    const lng = (loc as any).longitude ?? (loc as any).lng
    if (typeof lat === "number" && typeof lng === "number")
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    return "—"
  }

  // -----------------------------------------------------
  // EXPORT CSV
  // -----------------------------------------------------
  const exportCSV = () => {
    const header = ["ID", "Name", "Email", "Phone", "Bookings", "Created"]

    const rows = filteredCustomers.map((c) => [
      c.id,
      c.display_name || "",
      c.email || "",
      fmtPhone(c),
      c.bookingCount || 0,
      fmtDate(c.created_time)
    ])

    const csv = [header, ...rows].map((r) => r.join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "customers.csv"
    a.click()
  }

  // -----------------------------------------------------
  // EXPORT EXCEL
  // -----------------------------------------------------
  const exportExcel = () => {
    import("xlsx").then((xlsx) => {
      const data = filteredCustomers.map((c) => ({
        ID: c.id,
        Name: c.display_name || "",
        Email: c.email || "",
        Phone: fmtPhone(c),
        Bookings: c.bookingCount || 0,
        Created: fmtDate(c.created_time)
      }))

      const ws = xlsx.utils.json_to_sheet(data)
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, "Customers")

      xlsx.writeFile(wb, "customers.xlsx")
    })
  }

  // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Users className="h-5 w-5 text-primary" />
          Customers ({filteredCustomers.length} total)
        </CardTitle>

        <div className="flex gap-2">
          <div className="relative sm:w-80">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name / email / phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Booking Filter */}
          <select
            value={bookingFilter}
            onChange={(e) => setBookingFilter(e.target.value as any)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Customers</option>
            <option value="0">0 Bookings</option>
            <option value="1">1 Booking</option>
            <option value="2">2 Bookings</option>
            <option value="2plus">2+ Bookings</option>
          </select>

          <Button variant="outline" onClick={exportCSV}>CSV</Button>
          <Button variant="outline" onClick={exportExcel}>Excel</Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : error ? (
          <div className="text-red-600 text-center py-8">{error}</div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableCaption>Customer records</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>UID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Bookings</TableHead>
                    <TableHead>Referred By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No customers found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCustomers.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.uid || "—"}</TableCell>
                        <TableCell>{c.display_name || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell>{fmtPhone(c)}</TableCell>
                        <TableCell>{c.bookingCount ?? 0}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {c.referralBy || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {fmtDate(c.created_time)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/customers/${c.id}`)}
                          >
                            <Eye className="h-4 w-4" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm">
                Page {currentPage} of {totalPages || 1}
              </div>

              <div className="flex gap-2">
                <Button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>

                <Button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
