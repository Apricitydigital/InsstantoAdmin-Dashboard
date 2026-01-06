"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Wallet,
  Star,
  FileText,
  ShoppingCart,
  CreditCard,
  Building2,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  BarChart3,
  Briefcase,
  MessageSquare,
  Fuel,
  CalendarDays,
} from "lucide-react"

// Import the section components
import { PartnerEarningsSection } from "./sections/partner-earnings"
import { PartnerBookingsSection } from "./sections/partner-bookings"
import { PartnerCreditsSection } from "./sections/partner-credits"
import { PartnerDocumentsSection } from "./sections/partner-documents"
import { PartnerChemicalsSection } from "./sections/partner-chemicals"
import { PartnerLoansSection } from "./sections/partner-loans"
import { PartnerReviewsSection } from "./sections/partner-review"
import { PartnerFuelSection } from "./sections/partner-fuel"
import { PartnerAvailabilitySection } from "./sections/partner-availability"
import PartnerAttendance from "./sections/partner-attendance"

import { UserCheck } from "lucide-react" // Add to imports

type PartnerDoc = {
  id: string
  uid?: string
  email?: string
  display_name?: string
  customer_name?: string
  phone_number?: string
  contact_no?: number
  userType?: any
  created_time?: Timestamp
  city?: string
  photo_url?: string
  address?: any
  bio?: string
  partner_status?: string
  kyc_status?: string
  services?: string[]
  ratings_average?: number
  total_reviews?: number
  completedBookings?: number
  totalBookings?: number
}

type WalletDoc = {
  id: string
  service_partner_id?: any
  total_balance?: number
  TotalAmountComeIn_Wallet?: number
  pending_amount?: number
  last_payout_date?: Timestamp
  is_paid?: boolean
  filteredEarnings?: number // ✅ Add filtered earnings
}

type PartnerSubscriptionDoc = {
  id: string
  partnerId?: any // Doc reference (customer)
  subscriptionStatus?: string
  subscribedDate?: Timestamp
  expiryDate?: Timestamp
  remaining_days?: number
}

function formatDateInput(d: Date) {
  return d.toLocaleDateString("en-CA") // ✅ Formats as YYYY-MM-DD
}

export default function PartnerDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const partnerId = params.id as string
  const db = getFirestoreDb()

  // ✅ Date Range States
  const [fromDate, setFromDate] = useState<string>("")
  const [toDate, setToDate] = useState<string>("")

  // States
  const [partner, setPartner] = useState<PartnerDoc | null>(null)
  const [walletInfo, setWalletInfo] = useState<WalletDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [walletLoading, setWalletLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("earnings")
  const [workingDays, setWorkingDays] = useState(0)
  const [nonWorkingDays, setNonWorkingDays] = useState(0)

  // ✅ Subscription states
  const [subscriptionInfo, setSubscriptionInfo] =
    useState<PartnerSubscriptionDoc | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  // ✅ Reset button
  const clearFilter = () => {
    setFromDate("")
    setToDate("")
  }

  // Fetch partner details
  useEffect(() => {
    const fetchPartner = async () => {
      if (!partnerId) return

      try {
        setLoading(true)
        const partnerDoc = await getDoc(doc(db, "customer", partnerId))

        if (partnerDoc.exists()) {
          const data = partnerDoc.data()
          if (data.userType?.provider || data.userType?.AgencyPartner) {
            setPartner({ id: partnerDoc.id, ...data } as PartnerDoc)
          } else {
            setError("This user is not a partner")
          }
        } else {
          setError("Partner not found")
        }
      } catch (err: any) {
        setError(err.message || "Failed to load partner details")
      } finally {
        setLoading(false)
      }
    }

    fetchPartner()
  }, [partnerId, db])

  // ✅ Fetch partner subscription info (expiryDate + remaining_days)
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!partner?.id) return
      setSubscriptionLoading(true)
      try {
        const partnerRef = doc(db, "customer", partner.id)

        const subQuery = query(
          collection(db, "partnerSubscription"),
          where("partnerId", "==", partnerRef)
        )

        const snap = await getDocs(subQuery)

        if (snap.empty) {
          setSubscriptionInfo(null)
          return
        }

        // If multiple docs exist, pick the one with the latest expiryDate
        let best: PartnerSubscriptionDoc | null = null
        snap.forEach((d) => {
          const data = d.data() as any
          const candidate: PartnerSubscriptionDoc = { id: d.id, ...data }

          if (!best) {
            best = candidate
            return
          }

          const bestExpiry = best.expiryDate?.toDate
            ? best.expiryDate.toDate().getTime()
            : -1
          const candExpiry = candidate.expiryDate?.toDate
            ? candidate.expiryDate.toDate().getTime()
            : -1

          if (candExpiry > bestExpiry) best = candidate
        })

        setSubscriptionInfo(best)
      } catch (err) {
        console.error("Failed to fetch partner subscription:", err)
        setSubscriptionInfo(null)
      } finally {
        setSubscriptionLoading(false)
      }
    }

    fetchSubscription()
  }, [partner?.id, db])

  // ✅ Fetch bookings stats (working days current month by default)
  useEffect(() => {
    const fetchBookingsStats = async () => {
      if (!partner?.id) return
      try {
        const partnerRef = doc(db, "customer", partner.id)

        let startDate: Date
        let endDate: Date
        let queryFilters: any[] = [where("provider_id", "==", partnerRef)]

        if (fromDate && toDate) {
          // ✅ Use selected range
          startDate = new Date(`${fromDate}T00:00:00`)
          endDate = new Date(`${toDate}T23:59:59`)
          queryFilters.push(where("date", ">=", Timestamp.fromDate(startDate)))
          queryFilters.push(where("date", "<=", Timestamp.fromDate(endDate)))
        } else {
          // ✅ No date selected → show all-time completed bookings,
          // but working days should still use current month
          const now = new Date()
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        }

        // ✅ All-time or date-filtered bookings
        const bookingsQuery = query(collection(db, "bookings"), ...queryFilters)
        const snapshot = await getDocs(bookingsQuery)

        let total = snapshot.size
        let completed = 0
        let workingDaysSet = new Set<string>()

        snapshot.forEach((docSnap) => {
          const data = docSnap.data()

          if (data.status?.toLowerCase() === "service_completed") {
            completed++
          }

          // ✅ Working days logic (only current month if no date selected)
          if (data.timeSlot instanceof Timestamp) {
            const slotDate = data.timeSlot.toDate()
            const isWithinRange = slotDate >= startDate && slotDate <= endDate
            if (isWithinRange) workingDaysSet.add(slotDate.toDateString())
          }
        })

        const rangeDurationMs = endDate.getTime() - startDate.getTime()
        const rangeDurationDays =
          Math.ceil(rangeDurationMs / (1000 * 60 * 60 * 24)) + 1

        const totalWorkingDays = workingDaysSet.size
        const totalNonWorkingDays = rangeDurationDays - totalWorkingDays

        setWorkingDays(totalWorkingDays)
        setNonWorkingDays(totalNonWorkingDays)

        // ✅ Always update total & completed bookings (both all-time and filtered)
        setPartner((prev) =>
          prev
            ? { ...prev, totalBookings: total, completedBookings: completed }
            : prev
        )
      } catch (err) {
        console.error("Failed to fetch bookings stats:", err)
      }
    }

    fetchBookingsStats()
  }, [partner?.id, db, fromDate, toDate])

  // Fetch wallet information (all-time by default)
  useEffect(() => {
    const fetchWalletInfo = async () => {
      if (!partner?.id) return
      try {
        setWalletLoading(true)
        const partnerRef = doc(db, "customer", partner.id)

        const walletQuery = query(
          collection(db, "Wallet_Overall"),
          where("service_partner_id", "==", partnerRef)
        )
        const snapshot = await getDocs(walletQuery)
        if (!snapshot.empty) {
          const [walletDoc] = snapshot.docs
          if (walletDoc) {
            const walletData = walletDoc.data()

            let filteredEarnings = 0
            if (fromDate && toDate) {
              const startDate = new Date(`${fromDate}T00:00:00`)
              const endDate = new Date(`${toDate}T23:59:59`)
              const fromTimestamp = Timestamp.fromDate(startDate)
              const toTimestamp = Timestamp.fromDate(endDate)

              const walletTransactionsQuery = query(
                collection(db, "Wallet_In_record"),
                where("partnerId", "==", partnerRef),
                where("Timestamp", ">=", fromTimestamp),
                where("Timestamp", "<=", toTimestamp)
              )
              const transactionsSnap = await getDocs(walletTransactionsQuery)

              transactionsSnap.forEach((docSnap) => {
                const transaction = docSnap.data()
                if (
                  transaction.payment_in_wallet &&
                  transaction.payment_in_wallet > 0
                ) {
                  filteredEarnings += transaction.payment_in_wallet
                }
              })
            } else {
              // ✅ All-time earnings
              const allTx = await getDocs(
                query(
                  collection(db, "Wallet_In_record"),
                  where("partnerId", "==", partnerRef)
                )
              )
              allTx.forEach((docSnap) => {
                const t = docSnap.data()
                if (t.payment_in_wallet && t.payment_in_wallet > 0) {
                  filteredEarnings += t.payment_in_wallet
                }
              })
            }

            setWalletInfo({
              id: walletDoc.id,
              ...walletData,
              filteredEarnings,
            } as any)
          }
        }
      } catch (err: any) {
        console.error("Failed to load wallet info:", err)
      } finally {
        setWalletLoading(false)
      }
    }

    fetchWalletInfo()
  }, [partner?.id, db, fromDate, toDate])

  // Fetch reviews (all-time by default)
  useEffect(() => {
    const fetchReviews = async () => {
      if (!partner?.id) return
      try {
        const partnerRef = doc(db, "customer", partner.id)

        let reviewsQueryRef
        if (fromDate && toDate) {
          const startDate = new Date(`${fromDate}T00:00:00`)
          const endDate = new Date(`${toDate}T23:59:59`)
          const fromTimestamp = Timestamp.fromDate(startDate)
          const toTimestamp = Timestamp.fromDate(endDate)

          reviewsQueryRef = query(
            collection(db, "reviews"),
            where("partnerId", "==", partnerRef),
            where("timestamp", ">=", fromTimestamp),
            where("timestamp", "<=", toTimestamp)
          )
        } else {
          reviewsQueryRef = query(
            collection(db, "reviews"),
            where("partnerId", "==", partnerRef)
          )
        }

        const snapshot = await getDocs(reviewsQueryRef)

        if (!snapshot.empty) {
          let total = 0
          let count = 0
          snapshot.forEach((doc) => {
            const data = doc.data() as any
            if (typeof data.partnerRating === "number" && data.partnerRating > 0) {
              total += data.partnerRating
              count++
            }
          })
          const avg = count > 0 ? total / count : 0
          setPartner((prev) =>
            prev ? { ...prev, ratings_average: avg, total_reviews: count } : prev
          )
        } else {
          setPartner((prev) =>
            prev ? { ...prev, ratings_average: 0, total_reviews: 0 } : prev
          )
        }
      } catch (err) {
        console.error("Failed to fetch reviews:", err)
      }
    }

    fetchReviews()
  }, [partner?.id, db, fromDate, toDate])

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp?.toDate) return "—"
    return timestamp.toDate().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== "number") return "₹0"
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getInitials = (name?: string) => {
    if (!name) return "P"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "onboarded":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case "suspended":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Suspended
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>
    }
  }

  const getKycBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "verified":
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status || "Verified"}</Badge>
    }
  }

  const getPartnerType = () => {
    if (!partner?.userType) return "Unknown"
    if (partner.userType.provider && partner.userType.AgencyPartner)
      return "Provider & Agency"
    if (partner.userType.provider) return "Service Provider"
    if (partner.userType.AgencyPartner) return "Agency Partner"
    return "Unknown"
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
          <AdminSidebar />
          <div className="flex flex-col sm:gap-4 sm:py-4">
            <AdminHeader title="Partner Details" />
            <main className="flex-1 p-4 md:p-6">
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading partner details...</span>
              </div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !partner) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
          <AdminSidebar />
          <div className="flex flex-col sm:gap-4 sm:py-4">
            <AdminHeader title="Partner Details" />
            <main className="flex-1 p-4 md:p-6">
              <Card>
                <CardContent className="p-8 text-center">
                  <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                  <h3 className="text-lg font-semibold mb-2">Partner Not Found</h3>
                  <p className="text-muted-foreground mb-4">
                    {error || "The requested partner could not be found."}
                  </p>
                  <Button onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back
                  </Button>
                </CardContent>
              </Card>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AdminSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <AdminHeader title="Partner Management" />
          <main className="flex-1 space-y-6 p-4 md:p-6">
            {/* Back Button */}
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Partners
              </Button>
            </div>

            {/* ✅ Date Range Filter */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-lg border">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Filter partner data by date range
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border rounded px-3 py-2 text-sm"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border rounded px-3 py-2 text-sm"
                />
                <button
                  onClick={clearFilter}
                  className="bg-gray-200 hover:bg-gray-300 text-sm px-3 py-2 rounded whitespace-nowrap"
                >
                  Show All Time
                </button>
              </div>
            </div>

            {/* Partner Profile Card - (remains unchanged) */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex flex-col items-center lg:items-start gap-4">
                    <Avatar className="w-24 h-24">
                      <AvatarImage
                        src={partner.photo_url}
                        alt={partner.display_name || partner.customer_name}
                      />
                      <AvatarFallback className="text-lg">
                        {getInitials(partner.display_name || partner.customer_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center lg:text-left">
                      <h2 className="text-2xl font-bold">
                        {partner.display_name ||
                          partner.customer_name ||
                          "Unknown Partner"}
                      </h2>
                      <p className="text-muted-foreground">
                        Partner ID: {partner.uid || partner.id}
                      </p>
                      <div className="flex flex-col gap-2 mt-2">
                        <Badge variant="outline" className="w-fit">
                          <Building2 className="w-3 h-3 mr-1" />
                          {getPartnerType()}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator orientation="vertical" className="hidden lg:block" />

                  <div className="flex-1 grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        Contact Information
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Email</p>
                            <p className="text-sm text-muted-foreground">
                              {partner.email || "Not provided"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Phone</p>
                            <p className="text-sm text-muted-foreground">
                              {partner.phone_number ||
                                (partner.contact_no
                                  ? String(partner.contact_no)
                                  : "Not provided")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">City</p>
                            <p className="text-sm text-muted-foreground">
                              {partner.city || "Indore"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Joined</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(partner.created_time)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        Status & Performance
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Activity className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Partner Status</p>
                            {getStatusBadge(partner.partner_status)}
                          </div>
                        </div>

                        {/* ✅ Subscription expiry + remaining days */}
                        <div className="flex items-center gap-3">
                          <CalendarDays className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Subscription</p>
                            {subscriptionLoading ? (
                              <p className="text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                Loading...
                              </p>
                            ) : subscriptionInfo?.expiryDate ? (
                              <p className="text-sm text-muted-foreground">
                                Expiry:{" "}
                                <span className="font-medium text-foreground">
                                  {formatDate(subscriptionInfo.expiryDate)}
                                </span>
                                {typeof subscriptionInfo.remaining_days === "number" ? (
                                  <>
                                    {" "}
                                    • Remaining:{" "}
                                    <span className="font-medium text-foreground">
                                      {subscriptionInfo.remaining_days} days
                                    </span>
                                  </>
                                ) : null}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No subscription found
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">KYC Status</p>
                            {getKycBadge(partner.kyc_status)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Star className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Rating</p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {partner.ratings_average?.toFixed(1) || "0.0"}
                              </span>
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs text-muted-foreground">
                                ({partner.total_reviews || 0} reviews)
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Wallet className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Pending Payout</p>
                            <p className="text-sm font-bold">
                              {walletLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin inline" />
                              ) : (
                                formatCurrency(walletInfo?.total_balance || 0)
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {partner.services && partner.services.length > 0 && (
                  <>
                    <Separator className="my-6" />
                    <div>
                      <h4 className="font-medium mb-3">Services Offered</h4>
                      <div className="flex flex-wrap gap-2">
                        {partner.services.map((service, index) => (
                          <Badge key={index} variant="outline">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Earnings</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(walletInfo?.filteredEarnings || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Earnings in selected date range
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Completed Bookings</p>
                      <p className="text-2xl font-bold">
                        {partner?.completedBookings || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        In selected date range
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Briefcase className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Working Days</p>
                      <p className="text-2xl font-bold">{workingDays}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {nonWorkingDays} non-working days in range
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Star className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Rating</p>
                      <p className="text-2xl font-bold">
                        {partner.ratings_average?.toFixed(1) || "0.0"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on {partner.total_reviews || 0} reviews in range
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Sections */}
            <Card>
              <CardHeader>
                <CardTitle>Partner Management</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList
                    className={`grid w-full ${
                      partner?.userType?.AgencyPartner
                        ? "grid-cols-9" // Show 9 tabs when agency partner
                        : "grid-cols-8" // Show 8 tabs otherwise
                    }`}
                  >
                    <TabsTrigger value="earnings" className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      <span className="hidden sm:inline">Earnings</span>
                    </TabsTrigger>
                    <TabsTrigger value="bookings" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="hidden sm:inline">Bookings</span>
                    </TabsTrigger>
                    <TabsTrigger value="loans" className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      <span className="hidden sm:inline">Loans</span>
                    </TabsTrigger>
                    <TabsTrigger value="credits" className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      <span className="hidden sm:inline">Credits</span>
                    </TabsTrigger>

                    {/* ✅ Attendance tab → only for Agency Partners */}
                    {partner?.userType?.AgencyPartner && (
                      <TabsTrigger value="attendance" className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Attendance</span>
                      </TabsTrigger>
                    )}

                    {/* ✅ Fuel tab → only for Agency Partners */}
                    {partner?.userType?.AgencyPartner && (
                      <TabsTrigger value="fuel" className="flex items-center gap-2">
                        <Fuel className="w-4 h-4" />
                        <span className="hidden sm:inline">Fuel Expense</span>
                      </TabsTrigger>
                    )}

                    {/* ✅ Availability tab → only for Service Providers */}
                    {partner?.userType?.provider && (
                      <TabsTrigger
                        value="availability"
                        className="flex items-center gap-2"
                      >
                        <CalendarDays className="w-4 h-4" />
                        <span className="hidden sm:inline">Availability</span>
                      </TabsTrigger>
                    )}

                    <TabsTrigger value="chemicals" className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      <span className="hidden sm:inline">Chemicals</span>
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">Reviews</span>
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Documents</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="earnings" className="mt-6">
                    <PartnerEarningsSection
                      partnerId={partnerId}
                      fromDate={fromDate}
                      toDate={toDate}
                    />
                  </TabsContent>
                  <TabsContent value="bookings" className="mt-6">
                    <PartnerBookingsSection partnerId={partnerId} />
                  </TabsContent>
                  <TabsContent value="loans" className="mt-6">
                    <PartnerLoansSection
                      partnerId={partnerId}
                      fromDate={fromDate}
                      toDate={toDate}
                    />
                  </TabsContent>
                  <TabsContent value="credits" className="mt-6">
                    <PartnerCreditsSection partnerId={partnerId} />
                  </TabsContent>
                  <TabsContent value="attendance" className="mt-6">
                    <PartnerAttendance
                      partnerName="Vishal Bodre"
                      startDate={fromDate}
                      endDate={toDate}
                    />
                  </TabsContent>

                  <TabsContent value="fuel" className="mt-6">
                    <PartnerFuelSection
                      partnerId={partnerId}
                      fromDate={fromDate}
                      toDate={toDate}
                    />
                  </TabsContent>

                  <TabsContent value="availability" className="mt-6">
                    <PartnerAvailabilitySection partnerId={partnerId} />
                  </TabsContent>

                  <TabsContent value="documents" className="mt-6">
                    <PartnerDocumentsSection partnerId={partnerId} />
                  </TabsContent>
                  <TabsContent value="chemicals" className="mt-6">
                    <PartnerChemicalsSection partnerId={partnerId} />
                  </TabsContent>
                  <TabsContent value="reviews" className="mt-6">
                    <PartnerReviewsSection partnerId={partnerId} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
