"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  collection,
  DocumentData,
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

type LatLng = { latitude: number; longitude: number } | { lat: number; lng: number } | null

type CustomerDoc = {
  id: string
  uid?: string
  email?: string
  display_name?: string
  customer_name?: string
  phone_number?: string
  contact_no?: number
  userType?: { customer?: boolean; provider?: boolean; admin?: boolean; AgencyPartner?: boolean } | any
  created_time?: Timestamp
  edited_time?: Timestamp
  cancellationPolicy?: boolean
  location?: LatLng
  photo_url?: string
  address?: any
  bio?: string
  referralBy?: string
  Subscription?: string
}

const PAGE_SIZE = 20

interface CustomerTableProps {
  fromDate: string;
  toDate: string;
}

export function CustomerTable({ fromDate, toDate }: CustomerTableProps) {
  const db = getFirestoreDb()
  const router = useRouter()

  // All data state
  const [allCustomers, setAllCustomers] = useState<CustomerDoc[]>([])

  // UI states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [membershipFilter, setMembershipFilter] = useState<"all" | "member" | "non-member">("all")

  // Pagination for filtered results
  const [currentPage, setCurrentPage] = useState(1)

  const normalize = (v: unknown) => (v ?? "").toString().toLowerCase()

  // ----- Load Customers Based on Date Range -----
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true)
      setError("")

      try {
        // Convert date strings to Firestore Timestamps
        // Use local time instead of UTC to avoid timezone offset issues
        const startDate = fromDate
          ? new Date(`${fromDate}T00:00:00`)  // No 'Z'
          : new Date(2025, 3, 1);

        const endDate = toDate
          ? new Date(`${toDate}T23:59:59`)    // No 'Z'
          : new Date();


        const fromTimestamp = Timestamp.fromDate(startDate);
        const toTimestamp = Timestamp.fromDate(endDate);

        // Fetch customers within the date range
        const customersQuery = query(
          collection(db, "customer"),
          where("userType.customer", "==", true),
          where("created_time", ">=", fromTimestamp),
          where("created_time", "<=", toTimestamp),
          orderBy("created_time", "desc")
        )

        const snapshot = await getDocs(customersQuery)
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any)
        })) as CustomerDoc[]

        setAllCustomers(docs)

      } catch (e: any) {
        setError(e.message ?? "Failed to load customers.")
      } finally {
        setLoading(false)
      }
    }

    fetchCustomers()
  }, [db, fromDate, toDate])

  // ----- Real-time updates for new customers -----
  useEffect(() => {
    if (allCustomers.length === 0) return

    // Set up real-time listener for new customers
    const realtimeQuery = query(
      collection(db, "customer"),
      where("userType.customer", "==", true),
      orderBy("created_time", "desc"),
      limit(10)
    )

    const unsub = onSnapshot(realtimeQuery, (snapshot) => {
      const newDocs: CustomerDoc[] = []

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const doc = { id: change.doc.id, ...(change.doc.data() as any) } as CustomerDoc

          // Check if this customer is not already in our list AND falls within date range
          if (!allCustomers.some(customer => customer.id === doc.id)) {
            const createdDate = doc.created_time?.toDate();
            const startDate = new Date(fromDate + "T00:00:00Z");
            const endDate = new Date(toDate + "T23:59:59Z");

            if (createdDate && createdDate >= startDate && createdDate <= endDate) {
              newDocs.push(doc)
            }
          }
        }
      })

      if (newDocs.length > 0) {
        setAllCustomers(prev => {
          const combined = [...newDocs, ...prev]
          return combined.sort((a, b) => {
            const dateA = a.created_time?.toDate?.() || new Date(0)
            const dateB = b.created_time?.toDate?.() || new Date(0)
            return dateB.getTime() - dateA.getTime()
          })
        })
      }
    })

    return () => unsub()
  }, [db, allCustomers.length, fromDate, toDate])

  // ----- Filter and Search Logic -----
  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()

    let results = allCustomers

    // 🔎 Apply search filter
    if (term) {
      results = results.filter((c) => {
        const text = [
          c.customer_name,
          c.display_name,
          c.email,
          c.phone_number,
          c.contact_no,
          c.uid,
          c.bio,
        ]
          .map(normalize)
          .join(" ")

        return text.includes(term)
      })
    }

    // 🏷️ Apply membership filter
    if (membershipFilter === "member") {
      results = results.filter((c) => c.Subscription === "Active")
    } else if (membershipFilter === "non-member") {
      results = results.filter((c) => c.Subscription !== "Active")
    }

    return results
  }, [allCustomers, search, membershipFilter])

  // ----- Pagination for filtered results -----
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    const endIndex = startIndex + PAGE_SIZE
    return filteredCustomers.slice(startIndex, endIndex)
  }, [filteredCustomers, currentPage])

  const totalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  // ----- Reset pagination when search or filter changes -----
  useEffect(() => {
    setCurrentPage(1)
  }, [search, membershipFilter])

  // ----- Pagination handlers -----
  const goNext = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const goPrev = () => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1)
    }
  }

  // ----- Helper functions -----
  const fmtDate = (t?: Timestamp) => (t?.toDate ? t.toDate().toLocaleString() : "—")
  const fmtPhone = (c: CustomerDoc) => c.phone_number ?? (c.contact_no ? String(c.contact_no) : "—")
  const fmtLatLng = (loc: LatLng) => {
    if (!loc) return "—"
    const lat = (loc as any).latitude ?? (loc as any).lat
    const lng = (loc as any).longitude ?? (loc as any).lng
    return typeof lat === "number" && typeof lng === "number" ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "—"
  }

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
              placeholder="Search name / email / phone / bio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="relative">
            <select
              value={membershipFilter}
              onChange={(e) => setMembershipFilter(e.target.value as "all" | "member" | "non-member")}
              className="border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Customers</option>
              <option value="member">Members</option>
              <option value="non-member">Non-Members</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Results info */}
        {search && (
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {filteredCustomers.length} results for "{search}"
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 text-center py-8">{error}</div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableCaption>Customer records (userType.customer = true)</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>UID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>User Type</TableHead>
                    <TableHead>Membership</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                        {filteredCustomers.length === 0 ? (
                          search ?
                            "No customers found matching your search criteria." :
                            "No customers found in this date range."
                        ) : (
                          "No more results on this page."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCustomers.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/50">
                        <TableCell>{c.uid ?? "—"}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{c.display_name || "—"}</div>
                            {c.phone_number && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Phone className="h-3 w-3 mr-1" />
                                {c.phone_number}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{c.email ?? "—"}</TableCell>
                        <TableCell className="font-mono">{fmtPhone(c)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {c.userType?.customer && (
                              <Badge variant="default" className="text-xs">Customer</Badge>
                            )}
                            {c.userType?.provider && (
                              <Badge variant="secondary" className="text-xs">Provider</Badge>
                            )}
                            {c.userType?.admin && (
                              <Badge variant="destructive" className="text-xs">Admin</Badge>
                            )}
                            {c.userType?.AgencyPartner && (
                              <Badge variant="outline" className="text-xs">Partner</Badge>
                            )}
                            {!c.userType && <span className="text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={c.Subscription === "Active" ? "default" : "secondary"}
                            className={
                              c.Subscription === "Active"
                                ? "bg-green-100 text-green-800 hover:bg-green-200"
                                : "bg-gray-100 text-gray-800"
                            }
                          >
                            {c.Subscription === "Active" ? "Member" : "Non-Member"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{fmtLatLng(c.location ?? null)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(c.created_time)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/customers/${c.id}`)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View
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
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages || 1}
                {filteredCustomers.length > 0 && (
                  <span className="ml-2">
                    ({((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredCustomers.length)} of {filteredCustomers.length})
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={!hasPrevPage || loading}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button variant="outline" size="sm" onClick={goNext} disabled={!hasNextPage || loading}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}