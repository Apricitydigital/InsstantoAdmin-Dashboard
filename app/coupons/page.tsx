"use client"

import { useEffect, useState } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Search, Percent, Calendar, Users } from "lucide-react"   // removed DollarSign, Plus
import { collection, onSnapshot } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// Define the coupon type
type Coupon = {
  coupon_code: string;
  amount: number;
  expire_date: any;
  status: string;
  assigned_userId: string[];
  user_used: any[];
  percentage: number;
  usedCount: number;
  usageLimit: number;
}

export default function CouponsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New state for handling modal
  const [openDetails, setOpenDetails] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)

  // Format expire date to human-readable format
  const formatDate = (timestamp: any) => {
    if (timestamp && timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString("en-IN", {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    }
    return "Invalid Date"
  }

  useEffect(() => {
    const db = getFirestoreDb()

    // Real-time listener for the coupons collection
    const unsubscribe = onSnapshot(
      collection(db, "coupon"),
      (snapshot) => {
        const fetchedCoupons = snapshot.docs.map((doc) => {
          const data = doc.data() as Coupon
          return {
            id: doc.id, // Add document ID to the coupon data
            ...data,
          }
        })
        setCoupons(fetchedCoupons)
        setLoading(false)
      },
      (err) => {
        console.error("Error fetching coupons:", err)
        setError("Failed to fetch coupons.")
        setLoading(false)
      }
    )

    return () => unsubscribe() // Clean up the listener when the component unmounts
  }, [])

  const filteredCoupons = coupons.filter(
    (coupon) =>
      coupon.coupon_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coupon.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalCoupons = coupons.length
  const totalUsage = coupons.reduce((sum, c) => sum + (Number(c.usedCount) || 0), 0)
  const totalSavings = coupons.reduce((sum, c) => {
    const used = Number(c.usedCount) || 0
    const percentage = Number(c.percentage) || 0
    return sum + used * percentage
  }, 0)

  // ✅ Active Coupons = status "Unused" + not expired
  const today = new Date()
  const activeCoupons = coupons.filter((c) => {
    const isUnused = c.status === "Unused"
    let isValid = false
    if (c.expire_date && c.expire_date.toDate) {
      isValid = c.expire_date.toDate() >= today
    }
    return isUnused && isValid
  }).length

  const handleViewUsers = (coupon: Coupon) => {
    setSelectedCoupon(coupon)
    setOpenDetails(true)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coupons & Offers</h1>
            <p className="text-gray-600">Manage promotional codes and discount offers</p>
          </div>
          {/* ❌ Removed Create Coupon button */}
        </div>

        {loading && <div>Loading...</div>}
        {error && <div className="text-red-500">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Percent className="w-8 h-8 text-blue-600" />
                <Badge variant="secondary">{totalCoupons}</Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-blue-900">{totalCoupons}</CardTitle>
              <CardDescription className="text-blue-700">Total Coupons</CardDescription>
            </CardHeader>
          </Card>

          {/* ✅ Active Coupons now = unused + valid */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Percent className="w-8 h-8 text-green-600" />
                <Badge variant="secondary">{activeCoupons}</Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-green-900">{activeCoupons}</CardTitle>
              <CardDescription className="text-green-700">Active Coupons</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Users className="w-8 h-8 text-purple-600" />
                <Badge variant="secondary">{totalUsage}</Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-purple-900">{totalUsage}</CardTitle>
              <CardDescription className="text-purple-700">Total Usage</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Calendar className="w-8 h-8 text-orange-600" />
                <Badge variant="secondary">
                  ₹{Number.isFinite(totalSavings) ? totalSavings.toLocaleString() : "0"}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-orange-900">
                ₹{Number.isFinite(totalSavings) ? totalSavings.toLocaleString() : "0"}
              </CardTitle>
              <CardDescription className="text-orange-700">Customer Savings</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search coupons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Mobile View - Cards for Each Coupon */}
        <div className="md:hidden">
          {filteredCoupons.map((coupon) => (
            <Card key={coupon.coupon_code} className="mb-4 p-4">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="font-medium">{coupon.coupon_code}</div>
                  <Badge variant="outline">{coupon.status}</Badge>
                </div>
              </CardHeader>
              <CardDescription>
                <div>Amount: ₹{Number(coupon.amount) || 0}</div>
                <div>Valid Until: {formatDate(coupon.expire_date)}</div>
                <div>Usage: {Number(coupon.usedCount) || 0}/{Number(coupon.usageLimit) || 0}</div>
              </CardDescription>
              <Button variant="outline" size="sm" onClick={() => handleViewUsers(coupon)}>
                View Users
              </Button>
            </Card>
          ))}
        </div>

        {/* Table View - Desktop */}
        <Card className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCoupons.map((coupon) => (
                <TableRow key={coupon.coupon_code}>
                  <TableCell className="font-mono font-medium">{coupon.coupon_code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{coupon.coupon_code}</div>
                      <div className="text-sm text-gray-500">{coupon.status}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {coupon.percentage ? `${coupon.percentage}%` : `₹${Number(coupon.amount) || 0}`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {coupon.percentage ? `${coupon.percentage}%` : `₹${Number(coupon.amount) || 0}`}
                  </TableCell>
                  
                  <TableCell>{formatDate(coupon.expire_date)}</TableCell>
                  <TableCell>
                    <Badge variant={coupon.status === "Active" ? "default" : "secondary"}>
                      {coupon.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewUsers(coupon)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Modal for Viewing Users */}
      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent className="w-full sm:w-96 p-4 max-w-full">
          <DialogHeader>
            <DialogTitle>Users Who Used {selectedCoupon?.coupon_code}</DialogTitle>
            <DialogDescription>
              Here is the list of customers who used this coupon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCoupon?.user_used?.length === 0 ? (
              <p>No users have used this coupon yet.</p>
            ) : (
              selectedCoupon?.user_used?.map((user, index) => {
                const userId = user?.userId || "Unknown";  // Access the userId field safely
                return (
                  <div key={index} className="p-2 border rounded">
                    <span>User ID: {userId}</span>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
