// components/customers/subscription-table.tsx
"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ChevronLeft, ChevronRight, Search, Star, Eye, Calendar } from "lucide-react"

type SubscriptionDoc = {
  id: string
  Status?: string
  startDate?: Timestamp
  endDate?: Timestamp
  Savings?: number
  BookingsCount?: number
  Name?: string
  contactNo?: string
  customerRef?: any
  Remaining_days?: number
  fcm_token?: string
}

type CustomerInfo = {
  id: string
  display_name?: string
  customer_name?: string
  email?: string
  phone_number?: string
  contact_no?: number
  photo_url?: string
}

type SubscriptionWithCustomer = SubscriptionDoc & {
  customerInfo?: CustomerInfo
}

const PAGE_SIZE = 20

export function SubscriptionTable() {
  const db = getFirestoreDb()
  const router = useRouter()

  const [subscriptions, setSubscriptions] = useState<SubscriptionWithCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all")
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch all subscriptions
  useEffect(() => {
    const fetchSubscriptions = async () => {
      setLoading(true)
      setError("")

      try {
        // Fetch all subscription documents
        const subscriptionsQuery = query(
          collection(db, "Subscription"),
          orderBy("startDate", "desc")
        )

        const snapshot = await getDocs(subscriptionsQuery)
        const subscriptionDocs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        })) as SubscriptionDoc[]

        // Group by customer and get the most recent subscription for each
        const customerSubscriptionMap = new Map<string, SubscriptionDoc>()
        
        subscriptionDocs.forEach((sub) => {
          const customerId = sub.customerRef?.id || sub.customerRef?.path?.split('/')[1]
          
          if (customerId) {
            const existing = customerSubscriptionMap.get(customerId)
            
            // Keep the most recent subscription (by startDate)
            if (!existing || (sub.startDate && (!existing.startDate || sub.startDate.toMillis() > existing.startDate.toMillis()))) {
              customerSubscriptionMap.set(customerId, sub)
            }
          }
        })

        // Fetch customer information for each subscription
        const subscriptionsWithCustomer = await Promise.all(
          Array.from(customerSubscriptionMap.values()).map(async (sub) => {
            let customerInfo: CustomerInfo | undefined

            try {
              const customerId = sub.customerRef?.id || sub.customerRef?.path?.split('/')[1]
              
              if (customerId) {
                const customerDoc = await getDoc(doc(db, "customer", customerId))
                
                if (customerDoc.exists()) {
                  const data = customerDoc.data()
                  customerInfo = {
                    id: customerDoc.id,
                    display_name: data.display_name,
                    customer_name: data.customer_name,
                    email: data.email,
                    phone_number: data.phone_number,
                    contact_no: data.contact_no,
                    photo_url: data.photo_url,
                  }
                }
              }
            } catch (err) {
              console.error("Failed to fetch customer info:", err)
            }

            return {
              ...sub,
              customerInfo,
            }
          })
        )

        // Sort by start date (most recent first)
        subscriptionsWithCustomer.sort((a, b) => {
          const dateA = a.startDate?.toDate?.() || new Date(0)
          const dateB = b.startDate?.toDate?.() || new Date(0)
          return dateB.getTime() - dateA.getTime()
        })

        setSubscriptions(subscriptionsWithCustomer)
      } catch (e: any) {
        console.error("Failed to load subscriptions:", e)
        setError(e.message ?? "Failed to load subscriptions.")
      } finally {
        setLoading(false)
      }
    }

    fetchSubscriptions()
  }, [db])

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    const term = search.trim().toLowerCase()

    let results = subscriptions

    // Apply search filter
    if (term) {
      results = results.filter((sub) => {
        const customerName = sub.customerInfo?.display_name || sub.customerInfo?.customer_name || sub.Name || ""
        const email = sub.customerInfo?.email || ""
        const phone = sub.customerInfo?.phone_number || sub.contactNo || sub.customerInfo?.contact_no || ""
        
        const text = [
          sub.id,
          customerName,
          email,
          phone,
        ]
          .map(v => (v ?? "").toString().toLowerCase())
          .join(" ")

        return text.includes(term)
      })
    }

    // Apply status filter
    if (statusFilter === "active") {
      results = results.filter((sub) => sub.Status?.toLowerCase() === "active")
    } else if (statusFilter === "expired") {
      results = results.filter((sub) => sub.Status?.toLowerCase() !== "active")
    }

    return results
  }, [subscriptions, search, statusFilter])

  // Pagination
  const paginatedSubscriptions = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    const endIndex = startIndex + PAGE_SIZE
    return filteredSubscriptions.slice(startIndex, endIndex)
  }, [filteredSubscriptions, currentPage])

  const totalPages = Math.ceil(filteredSubscriptions.length / PAGE_SIZE)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

  // Helper functions
  const fmtDate = (t?: Timestamp) => (t?.toDate ? t.toDate().toLocaleDateString() : "—")
  const fmtDateTime = (t?: Timestamp) => (t?.toDate ? t.toDate().toLocaleString() : "—")

  const getStatusBadge = (status?: string, endDate?: Timestamp) => {
    const isActive = status?.toLowerCase() === "active"
    const daysRemaining = endDate?.toDate ? Math.ceil((endDate.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0
    
    if (isActive && daysRemaining > 0) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
          Active ({daysRemaining}d left)
        </Badge>
      )
    } else if (isActive && daysRemaining <= 0) {
      return (
        <Badge variant="destructive">
          Expired
        </Badge>
      )
    } else {
      return (
        <Badge variant="secondary">
          {status || "Inactive"}
        </Badge>
      )
    }
  }

  const goNext = () => {
    if (hasNextPage) setCurrentPage(prev => prev + 1)
  }

  const goPrev = () => {
    if (hasPrevPage) setCurrentPage(prev => prev - 1)
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Star className="h-5 w-5 text-yellow-500" />
          Subscribed Customers ({filteredSubscriptions.length} total)
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
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "expired")}
              className="border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {search && (
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {filteredSubscriptions.length} results for "{search}"
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading subscriptions…
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 text-center py-8">{error}</div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableCaption>Customer subscription records (most recent per customer)</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    {/* <TableHead>Bookings Used</TableHead> */}
                    <TableHead>Savings</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSubscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                        {filteredSubscriptions.length === 0 ? (
                          search || statusFilter !== "all" ?
                            "No subscriptions found matching your criteria." :
                            "No subscriptions found."
                        ) : (
                          "No more results on this page."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSubscriptions.map((sub) => {
                      const customerName = sub.customerInfo?.display_name || sub.customerInfo?.customer_name || sub.Name || "Unknown"
                      const email = sub.customerInfo?.email || "—"
                      const phone = sub.customerInfo?.phone_number || sub.contactNo || (sub.customerInfo?.contact_no ? String(sub.customerInfo.contact_no) : "—")
                      const customerId = sub.customerRef?.id || sub.customerRef?.path?.split('/')[1]

                      return (
                        <TableRow key={sub.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="font-medium">{customerName}</div>
                            <div className="text-xs text-muted-foreground">ID: {customerId || "—"}</div>
                          </TableCell>
                          <TableCell>{email}</TableCell>
                          <TableCell className="font-mono">{phone}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{sub.Name || "Standard Plan"}</Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(sub.Status, sub.endDate)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {fmtDate(sub.startDate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {fmtDate(sub.endDate)}
                            </div>
                          </TableCell>
                          {/* <TableCell>
                            <div className="text-center">
                              <span className="font-semibold">{sub.BookingsCount || 0}</span>
                            </div>
                          </TableCell> */}
                          <TableCell className="font-semibold text-green-600">
                            ₹{(sub.Savings || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {customerId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/customers/${customerId}`)}
                                className="flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages || 1}
                {filteredSubscriptions.length > 0 && (
                  <span className="ml-2">
                    ({((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredSubscriptions.length)} of {filteredSubscriptions.length})
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