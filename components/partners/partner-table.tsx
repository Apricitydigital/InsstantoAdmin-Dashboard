"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, MoreHorizontal, Eye, Edit, CheckCircle, XCircle, DollarSign, Pause } from "lucide-react"
import Link from "next/link"
import { collection, getDocs, query, where, doc, Timestamp } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

// Define Partner type
type Partner = {
  id: string
  uid?: string
  display_name: string
  phone_number: string
  contact_no: number
  type: "provider" | "agency"
  city: string
  services: string[]
  created_time?: Timestamp
  joinDate: string
  rating: number
  reviewCount: number
  earnings: number
  pendingPayouts: number
  kycStatus: "verified" | "pending" | "rejected"
  status: "active" | "pending" | "suspended" | "rejected"
}

interface PartnerTableProps {
  fromDate: string;
  toDate: string;
}
export function PartnerTable() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const db = getFirestoreDb()

        // --- Step 1: Fetch partners (providers + agencies) ---
        const q1 = query(
          collection(db, "customer"),
          where("userType.provider", "==", true),
          where("partner_status", "==", "Onboarded")
        )
        const q2 = query(
          collection(db, "customer"),
          where("userType.AgencyPartner", "==", true),
          where("partner_status", "==", "Onboarded")
        )

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
        const allPartners = [...snap1.docs, ...snap2.docs]

        // Collect partner IDs
        const partnerIds = allPartners.map((d) => d.id)

        // --- Step 2: Fetch Wallet + Form data in parallel ---
        const walletQueries = []
        for (let i = 0; i < partnerIds.length; i += 10) {
          walletQueries.push(
            getDocs(
              query(
                collection(db, "Wallet_Overall"),
                where("service_partner_id", "in", partnerIds.slice(i, i + 10).map(id => doc(db, "customer", id)))
              )
            )
          )
        }

        const formQueries = []
        for (let i = 0; i < partnerIds.length; i += 10) {
          formQueries.push(
            getDocs(
              query(
                collection(db, "form_details"),
                where("provider_ref", "in", partnerIds.slice(i, i + 10).map(id => doc(db, "customer", id)))
              )
            )
          )
        }

        // --- Step 3: Fetch reviews for all partners in parallel ---
        const reviewQueries = []
        for (let i = 0; i < partnerIds.length; i += 10) {
          reviewQueries.push(
            getDocs(
              query(
                collection(db, "reviews"),
                where("partnerId", "in", partnerIds.slice(i, i + 10).map(id => doc(db, "customer", id)))
              )
            )
          )
        }

        const [walletSnaps, formSnaps, reviewSnaps] = await Promise.all([
          Promise.all(walletQueries),
          Promise.all(formQueries),
          Promise.all(reviewQueries),
        ])

        // --- Step 4: Build maps ---
        const walletMap: Record<string, { earnings: number; pendingPayouts: number }> = {}
        walletSnaps.flat().forEach((snap) =>
          snap.forEach((doc) => {
            const d = doc.data()
            if (d.service_partner_id?.id) {
              walletMap[d.service_partner_id.id] = {
                earnings: d.TotalAmountComeIn_Wallet || 0,
                pendingPayouts: d.total_balance || 0,
              }
            }
          })
        )

        const serviceMap: Record<string, string> = {}
        formSnaps.flat().forEach((snap) =>
          snap.forEach((doc) => {
            const d = doc.data()
            if (d.provider_ref?.id) {
              serviceMap[d.provider_ref.id] = d.serviceOpt || "N/A"
            }
          })
        )

        const reviewMap: Record<string, { avg: number; count: number }> = {}
        reviewSnaps.flat().forEach((snap) =>
          snap.forEach((doc) => {
            const r = doc.data()
            const partnerId = r.partnerId?.id
            if (!partnerId) return
            if (!reviewMap[partnerId]) reviewMap[partnerId] = { avg: 0, count: 0 }

            if (r.partnerRating) {
              reviewMap[partnerId].avg += r.partnerRating
              reviewMap[partnerId].count++
            }
          })
        )

        // Fix avg calc
        Object.keys(reviewMap).forEach((id) => {
          const { avg, count } = reviewMap[id]
          reviewMap[id].avg = count > 0 ? avg / count : 0
        })

        // --- Step 5: Merge everything into partnersData ---
        const partnersData: Partner[] = allPartners.map((docSnap) => {
          const d = docSnap.data()
          const wallet = walletMap[docSnap.id] || { earnings: 0, pendingPayouts: 0 }
          const review = reviewMap[docSnap.id] || { avg: 0, count: 0 }

          return {
            id: docSnap.id,
            display_name: d.display_name || "Unknown",
            phone_number: d.phone_number || "N/A",
            contact_no: d.contact_number || "N/A",
            type: d.userType?.AgencyPartner ? "agency" : "provider",
            city: d.city || "N/A",
            services: d.userType?.AgencyPartner
              ? ["Full Home"]
              : serviceMap[docSnap.id]
                ? [serviceMap[docSnap.id]]
                : [],
            joinDate: d.created_time instanceof Timestamp
              ? d.created_time.toDate().toISOString()
              : new Date().toISOString(),
            rating: review.avg,
            reviewCount: review.count,
            earnings: wallet.earnings,
            pendingPayouts: wallet.pendingPayouts,
            kycStatus: d.kyc_status || "pending",
            status: d.partner_status || "pending",
          }
        })

        // Filter only allowed IDs
        const allowedIds = [
          "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
          "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
          "VxxapfO7l8YM5f6xmFqpThc17eD3",
          "Q0kKYbdOKVbeZsdiLGsJoM5BWQl1",
          "7KlujhUyJbeCTPG6Pty8exlxXuM2",
          "fGLJCCFDEneQZ7ciz71Q29WBgGQ2",
          "MstGdrDCHkZ1KKf0xtZctauIovf2",

        ]
        setPartners(partnersData.filter((p) => allowedIds.includes(p.id)))
      } catch (error) {
        console.error("Error fetching partners:", error)
      }
    }

    fetchPartners()
  }, [])


  const filteredPartners = partners.filter((partner) => {
    const matchesSearch =
      partner.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.phone_number.includes(searchTerm)

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "provider" && partner.type === "provider") ||
      (statusFilter === "agency" && partner.type === "agency")

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: Partner["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>
      case "rejected":
        return <Badge variant="outline">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getKycBadge = (status: Partner["kycStatus"]) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Verified</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner Management</CardTitle>
        <CardDescription>Manage and monitor all service partners</CardDescription>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 pt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search partners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Filter: {statusFilter === "all" ? "All" : statusFilter === "provider" ? "Provider" : "Agency Partner"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("provider")}>Provider</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("agency")}>Agency Partner</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Partner Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPartners.map((partner) => (
                <TableRow key={partner.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <div className="font-medium">{partner.display_name}</div>
                      <div className="text-sm text-muted-foreground">{partner.id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {partner.type === "provider" ? "Provider" : "Agency"}
                    </Badge>

                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{partner.phone_number}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {partner.services.length > 0 ? (
                        partner.services.map((service) => (
                          <Badge key={service} variant="outline" className="text-xs">
                            {service}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>{formatDate(partner.joinDate)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Rating: {partner.rating.toFixed(1)}</span>
                        {partner.rating > 0 && <span className="text-yellow-500">★</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{partner.reviewCount} reviews</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{formatCurrency(partner.earnings)}</div>
                      {partner.pendingPayouts > 0 && (
                        <div className="text-xs text-secondary">Pending: {formatCurrency(partner.pendingPayouts)}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(partner.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/partners/${partner.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Partner
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <DollarSign className="mr-2 h-4 w-4" />
                          Process Payout
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {partner.status === "pending" && (
                          <>
                            <DropdownMenuItem className="text-green-600">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve Partner
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject Partner
                            </DropdownMenuItem>
                          </>
                        )}
                        {partner.status === "active" && (
                          <DropdownMenuItem className="text-destructive">
                            <Pause className="mr-2 h-4 w-4" />
                            Suspend Partner
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredPartners.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No partners found matching your search criteria.</div>
        )}
      </CardContent>
    </Card>
  )
}