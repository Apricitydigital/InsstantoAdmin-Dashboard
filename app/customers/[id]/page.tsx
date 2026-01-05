// app/admin/customers/[id]/page.tsx
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
  Calendar, 
  Wallet, 
  Star,
  CheckCircle,
  TrendingUp,
  Loader2,
  XCircle,
  UserPlus,
  History,
  CreditCard,
  Users
} from "lucide-react"

// Import tab components
import { CustomerBookingsTab } from "./sections/customer-bookings"
import { CustomerCreditsTab } from "./sections/customer-credits"
import { CustomerReferralsTab } from "./sections/customer-referrals"

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
  edited_time?: Timestamp
  location?: any
  photo_url?: string
  address?: any
  bio?: string
  referralBy?: string
  referralCode?: string
  Subscription?: string
}

type BookingDoc = {
  id: string
  customer_id?: any
  status?: string
  date?: Timestamp
  amount_paid?: number
}

type WalletDoc = {
  id: string
  credit_balance?: number
}

export default function CustomerDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string
  const db = getFirestoreDb()

  const [customer, setCustomer] = useState<CustomerDoc | null>(null)
  const [bookings, setBookings] = useState<BookingDoc[]>([])
  const [walletInfo, setWalletInfo] = useState<WalletDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [walletLoading, setWalletLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("bookings")

  // Fetch customer details
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!customerId) return
      
      try {
        setLoading(true)
        const customerDoc = await getDoc(doc(db, "customer", customerId))
        
        if (customerDoc.exists()) {
          setCustomer({ id: customerDoc.id, ...customerDoc.data() } as CustomerDoc)
        } else {
          setError("Customer not found")
        }
      } catch (err: any) {
        setError(err.message || "Failed to load customer details")
      } finally {
        setLoading(false)
      }
    }

    fetchCustomer()
  }, [customerId, db])

  // Fetch bookings for statistics
  useEffect(() => {
    const fetchBookings = async () => {
      if (!customer?.id) return

      try {
        const customerRef = doc(db, "customer", customer.id)
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("customer_id", "==", customerRef)
        )

        const snapshot = await getDocs(bookingsQuery)
        const bookingDocs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as BookingDoc[]

        setBookings(bookingDocs)
      } catch (err: any) {
        console.error("Failed to load bookings for stats:", err)
      }
    }

    fetchBookings()
  }, [customer?.id, db])

  // Fetch wallet info for statistics
  useEffect(() => {
    const fetchWalletInfo = async () => {
      if (!customer?.id) return

      try {
        setWalletLoading(true)
        const customerRef = doc(db, "customer", customer.id)
        
        const walletQuery = query(
          collection(db, "partner_overall_credits"),
          where("service_partner_id", "==", customerRef)
        )
        const snapshot = await getDocs(walletQuery)
        
        if (!snapshot.empty) {
          const walletDoc = snapshot.docs[0]
          setWalletInfo({ id: walletDoc.id, ...walletDoc.data() } as WalletDoc)
        } else {
          const directWalletDoc = await getDoc(doc(db, "partner_overall_credits", customer.id))
          if (directWalletDoc.exists()) {
            setWalletInfo({ id: directWalletDoc.id, ...directWalletDoc.data() } as WalletDoc)
          }
        }
      } catch (err: any) {
        console.error("Failed to load wallet info:", err)
      } finally {
        setWalletLoading(false)
      }
    }

    fetchWalletInfo()
  }, [customer?.id, db])

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp?.toDate) return "—"
    return timestamp.toDate().toLocaleString()
  }

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== 'number') return "₹0"
    return `₹${amount.toLocaleString()}`
  }

  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  // Calculate statistics
  const totalBookings = bookings.length
  const completedBookings = bookings.filter(b => 
    b.status?.toLowerCase() === 'completed' || b.status?.toLowerCase() === 'service_completed'
  ).length
  const totalSpent = bookings
    .filter(b => b.status?.toLowerCase() === 'completed' || b.status?.toLowerCase() === 'service_completed')
    .reduce((sum, b) => sum + (b.amount_paid || 0), 0)

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
          <AdminSidebar />
          <div className="flex flex-col sm:gap-4 sm:py-4">
            <AdminHeader title="Customer Details" />
            <main className="flex-1 p-4 md:p-6">
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading customer details...</span>
              </div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !customer) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
          <AdminSidebar />
          <div className="flex flex-col sm:gap-4 sm:py-4">
            <AdminHeader title="Customer Details" />
            <main className="flex-1 p-4 md:p-6">
              <Card>
                <CardContent className="p-8 text-center">
                  <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                  <h3 className="text-lg font-semibold mb-2">Customer Not Found</h3>
                  <p className="text-muted-foreground mb-4">{error || "The requested customer could not be found."}</p>
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
          <AdminHeader title="Customer Details" />
          <main className="flex-1 space-y-6 p-4 md:p-6">
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Customers
              </Button>
            </div>

            {/* Customer Profile Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Avatar and Basic Info */}
                  <div className="flex flex-col items-center md:items-start gap-4">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={customer.photo_url} alt={customer.display_name || customer.customer_name} />
                      <AvatarFallback className="text-lg">
                        {getInitials(customer.display_name || customer.customer_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center md:text-left">
                      <h2 className="text-2xl font-bold">{customer.display_name || customer.customer_name || "Unknown Customer"}</h2>
                      <p className="text-muted-foreground">Customer ID: {customer.uid || customer.id}</p>
                      {customer.Subscription === "Active" && (
                        <Badge className="mt-2 bg-green-100 text-green-800">
                          <Star className="w-3 h-3 mr-1" />
                          Premium Member
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator orientation="vertical" className="hidden md:block" />

                  {/* Contact Information */}
                  <div className="flex-1 grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-sm text-muted-foreground">{customer.email || "Not provided"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Phone</p>
                          <p className="text-sm text-muted-foreground">
                            {customer.phone_number || (customer.contact_no ? String(customer.contact_no) : "Not provided")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Member Since</p>
                          <p className="text-sm text-muted-foreground">{formatDate(customer.created_time)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <UserPlus className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Referral Code</p>
                          <p className="text-sm font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                            {customer.referralCode || "Not generated"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {customer.bio && (
                  <>
                    <Separator className="my-6" />
                    <div>
                      <h4 className="font-medium mb-2">Bio</h4>
                      <p className="text-sm text-muted-foreground">{customer.bio}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Bookings</p>
                      <p className="text-2xl font-bold">{totalBookings}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Completed</p>
                      <p className="text-2xl font-bold">{completedBookings}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Spent</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Wallet className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Wallet Balance</p>
                      <p className="text-2xl font-bold">
                        {walletLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(walletInfo?.credit_balance || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabbed Content */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="bookings" className="flex items-center gap-2">
                      <History className="w-4 h-4" />
                      <span className="hidden sm:inline">Booking History</span>
                      <span className="sm:hidden">Bookings</span>
                    </TabsTrigger>
                    <TabsTrigger value="credits" className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      <span className="hidden sm:inline">Credits Summary</span>
                      <span className="sm:hidden">Credits</span>
                    </TabsTrigger>
                    <TabsTrigger value="referrals" className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span className="hidden sm:inline">Referral Summary</span>
                      <span className="sm:hidden">Referrals</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Bookings Tab */}
                  <TabsContent value="bookings" className="mt-6">
                    <CustomerBookingsTab customerId={customerId} />
                  </TabsContent>

                  {/* Credits Tab */}
                  <TabsContent value="credits" className="mt-6">
                    <CustomerCreditsTab customerId={customerId} />
                  </TabsContent>

                  {/* Referrals Tab */}
                  <TabsContent value="referrals" className="mt-6">
                    <CustomerReferralsTab customer={customer} />
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