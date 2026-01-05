// app/admin/customers/[id]/sections/customer-referrals.tsx
"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Calendar,
  Loader2,
  Users,
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
  Download
} from "lucide-react"
import * as XLSX from "xlsx"

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
  provider_id?: any
  status?: string
  date?: Timestamp
  timeSlot?: Timestamp
  subCategoryCart_id?: any
  service_id?: string
  package_id?: string
  amount_paid?: number
  otp?: number
  address?: any
  checkoutItems?: any[]
  cartClone_id?: any
  itemOptions_id?: string
}

const PAGE_SIZE = 5

interface CustomerReferralsTabProps {
  customer: CustomerDoc
}

export function CustomerReferralsTab({ customer }: CustomerReferralsTabProps) {
  const db = getFirestoreDb()
  
  const [referredCustomers, setReferredCustomers] = useState<CustomerDoc[]>([])
  const [referredBookings, setReferredBookings] = useState<Record<string, BookingDoc[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const fetchReferrals = async () => {
      if (!customer?.id) return

      try {
        setLoading(true)
        const referralCode = customer.referralCode

        if (!referralCode) {
          setReferredCustomers([])
          setLoading(false)
          return
        }

        const referralsQuery = query(
          collection(db, "customer"),
          where("referralBy", "==", referralCode)
        )

        const snapshot = await getDocs(referralsQuery)
        const referred = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CustomerDoc[]

        setReferredCustomers(referred)

        const bookingsMap: Record<string, BookingDoc[]> = {}

        await Promise.all(
          referred.map(async (ref) => {
            try {
              const refCustomerRef = doc(db, "customer", ref.id)
              const bookingsQuery = query(
                collection(db, "bookings"),
                where("customer_id", "==", refCustomerRef)
              )

              const bookingsSnapshot = await getDocs(bookingsQuery)
              bookingsMap[ref.id] = bookingsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as BookingDoc[]
            } catch {
              bookingsMap[ref.id] = []
            }
          })
        )

        setReferredBookings(bookingsMap)
      } finally {
        setLoading(false)
      }
    }

    fetchReferrals()
  }, [customer?.id, customer?.referralCode, db])

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp?.toDate) return "—"
    return timestamp.toDate().toLocaleString()
  }

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== "number") return "₹0"
    return `₹${amount.toLocaleString()}`
  }

  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  const totalReferrals = referredCustomers.length
  const totalReferralBookings = Object.values(referredBookings).reduce(
    (sum, bookings) => sum + bookings.length,
    0
  )
  const totalReferralEarnings = Object.values(referredBookings)
    .flat()
    .filter(
      b =>
        b.status?.toLowerCase() === "completed" ||
        b.status?.toLowerCase() === "service_completed"
    )
    .reduce((sum, b) => sum + (b.amount_paid || 0), 0)

  const filteredReferredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return referredCustomers

    return referredCustomers.filter(refCustomer => {
      const text = [
        refCustomer.id,
        refCustomer.display_name,
        refCustomer.customer_name,
        refCustomer.email,
        refCustomer.phone_number,
        refCustomer.contact_no?.toString(),
      ]
        .map(v => (v ?? "").toString().toLowerCase())
        .join(" ")

      return text.includes(term)
    })
  }, [referredCustomers, searchTerm])

  const paginatedReferredCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredReferredCustomers.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredReferredCustomers, currentPage])

  const totalPages = Math.ceil(filteredReferredCustomers.length / PAGE_SIZE)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const handleDownloadExcel = () => {
    const rows = filteredReferredCustomers.map(refCustomer => {
      const bookings = referredBookings[refCustomer.id] || []
      const completed = bookings.filter(
        b =>
          b.status?.toLowerCase() === "completed" ||
          b.status?.toLowerCase() === "service_completed"
      )

      return {
        "Customer ID": refCustomer.id,
        "Name": refCustomer.display_name || refCustomer.customer_name || "",
        "Email": refCustomer.email || "",
        "Phone":
          refCustomer.phone_number ||
          (refCustomer.contact_no ? String(refCustomer.contact_no) : ""),
        "Joined Date": refCustomer.created_time
          ? refCustomer.created_time.toDate().toLocaleString()
          : "",
        "Total Bookings": bookings.length,
        "Completed Bookings": completed.length,
        "Total Spent (₹)": completed.reduce(
          (sum, b) => sum + (b.amount_paid || 0),
          0
        ),
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Referrals")

    XLSX.writeFile(
      workbook,
      `referrals_${customer.id}_${new Date().toISOString().slice(0, 10)}.xlsx`
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Referral Summary</h3>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4">
          <Users className="w-5 h-5 text-blue-600" /> {totalReferrals}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <Calendar className="w-5 h-5 text-green-600" /> {totalReferralBookings}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <DollarSign className="w-5 h-5 text-purple-600" /> {formatCurrency(totalReferralEarnings)}
        </CardContent></Card>
      </div>

      {referredCustomers.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4" />
            <Input
              placeholder="Search referred customers..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadExcel}
            disabled={filteredReferredCustomers.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      )}

      {/* rest of render unchanged */}
    </div>
  )
}
