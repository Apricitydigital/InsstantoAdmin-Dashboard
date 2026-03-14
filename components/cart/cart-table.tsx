"use client"

import { useEffect, useMemo, useState } from "react"
import {
  collection,
  onSnapshot,
  query,
  DocumentReference,
  DocumentData,
  getDoc,
  doc,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Loader2, Search, Calendar, Download, Filter } from "lucide-react"

const PAGE_SIZE = 20

// ---------- Types ----------
type CartDoc = {
  id: string
  customer_id?: DocumentReference<DocumentData> | string | null
  service_name?: string
  quantity?: number
  item_price?: number
  subTotal?: number
  cartStatus?: string
  date?: any
  service_duration?: string
  service_credits?: number
}

type CustomerInfo = { name?: string; phone?: string }

interface CartTableProps {
  fromDate: string
  toDate: string
}

export function CartTable({ fromDate, toDate }: CartTableProps) {
  const db = getFirestoreDb()

  const [allCart, setAllCart] = useState<CartDoc[]>([])
  const [customerMap, setCustomerMap] = useState<Record<string, CustomerInfo>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all")
  const [currentPage, setCurrentPage] = useState(1)

  // ---------- Helpers ----------
  const normalize = (v: unknown) => (v ?? "").toString().toLowerCase()

  const safeToDate = (v: any): Date | null => {
    try {
      if (v && typeof v === "object" && typeof v.toDate === "function") return v.toDate()
      if (v instanceof Date) return v
      if (typeof v === "string") {
        const d = new Date(v)
        if (!isNaN(d.getTime())) return d
      }
      return null
    } catch {
      return null
    }
  }

  const fmtDate = (v: any) => {
    const d = safeToDate(v)
    if (!d) return "—"
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
  }

  // ---------- Customer Hydration ----------
  const hydrateCustomers = async (docs: CartDoc[]) => {
    try {
      const refs: DocumentReference<DocumentData>[] = []
      const uidStrings: string[] = []

      docs.forEach((d) => {
        const v: any = d.customer_id
        if (v && typeof v === "object" && "path" in v) refs.push(v as DocumentReference<DocumentData>)
        if (typeof v === "string" && v.length > 5) uidStrings.push(v)
      })

      const uniqueRefs = Array.from(new Map(refs.map((r) => [r.path, r])).values())
      const uniqueUids = Array.from(new Set(uidStrings))

      const refSnaps = await Promise.all(
        uniqueRefs.map(async (r) => {
          try {
            return await getDoc(r)
          } catch {
            return null
          }
        })
      )

      const uidSnaps = await Promise.all(
        uniqueUids.map(async (uid) => {
          try {
            const ref = doc(db, "customers", uid) // adjust if needed
            return await getDoc(ref)
          } catch {
            return null
          }
        })
      )

      const newMap: Record<string, CustomerInfo> = {}

      refSnaps.forEach((snap) => {
        if (!snap?.exists()) return
        const d = snap.data() as any
        newMap[snap.ref.path] = {
          name: d?.customer_name || d?.display_name,
  phone: d?.phone_number || d?.phoneNumber || d?.phone || "",
        }
      })

      uidSnaps.forEach((snap, idx) => {
        const uid = uniqueUids[idx]
        if (!snap?.exists()) {
          newMap[`uid:${uid}`] = { name: uid, phone: "" }
          return
        }
        const d = snap.data() as any
        newMap[`uid:${uid}`] = {
          name: d?.customer_name || d?.display_name || uid,
  phone: d?.phone_number || d?.phoneNumber || d?.phone || "",
        }
      })

      setCustomerMap((prev) => ({ ...prev, ...newMap }))
    } catch (err) {
      console.warn("Customer hydration failed:", err)
    }
  }

  // ---------- REALTIME LISTENER (NO index required) ----------
  useEffect(() => {
    setLoading(true)
    setError("")

    const cartQuery = query(collection(db, "cart"))

    const unsub = onSnapshot(
      cartQuery,
      async (snapshot) => {
        try {
          const docs: CartDoc[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))

          const startDate = fromDate
            ? new Date(fromDate + "T00:00:00")
            : new Date(2025, 3, 1)

          const endDate = toDate
            ? new Date(toDate + "T23:59:59")
            : new Date()

          const filteredDocs = docs
            .filter((c) => {
              const created = safeToDate(c.date)
              if (!created) return false
              return created >= startDate && created <= endDate
            })
            .sort((a, b) => {
              const da = safeToDate(a.date) || new Date(0)
              const dbb = safeToDate(b.date) || new Date(0)
              return dbb.getTime() - da.getTime()
            })

          setAllCart(filteredDocs)

          // Hydrate customers without crashing UI
          await hydrateCustomers(filteredDocs)

          setLoading(false)
        } catch (err: any) {
          console.error("Snapshot processing error:", err)
          setError(err?.message || "Realtime update failed.")
          setLoading(false)
        }
      },
      (err) => {
        console.error("Realtime cart listener error:", err)
        setError(err?.message || "Realtime listener failed.")
        setLoading(false)
      }
    )

    return () => unsub()
  }, [db, fromDate, toDate])

  // ---------- Search + Status Filter ----------
  const filteredCart = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return allCart.filter((c) => {
      const status = normalize(c.cartStatus)

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "paid" && status === "paid") ||
        (statusFilter === "unpaid" && status === "unpaid")

      if (!matchesStatus) return false

      const customerKey =
        c.customer_id && typeof c.customer_id === "object" && "path" in c.customer_id
          ? (c.customer_id as any).path
          : typeof c.customer_id === "string"
            ? `uid:${c.customer_id}`
            : ""

      const cust = customerMap[customerKey] || {}

      const text = [
        c.id,
        c.service_name,
        c.cartStatus,
        cust.name,
        cust.phone,
        c.quantity,
        c.item_price,
        c.subTotal,
      ]
        .map(normalize)
        .join(" ")

      return !term || text.includes(term)
    })
  }, [allCart, searchTerm, customerMap, statusFilter])

  // ---------- Export CSV ----------
  const exportCSV = () => {
    const rows = filteredCart.map((c) => {
      const customerKey =
        c.customer_id && typeof c.customer_id === "object" && "path" in c.customer_id
          ? (c.customer_id as any).path
          : typeof c.customer_id === "string"
            ? `uid:${c.customer_id}`
            : ""

      const cust = customerMap[customerKey] || {}

      return {
        cart_id: c.id,
        customer_name: cust.name || "",
        customer_phone: cust.phone || "",
        service_name: c.service_name || "",
        quantity: c.quantity ?? "",
        item_price: c.item_price ?? "",
        sub_total: c.subTotal ?? "",
        service_credits: c.service_credits ?? "",
        service_duration: c.service_duration ?? "",
        status: c.cartStatus ?? "",
        date: fmtDate(c.date),
      }
    })

    const headers = Object.keys(rows[0] || {})
    if (headers.length === 0) return

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `cart_export_${fromDate}_to_${toDate}.csv`
    a.click()

    URL.revokeObjectURL(url)
  }

  // ---------- Pagination ----------
  const paginatedCart = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredCart.slice(start, start + PAGE_SIZE)
  }, [filteredCart, currentPage])

  const totalPages = Math.ceil(filteredCart.length / PAGE_SIZE)
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1

  useEffect(() => setCurrentPage(1), [searchTerm, statusFilter])

  // ---------- Status Colors ----------
  const statusColors: Record<string, string> = {
    unpaid: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    default: "bg-gray-100 text-gray-800",
  }

  // ---------- Render ----------
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Cart Services ({filteredCart.length})
        </CardTitle>
        <CardDescription>
          Live cart services (filtered by date field)
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Filters Row */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative w-full lg:w-1/2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search service, customer, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Status Filter + Export */}
          <div className="flex gap-2 w-full lg:w-auto justify-end">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />

              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as any)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={exportCSV}
              variant="outline"
              className="whitespace-nowrap"
              disabled={filteredCart.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border shadow-sm">
          <Table className="min-w-[1100px] w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Cart ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Item Price</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading cart...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-red-600 p-4">
                    {error}
                  </TableCell>
                </TableRow>
              ) : paginatedCart.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {searchTerm
                      ? "No cart items match your search."
                      : "No cart items found in this date range."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCart.map((c, index) => {
                  const customerKey =
                    c.customer_id && typeof c.customer_id === "object" && "path" in c.customer_id
                      ? (c.customer_id as any).path
                      : typeof c.customer_id === "string"
                        ? `uid:${c.customer_id}`
                        : ""

                  const cust = customerMap[customerKey] || {}
                  const statusKey = normalize(c.cartStatus)

                  return (
                    <TableRow
                      key={`${c.id}-${index}`}
                      className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-muted/40 transition`}
                    >
                      <TableCell className="font-medium truncate max-w-[160px]" title={c.id}>
                        {c.id}
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium truncate">{cust.name || "—"}</div>
                        {cust.phone && (
                          <div className="text-xs text-muted-foreground">{cust.phone}</div>
                        )}
                      </TableCell>

                      <TableCell className="truncate max-w-[220px]" title={c.service_name}>
                        {c.service_name || "—"}
                      </TableCell>

                      <TableCell>{c.quantity ?? 1}</TableCell>

                      <TableCell>₹{(c.item_price ?? 0).toLocaleString()}</TableCell>

                      <TableCell className="font-semibold">
                        ₹{(c.subTotal ?? 0).toLocaleString()}
                      </TableCell>

                      <TableCell>{c.service_credits ?? "—"}</TableCell>

                      <TableCell>{c.service_duration ?? "—"}</TableCell>

                      <TableCell>
                        <Badge className={statusColors[statusKey] || statusColors.default}>
                          {c.cartStatus ?? "—"}
                        </Badge>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {fmtDate(c.date)}
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
            {filteredCart.length > 0 && (
              <span className="ml-2">
                ({(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, filteredCart.length)} of{" "}
                {filteredCart.length})
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
    </Card>
  )
}
