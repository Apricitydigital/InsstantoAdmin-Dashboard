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
  service_subCategory?: DocumentReference<DocumentData> | string | null
  service_category_id?: DocumentReference<DocumentData> | string | null
  service_category?: DocumentReference<DocumentData> | string | null
  category_id?: DocumentReference<DocumentData> | string | null
  categoryName?: string
  category_name?: string
  service_category_name?: string
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
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
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

  const getInlineCategory = (cart: CartDoc) =>
    [cart.categoryName, cart.category_name, cart.service_category_name].find(
      (value) => typeof value === "string" && value.trim()
    )?.trim()

  const inferCategoryFromServiceName = (serviceName?: string) => {
    const name = normalize(serviceName)
    if (name.includes("maid")) return "Maid"
    if (name.includes("clean")) return "Cleaning"
    if (name.includes("electric") || name.includes("elec")) return "Electrical"
    if (name.includes("security")) return "Security"
    if (name.includes("driver")) return "Driver"
    return ""
  }

  const getCategoryReference = (cart: CartDoc) => {
    const value =
      cart.service_subCategory ||
      cart.service_category_id ||
      cart.service_category ||
      cart.category_id

    if (value && typeof value === "object" && "path" in value) {
      return value as DocumentReference<DocumentData>
    }

    if (typeof value === "string" && value.includes("/")) {
      return doc(db, value.replace(/^\/+|\/+$/g, ""))
    }

    return null
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

  const hydrateCategories = async (docs: CartDoc[]) => {
    const nextMap: Record<string, string> = {}
    const references = new Map<string, DocumentReference<DocumentData>>()

    docs.forEach((cart) => {
      const inlineCategory = getInlineCategory(cart)
      if (inlineCategory) {
        nextMap[cart.id] = inlineCategory
        return
      }

      const reference = getCategoryReference(cart)
      if (reference) references.set(reference.path, reference)
    })

    const resolved = await Promise.all(
      [...references.entries()].map(async ([path, reference]) => {
        try {
          const snapshot = await getDoc(reference)
          if (!snapshot.exists()) return [path, ""] as const
          const data = snapshot.data()
          const name = [
            data.name,
            data.categoryName,
            data.category_name,
            data.service_category_name,
          ].find((value) => typeof value === "string" && value.trim())
          return [path, typeof name === "string" ? name.trim() : ""] as const
        } catch {
          return [path, ""] as const
        }
      })
    )

    const namesByPath = Object.fromEntries(resolved)
    docs.forEach((cart) => {
      if (nextMap[cart.id]) return
      const reference = getCategoryReference(cart)
      if (reference && namesByPath[reference.path]) {
        nextMap[cart.id] = namesByPath[reference.path]
        return
      }
      const inferredCategory = inferCategoryFromServiceName(cart.service_name)
      if (inferredCategory) nextMap[cart.id] = inferredCategory
    })

    setCategoryMap(nextMap)
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

          await Promise.all([
            hydrateCustomers(filteredDocs),
            hydrateCategories(filteredDocs),
          ])

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

  const categories = useMemo(
    () =>
      Array.from(new Set(Object.values(categoryMap).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [categoryMap]
  )

  // ---------- Search + Status + Category Filter ----------
  const filteredCart = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return allCart.filter((c) => {
      const status = normalize(c.cartStatus)

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "paid" && status === "paid") ||
        (statusFilter === "unpaid" && status === "unpaid")

      if (!matchesStatus) return false

      const category = categoryMap[c.id] || ""
      if (categoryFilter !== "all" && category !== categoryFilter) return false

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
        category,
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
  }, [allCart, searchTerm, customerMap, categoryMap, statusFilter, categoryFilter])

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
        service_category: categoryMap[c.id] || "",
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

  useEffect(() => setCurrentPage(1), [searchTerm, statusFilter, categoryFilter])

  // ---------- Status Colors ----------
  const statusColors: Record<string, string> = {
    unpaid: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    default: "bg-gray-100 text-gray-800",
  }

  // ---------- Render ----------
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Cart Services ({filteredCart.length})
        </CardTitle>
        <CardDescription>
          Live cart services (filtered by date field)
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3 sm:p-5">
        {/* Filters Row */}
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          {/* Search */}
          <div className="relative w-full lg:w-1/2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search service, customer, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white pl-9"
            />
          </div>

          {/* Status + Category Filters + Export */}
          <div className="grid w-full gap-2 sm:grid-cols-[auto_auto_1fr] lg:w-auto lg:grid-cols-[auto_auto_auto] lg:justify-end">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />

              <select
                aria-label="Filter cart services by status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | "paid" | "unpaid")
                }
                className="h-10 w-[160px] rounded-lg border border-input bg-white px-3 text-sm text-slate-900 shadow-xs outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>

            <select
              aria-label="Filter cart services by category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm text-slate-900 shadow-xs outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 sm:w-[190px]"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <Button
              onClick={exportCSV}
              variant="outline"
              className="h-10 whitespace-nowrap"
              disabled={filteredCart.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table exportable={false} className="min-w-[1100px] w-full text-sm">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Cart ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
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
                  <TableCell colSpan={11} className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading cart...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-red-600 p-4">
                    {error}
                  </TableCell>
                </TableRow>
              ) : paginatedCart.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    {searchTerm || statusFilter !== "all" || categoryFilter !== "all"
                      ? "No cart items match your filters."
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

                      <TableCell className="whitespace-nowrap">
                        {categoryMap[c.id] || "Uncategorized"}
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
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
