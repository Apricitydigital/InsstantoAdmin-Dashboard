"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useParams, useRouter } from "next/navigation"
import { collection, doc, getDoc, getDocs, query, Timestamp, where } from "firebase/firestore"
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, History, Mail, MapPin, Phone, Star, TrendingUp, UserPlus, Users, Wallet, XCircle } from "lucide-react"

import { AdminHeader } from "@/components/admin-header"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getFirestoreDb } from "@/lib/firebase"
import { cacheCustomerNavigationPreview, readCustomerNavigationPreview } from "@/lib/customer-navigation-cache"

const TabLoading = () => <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
const CustomerBookingsTab = dynamic(() => import("./sections/customer-bookings").then((module) => module.CustomerBookingsTab), { loading: TabLoading })
const CustomerCreditsTab = dynamic(() => import("./sections/customer-credits").then((module) => module.CustomerCreditsTab), { loading: TabLoading })
const CustomerReferralsTab = dynamic(() => import("./sections/customer-referrals").then((module) => module.CustomerReferralsTab), { loading: TabLoading })

type CustomerDoc = {
  id: string; uid?: string; email?: string; display_name?: string; customer_name?: string
  phone_number?: string; contact_no?: number; created_time?: Timestamp; photo_url?: string
  address?: any; bio?: string; referralCode?: string; Subscription?: string
}
type BookingDoc = { id: string; status?: string; amount_paid?: number }
type WalletDoc = { id: string; credit_balance?: number }

function formatCustomerAddress(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Not provided"

  const address = value as Record<string, unknown>
  const completeAddress = [
    address.formatted_address,
    address.formattedAddress,
    address.full_address,
    address.fullAddress,
    address.address,
    address.label,
  ].find((part) => typeof part === "string" && part.trim())

  if (typeof completeAddress === "string") return completeAddress.trim()

  const addressParts = [
    address.house_number,
    address.houseNumber,
    address.street,
    address.area,
    address.landmark,
    address.city,
    address.state,
    address.pincode,
    address.postalCode,
  ].filter((part): part is string | number =>
    (typeof part === "string" && Boolean(part.trim())) || typeof part === "number"
  )

  return addressParts.length > 0 ? addressParts.join(", ") : "Not provided"
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

  useEffect(() => {
    if (!customerId) return
    let active = true
    const customerRef = doc(db, "customer", customerId)
    const cachedPreview = readCustomerNavigationPreview(customerId)

    if (cachedPreview) {
      setCustomer({
        id: cachedPreview.id,
        uid: cachedPreview.uid,
        display_name: cachedPreview.displayName,
        email: cachedPreview.email,
        phone_number: cachedPreview.phone === "—" ? undefined : cachedPreview.phone,
        photo_url: cachedPreview.photoUrl,
        Subscription: cachedPreview.subscription,
        referralCode: cachedPreview.referralCode,
        created_time: cachedPreview.createdTimeMs ? Timestamp.fromMillis(cachedPreview.createdTimeMs) : undefined,
      })
      setLoading(false)
    } else {
      setLoading(true)
    }
    setWalletLoading(true)
    setError("")

    getDoc(customerRef)
      .then((snapshot) => {
        if (!active) return
        if (!snapshot.exists()) {
          setError("Customer not found")
          return
        }
        const freshCustomer = { id: snapshot.id, ...snapshot.data() } as CustomerDoc
        setCustomer(freshCustomer)
        cacheCustomerNavigationPreview({
          id: freshCustomer.id,
          uid: freshCustomer.uid,
          displayName: freshCustomer.display_name || freshCustomer.customer_name,
          email: freshCustomer.email,
          phone: freshCustomer.phone_number || (freshCustomer.contact_no ? String(freshCustomer.contact_no) : undefined),
          photoUrl: freshCustomer.photo_url,
          subscription: freshCustomer.Subscription,
          referralCode: freshCustomer.referralCode,
          createdTimeMs: freshCustomer.created_time?.toMillis?.(),
        })
      })
      .catch((reason) => {
        if (!active) return
        if (!cachedPreview) setError(reason?.message || "Failed to load customer details")
      })
      .finally(() => active && setLoading(false))

    getDocs(query(collection(db, "bookings"), where("customer_id", "==", customerRef)))
      .then((snapshot) => {
        if (active) setBookings(snapshot.docs.map((booking) => ({ id: booking.id, ...booking.data() })) as BookingDoc[])
      })
      .catch((reason) => console.error("Failed to load booking statistics:", reason))

    ;(async () => {
      try {
        const walletQuery = query(collection(db, "partner_overall_credits"), where("service_partner_id", "==", customerRef))
        const snapshot = await getDocs(walletQuery)
        if (!active) return
        if (!snapshot.empty) {
          const wallet = snapshot.docs[0]
          setWalletInfo({ id: wallet.id, ...wallet.data() } as WalletDoc)
        } else {
          const directWallet = await getDoc(doc(db, "partner_overall_credits", customerId))
          if (active && directWallet.exists()) setWalletInfo({ id: directWallet.id, ...directWallet.data() } as WalletDoc)
        }
      } catch (reason) {
        console.error("Failed to load wallet statistics:", reason)
      } finally {
        if (active) setWalletLoading(false)
      }
    })()

    return () => { active = false }
  }, [customerId, db])

  const formatDate = (timestamp?: Timestamp) => timestamp?.toDate ? timestamp.toDate().toLocaleString() : "—"
  const formatCurrency = (amount?: number) => `₹${(typeof amount === "number" ? amount : 0).toLocaleString()}`
  const displayName = customer?.display_name || customer?.customer_name || "Unknown customer"
  const initials = displayName.split(/\s+/).slice(0, 2).map((name) => name[0]).join("").toUpperCase() || "CU"
  const phone = customer?.phone_number || (customer?.contact_no ? String(customer.contact_no) : "Not provided")
  const address = formatCustomerAddress(customer?.address)
  const completedBookings = bookings.filter((booking) => ["completed", "service_completed"].includes(booking.status?.toLowerCase() || ""))
  const totalSpent = completedBookings.reduce((total, booking) => total + (booking.amount_paid || 0), 0)

  const shell = (content: React.ReactNode) => (
    <ProtectedRoute>
      <div className="flex min-h-screen w-full flex-col bg-slate-50/80">
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <AdminHeader title="Customer Details" />
          <main className="mx-auto w-full max-w-[1800px] flex-1 p-3 sm:p-5 lg:p-6">{content}</main>
        </div>
      </div>
    </ProtectedRoute>
  )

  if (loading) {
    return shell(
      <div className="space-y-4" aria-label="Loading customer details">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-56 animate-pulse rounded-2xl border bg-white" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border bg-white" />)}</div>
        <div className="h-72 animate-pulse rounded-2xl border bg-white" />
      </div>
    )
  }

  if (error || !customer) {
    return shell(
      <Card className="mx-auto mt-12 max-w-lg border-slate-200 shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50"><XCircle className="h-7 w-7 text-red-500" /></div>
          <h2 className="text-lg font-semibold text-slate-950">Customer not found</h2>
          <p className="mb-5 mt-2 text-sm text-slate-500">{error || "The requested customer could not be found."}</p>
          <Button onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Go back</Button>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    { label: "Total bookings", value: bookings.length.toLocaleString(), hint: "All booking activity", icon: CalendarDays, style: "bg-blue-50 text-blue-600" },
    { label: "Completed", value: completedBookings.length.toLocaleString(), hint: "Successfully delivered", icon: CheckCircle2, style: "bg-emerald-50 text-emerald-600" },
    { label: "Total spent", value: formatCurrency(totalSpent), hint: "Completed bookings", icon: TrendingUp, style: "bg-violet-50 text-violet-600" },
    { label: "Wallet balance", value: walletLoading ? "Loading…" : formatCurrency(walletInfo?.credit_balance), hint: "Available credits", icon: Wallet, style: "bg-amber-50 text-amber-600" },
  ]

  return shell(
    <div className="space-y-5">
      <Button variant="ghost" onClick={() => router.back()} className="-ml-2 text-slate-600 hover:text-slate-950"><ArrowLeft className="mr-2 h-4 w-4" />Back to customers</Button>

      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50 shadow-sm">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.6fr)] lg:items-center">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <Avatar className="h-20 w-20 border-4 border-white shadow-md sm:h-24 sm:w-24">
              <AvatarImage src={customer.photo_url} alt={displayName} /><AvatarFallback className="bg-indigo-100 text-xl font-semibold text-indigo-700">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{displayName}</h1>
                {customer.Subscription === "Active" && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Star className="mr-1 h-3 w-3" />Premium</Badge>}
              </div>
              <p className="mt-1 max-w-xs truncate font-mono text-xs text-slate-400">{customer.uid || customer.id}</p>
              {customer.bio && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{customer.bio}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Mail, label: "Email", value: customer.email || "Not provided" },
              { icon: Phone, label: "Phone", value: phone },
              { icon: CalendarDays, label: "Member since", value: formatDate(customer.created_time) },
              { icon: UserPlus, label: "Referral code", value: customer.referralCode || "Not generated" },
              { icon: MapPin, label: "Address", value: address, wide: true },
            ].map((item) => (
              <div key={item.label} className={`flex min-w-0 items-start gap-3 rounded-xl border border-white/80 bg-white/80 p-3 shadow-sm ${item.wide ? "sm:col-span-2" : ""}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><item.icon className="h-4 w-4" /></div>
                <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p><p className={`mt-0.5 text-sm font-medium text-slate-700 ${item.wide ? "whitespace-normal break-words leading-5" : "truncate"}`} title={item.value}>{item.value}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => <Card key={stat.label} className="border-slate-200 shadow-sm"><CardContent className="flex items-center gap-4 p-4 sm:p-5"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.style}`}><stat.icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-sm font-medium text-slate-500">{stat.label}</p><p className="truncate text-2xl font-bold text-slate-950">{stat.value}</p><p className="text-xs text-slate-400">{stat.hint}</p></div></CardContent></Card>)}
      </section>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-slate-200 bg-slate-50/60 p-2 sm:p-3">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
              <TabsTrigger value="bookings" className="min-w-fit gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"><History className="h-4 w-4" />Booking history</TabsTrigger>
              <TabsTrigger value="credits" className="min-w-fit gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"><CreditCard className="h-4 w-4" />Credits</TabsTrigger>
              <TabsTrigger value="referrals" className="min-w-fit gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"><Users className="h-4 w-4" />Referrals</TabsTrigger>
            </TabsList>
          </div>
          <CardContent className="p-3 sm:p-5 lg:p-6">
            <TabsContent value="bookings" className="m-0"><CustomerBookingsTab customerId={customerId} /></TabsContent>
            <TabsContent value="credits" className="m-0"><CustomerCreditsTab customerId={customerId} /></TabsContent>
            <TabsContent value="referrals" className="m-0"><CustomerReferralsTab customer={customer} /></TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
