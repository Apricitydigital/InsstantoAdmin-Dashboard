"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { TrendingUp, Users, DollarSign, Target, Globe, CreditCard, MessageCircle, Loader2 } from "lucide-react"
import { mockMarketingMetrics } from "@/lib/queries/analytics"
import { fetchBookingStats, fetchCategoryWiseBookings } from "@/lib/queries/dashboard"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { set } from "date-fns"

export function MarketingMetrics() {
  const [isLoading, setIsLoading] = useState(false)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [completedBookings, setCompletedBookings] = useState(0)
  const [cancelledBookings, setCancelledBookings] = useState(0)
  const [totalAmountPaid, setTotalAmountPaid] = useState(0)
  const [totalBookingAmount, setTotalBookingAmount] = useState(0)
  const [totalComplaints, setTotalComplaints] = useState(0)
  const [resolvedComplaints, setResolvedComplaints] = useState(0)
  const [netProfit, setNetProfit] = useState(0)
  const [marginPercentage, setMarginPercentage] = useState(0)
  const [avgOrderValue, setAvgOrderValue] = useState(0)
  const [customerAcquisitionCost, setCustomerAcquisitionCost] = useState(0)
  const [categoryBookings, setCategoryBookings] = useState({
    Cleaning: 0,
    Electrical: 0,
    Security: 0,
    Driver: 0,
  })
  const { toast } = useToast()

  // Set up real-time listeners for booking stats and complaints
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA")
    const unsubscribeFunctions: (() => void)[] = []
    
    const setupRealTimeListeners = async () => {
      try {
        const db = await import("@/lib/firebase").then(m => m.getFirestoreDb?.())
        if (!db) {
          setIsDataLoading(false)
          return
        }
        
        const { collection, query, where, Timestamp, onSnapshot, doc: docRef } = await import("firebase/firestore")
        const { PROVIDER_ID_LIST } = await import("@/lib/queries/partners")
        
        const fromTS = Timestamp.fromDate(new Date(today + "T00:00:00"))
        const toTS = Timestamp.fromDate(new Date(today + "T23:59:59"))
        
        // Set up real-time listener for completed bookings (amount paid)
        const bookingsCol = collection(db, "bookings")
        const providerRefs = PROVIDER_ID_LIST.map((id: string) => docRef(db, "customer", id))
        
        const completedBookingsUnsubscribe = onSnapshot(
          query(
            bookingsCol,
            where("provider_id", "in", providerRefs),
            // where("status", "==", "Service_Completed"),
            where("date", ">=", fromTS),
            where("date", "<=", toTS)
          ),
          (completedSnap) => {
            let totalPaid = 0
            let completedCount = 0
            let totalNetProfit = 0
            let totalBookingAmount = 0
            let bookingIndex = 0
            
            console.log("=== PROFIT CALCULATION DEBUG ===")
            console.log(`Total bookings found: ${completedSnap.size}`)
            
            completedSnap.forEach((snapDoc) => {
              bookingIndex++
              const d = snapDoc.data() as any
              const amount = d.amount_paid || 0
              totalPaid += amount
              completedCount++
              
              console.log(`\n--- Booking ${bookingIndex} (ID: ${snapDoc.id}) ---`)
              console.log("Raw booking data:", d)
              
              // Calculate profit margin for each booking
              const totalServicePrice = d.totalservice_price || 0
              const taxAmount = d.taxAmount || d.tax_amount || 0
              const partnerFare = d.partner_fare || 0
              
              console.log(`totalServicePrice: ${totalServicePrice}`)
              console.log(`taxAmount: ${taxAmount}`)
              console.log(`partnerFare: ${partnerFare}`)
              
              // 1. Total Booking Amount = totalserviceprice + tax_amount
              const bookingAmount = totalServicePrice + taxAmount
              totalBookingAmount += bookingAmount
              console.log(`bookingAmount (step 1): ${bookingAmount}`)
              
              // 2. Partner Payout = partner_fare - (partner_fare × 6%)
              const gst = partnerFare * 0.06
              const partnerPayout = partnerFare - gst
              console.log(`gst (6% of partner_fare): ${gst}`)
              console.log(`partnerPayout (step 2): ${partnerPayout}`)
              
              // 3. Insstanto Gross Revenue = Total Booking Amount - Partner Payout
              const grossRevenue = bookingAmount - partnerPayout
              console.log(`grossRevenue (step 3): ${grossRevenue}`)
              
              // 4. Insstanto Net Profit = Gross Revenue - deductions
              // Deductions: 2.36% of partner payout + 2.36% of total booking amount + 5% of total booking amount
              const deduction1 = partnerPayout * 0.0236
              const deduction2 = bookingAmount * 0.0236
              const deduction3 = bookingAmount * 0.05
              const totalDeductions = deduction1 + deduction2 + deduction3
              
              console.log(`deduction1 (2.36% of partnerPayout): ${deduction1}`)
              console.log(`deduction2 (2.36% of bookingAmount): ${deduction2}`)
              console.log(`deduction3 (5% of bookingAmount): ${deduction3}`)
              console.log(`totalDeductions (step 4): ${totalDeductions}`)
              
              const netProfitPerBooking = grossRevenue - totalDeductions
              console.log(`netProfitPerBooking: ${netProfitPerBooking}`)
              
              totalNetProfit += netProfitPerBooking
            })
            
            // Calculate margin percentage
            const marginPct = totalBookingAmount > 0 ? (totalNetProfit / totalBookingAmount) * 100 : 0
            
            // Calculate Average Order Value (AOV)
            const aov = completedCount > 0 ? totalBookingAmount / completedCount : 0
            
            console.log(`\n=== SUMMARY ===`)
            console.log(`Total Paid: ${totalPaid}`)
            console.log(`Completed Count: ${completedCount}`)
            console.log(`Total Booking Amount: ${totalBookingAmount}`)
            console.log(`Total Net Profit: ${totalNetProfit}`)
            console.log(`Margin Percentage: ${marginPct}%`)
            console.log(`Average Order Value (AOV): ${aov}`)
            console.log("================\n")
            
            setTotalAmountPaid(totalPaid)
            setTotalBookingAmount(totalBookingAmount) // Round to 2 decimals
            setCompletedBookings(completedCount)
            setNetProfit(Math.round(totalNetProfit * 100) / 100) // Round to 2 dec imals
            setMarginPercentage(Math.round(marginPct * 100) / 100) // Round to 2 decimals
            setAvgOrderValue(Math.round(aov * 100) / 100) // Round to 2 decimals
          },
          (error) => {
            console.error("Error listening to completed bookings:", error)
          }
        )
        unsubscribeFunctions.push(completedBookingsUnsubscribe)
        
        // Set up real-time listener for cancelled bookings
        const cancelledBookingsUnsubscribe = onSnapshot(
          query(
            bookingsCol,
            where("status", "==", "Cancelled"),
            where("date", ">=", fromTS),
            where("date", "<=", toTS)
          ),
          (cancelledSnap) => {
            setCancelledBookings(cancelledSnap.size)
          },
          (error) => {
            console.error("Error listening to cancelled bookings:", error)
          }
        )
        unsubscribeFunctions.push(cancelledBookingsUnsubscribe)
        
        // Set up real-time listener for complaints
        const complaintsCol = collection(db, "customer_complain")
        const complaintsUnsubscribe = onSnapshot(
          query(
            complaintsCol,
            where("date_of_complaint", ">=", fromTS),
            where("date_of_complaint", "<=", toTS)
          ),
          (allComplaintsSnap) => {
            let total = 0
            let resolved = 0
            
            allComplaintsSnap.forEach((snapDoc) => {
              const d = snapDoc.data() as any
              total++
              if (d.complaint_status === "resolved" || d.complaint_status === "Resolved") {
                resolved++
              }
            })
            
            setTotalComplaints(total)
            setResolvedComplaints(resolved)
          },
          (error) => {
            console.error("Error listening to complaints:", error)
          }
        )
        unsubscribeFunctions.push(complaintsUnsubscribe)
        
        // Fetch daily expense for CAC calculation
        const fetchDailyExpense = async () => {
          try {
            const { fetchDailyOverviewSummary } = await import("@/lib/queries/daily-overview")
            const { getDocs } = await import("firebase/firestore")
            const dailyOverview = await fetchDailyOverviewSummary()
            const dailyExpense = dailyOverview.dailyAverageExpense
            
            // Count customers with exactly 1 completed booking
            const customerBookingsMap: Record<string, number> = {}
            const bookingsSnap = await getDocs(
              query(
                collection(db, "bookings"),
                where("provider_id", "in", providerRefs),
                where("status", "==", "Service_Completed"),
                where("date", ">=", fromTS),
                where("date", "<=", toTS)
              )
            )
            
            // Count bookings per customer
            bookingsSnap.forEach((docSnap: any) => {
              const d = docSnap.data() as any
              const customerId = d.customer_id || d.customer
              if (customerId) {
                customerBookingsMap[customerId] = (customerBookingsMap[customerId] || 0) + 1
              }
            })
            
            // Count customers with exactly 1 booking
            const newCustomersCount = Object.values(customerBookingsMap).filter(count => count === 1).length
            
            console.log(`Daily Expense: ${dailyExpense}`)
            console.log(`New Customers (with 1+ booking): ${newCustomersCount}`)
            
            // Calculate CAC = Daily Expense / New Customers, or just dailyExpense if no new customers
            const cac = newCustomersCount > 0 ? dailyExpense / newCustomersCount : dailyExpense
            console.log(`Customer Acquisition Cost (CAC): ${cac}`)
            
            setCustomerAcquisitionCost(Math.round(cac * 100) / 100)
          } catch (error) {
            console.error("Error fetching daily expense for CAC:", error)
          }
        }
        
        fetchDailyExpense()
        
        // Fetch category-wise bookings (using existing function which we'll update to real-time)
        const categories = await fetchCategoryWiseBookings(today, today)
        setCategoryBookings(categories as { Cleaning: number; Electrical: number; Security: number; Driver: number })
        
        setIsDataLoading(false)
      } catch (error) {
        console.error("Error setting up real-time listeners:", error)
        setIsDataLoading(false)
      }
    }
    
    setupRealTimeListeners()
    
    // Cleanup: unsubscribe from all listeners when component unmounts
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    }
  }, [])

  const handleSendWhatsAppReport = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          completedBookings,
          cancelledBookings,
          totalAmountPaid,
          netProfit,
          marginPercentage,
          avgOrderValue,
          customerAcquisitionCost,
          cleaning: categoryBookings.Cleaning,
          electrical: categoryBookings.Electrical,
          security: categoryBookings.Security,
          driver: categoryBookings.Driver,
          totalComplaints,
          resolvedComplaints,
          totalBookingAmount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send WhatsApp report")
      }

      toast({
        title: "Success",
        description: `WhatsApp report sent successfully to +919472394155`,
      })
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send WhatsApp report",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-chart-4" />
              Marketing Analytics
            </CardTitle>
            <CardDescription>Customer acquisition and marketing performance</CardDescription>
          </div>
          <Button 
            onClick={handleSendWhatsAppReport}
            disabled={isLoading || isDataLoading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : isDataLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                Send WhatsApp Report
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">New Customers</span>
              </div>
              <p className="text-2xl font-bold text-primary">{mockMarketingMetrics.newCustomers.toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-secondary" />
                <span className="text-sm text-muted-foreground">Customer LTV</span>
              </div>
              <p className="text-2xl font-bold text-secondary">
                ₹{mockMarketingMetrics.lifetimeValue.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Acquisition Cost & Conversion */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Acquisition Cost
                </span>
                <span className="font-medium">₹{mockMarketingMetrics.customerAcquisitionCost}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Conversion Rate
                </span>
                <span className="font-medium">{mockMarketingMetrics.conversionRate}%</span>
              </div>
            </div>
          </div>

          {/* Traffic Sources */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Traffic Sources
            </h4>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Organic Traffic</span>
                  <span className="font-medium">{mockMarketingMetrics.organicTraffic}%</span>
                </div>
                <Progress value={mockMarketingMetrics.organicTraffic} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Paid Traffic</span>
                  <span className="font-medium">{mockMarketingMetrics.paidTraffic}%</span>
                </div>
                <Progress value={mockMarketingMetrics.paidTraffic} className="h-2" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
