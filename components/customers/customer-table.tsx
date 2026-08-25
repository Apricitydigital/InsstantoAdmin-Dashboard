"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
import { cacheCustomerNavigationPreview } from "@/lib/customer-navigation-cache"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ChevronLeft, ChevronRight, Search, Users, Phone, Eye, Download, FileSpreadsheet, Mail, CalendarDays } from "lucide-react"

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
  const [navigatingCustomerId, setNavigatingCustomerId] = useState<string | null>(null)

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

  useEffect(() => {
    paginatedCustomers.forEach((customer) => router.prefetch(`/customers/${customer.id}`))
  }, [paginatedCustomers, router])

  // -----------------------------------------------------
  // HELPERS
  // -----------------------------------------------------
  const fmtDate = (t?: Timestamp) =>
    t?.toDate ? t.toDate().toLocaleString() : "—"

  const fmtPhone = (c: CustomerDoc) =>
    c.phone_number ?? c.contact_no?.toString() ?? "—"

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
    URL.revokeObjectURL(url)
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

  const customerName = (customer: CustomerDoc) =>
    customer.display_name || customer.customer_name || "Unnamed customer"

  const initials = (customer: CustomerDoc) =>
    customerName(customer)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CU"

  const viewLink = (customer: CustomerDoc, fullWidth = false) => (
    <Button asChild size="sm" variant="outline" className={fullWidth ? "w-full" : ""}>
      <Link
        href={`/customers/${customer.id}`}
        prefetch
        onPointerEnter={() => router.prefetch(`/customers/${customer.id}`)}
        onClick={() => {
          cacheCustomerNavigationPreview({
            id: customer.id,
            uid: customer.uid,
            displayName: customerName(customer),
            email: customer.email,
            phone: fmtPhone(customer),
            subscription: customer.Subscription,
            createdTimeMs: customer.created_time?.toMillis?.(),
          })
          setNavigatingCustomerId(customer.id)
        }}
      >
        {navigatingCustomerId === customer.id ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Eye className="mr-1.5 h-4 w-4" />
        )}
        View details
      </Link>
    </Button>
  )

  // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="gap-4 border-b border-slate-100 bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Users className="h-4 w-4" /></span>
            Customer directory
          </CardTitle>
          <p className="mt-1 text-sm text-slate-500">{filteredCustomers.length.toLocaleString()} matching customer{filteredCustomers.length === 1 ? "" : "s"}</p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
          <div className="relative sm:col-span-2 lg:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search name, email, phone or UID" value={search} onChange={(event) => setSearch(event.target.value)} className="bg-slate-50 pl-9" />
          </div>
          <select value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value as typeof bookingFilter)} className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="all">All booking activity</option>
            <option value="0">0 bookings</option>
            <option value="1">1 booking</option>
            <option value="2">2 bookings</option>
            <option value="2plus">3+ bookings</option>
          </select>
          <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading customers...</div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 px-4 py-10 text-center text-sm text-red-700">{error}</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
              <Table exportable={false} className="min-w-[1050px]">
                <TableCaption>Customer records</TableCaption>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead>Customer</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Bookings</TableHead><TableHead>Referred by</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No customers found.</TableCell></TableRow>
                  ) : paginatedCustomers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-slate-50/70">
                      <TableCell><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{initials(customer)}</div><div className="min-w-0"><p className="max-w-[190px] truncate font-medium text-slate-900">{customerName(customer)}</p><p className="max-w-[190px] truncate font-mono text-[11px] text-slate-400">{customer.uid || customer.id}</p></div></div></TableCell>
                      <TableCell className="max-w-[220px] truncate">{customer.email || "—"}</TableCell>
                      <TableCell>{fmtPhone(customer)}</TableCell>
                      <TableCell><Badge variant="secondary" className="font-medium">{customer.bookingCount ?? 0}</Badge></TableCell>
                      <TableCell className="max-w-[150px] truncate font-mono text-xs">{customer.referralBy || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{fmtDate(customer.created_time)}</TableCell>
                      <TableCell className="text-right">{viewLink(customer)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 md:hidden">
              {paginatedCustomers.length === 0 ? (
                <div className="rounded-xl border border-dashed py-12 text-center text-sm text-slate-500">No customers found.</div>
              ) : paginatedCustomers.map((customer) => (
                <article key={customer.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">{initials(customer)}</div>
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{customerName(customer)}</p><p className="truncate font-mono text-[11px] text-slate-400">{customer.uid || customer.id}</p></div>
                    <Badge variant="secondary">{customer.bookingCount ?? 0} bookings</Badge>
                  </div>
                  <div className="my-4 grid gap-2 text-sm text-slate-600">
                    <p className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{customer.email || "No email"}</span></p>
                    <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-400" />{fmtPhone(customer)}</p>
                    <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />{fmtDate(customer.created_time)}</p>
                  </div>
                  {viewLink(customer, true)}
                </article>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">Page <span className="font-medium text-slate-900">{currentPage}</span> of {totalPages || 1}</div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
                <Button variant="outline" disabled={currentPage >= (totalPages || 1)} onClick={() => setCurrentPage((page) => page + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
