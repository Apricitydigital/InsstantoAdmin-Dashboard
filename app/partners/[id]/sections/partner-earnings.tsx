"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts"
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  History,
  Loader2,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type WalletTransaction = {
  id: string
  amount: number
  date: Timestamp
  partnerId: string
  user_type: string
  status?: string
  description?: string
  customer_name?: string
  bookingId?: string
}

type PayoutTransaction = {
  id: string
  amount: number
  date: Timestamp
  partnerId: string
  user_type?: string
  status?: string
  note?: string
  deductionType?: string
  payoutIds?: string[]
  bookingId?: string
}

interface PartnerEarningsSectionProps {
  partnerId: string
  fromDate: string
  toDate: string
}

export function PartnerEarningsSection({
  partnerId,
  fromDate,
  toDate,
}: PartnerEarningsSectionProps) {
  const db = getFirestoreDb()
  const [allWalletTransactions, setAllWalletTransactions] = useState<
    WalletTransaction[]
  >([])
  const [payoutTransactions, setPayoutTransactions] = useState<PayoutTransaction[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [totalEarningsOverall, setTotalEarningsOverall] = useState(0)
  const [currentBalance, setCurrentBalance] = useState(0)
  const [pendingPayouts, setPendingPayouts] = useState(0)
  const [monthlyGrowth, setMonthlyGrowth] = useState(0)
  const [thisMonthEarnings, setThisMonthEarnings] = useState(0)
  const [page, setPage] = useState(1)
  const [payoutPage, setPayoutPage] = useState(1)
  const [monthOffset, setMonthOffset] = useState(0)
  const [loanRecoveredAmount, setLoanRecoveredAmount] = useState(0)
  const [netEarningsOverall, setNetEarningsOverall] = useState(0)

  // Filtered earnings for date range
  const [filteredEarnings, setFilteredEarnings] = useState(0)
  const [filteredNetEarnings, setFilteredNetEarnings] = useState(0)

  const pageSize = 10

  const formatDate = (timestamp: Timestamp) =>
    timestamp.toDate().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

  useEffect(() => {
    const fetchEarningsData = async () => {
      try {
        setLoading(true)
        const partnerRef = doc(db, "customer", partnerId)

        // Fetch overall wallet data (not filtered)
        const walletQuery = query(
          collection(db, "Wallet_Overall"),
          where("service_partner_id", "==", partnerRef)
        )
        const walletSnapshot = await getDocs(walletQuery)
        if (!walletSnapshot.empty) {
          const walletData = walletSnapshot.docs[0]?.data()
          if (walletData) {
            setTotalEarningsOverall(walletData.TotalAmountComeIn_Wallet || 0)
            setCurrentBalance(walletData.total_balance || 0)
            setPendingPayouts(walletData.pending_amount || 0)
          }

          const loanQuery = query(
            collection(db, "PartnerKitLoan"),
            where("partnerId", "==", partnerRef)
          )
          const loanSnap = await getDocs(loanQuery)
          let recovered = 0
          if (!loanSnap.empty) {
            recovered = loanSnap.docs[0].data().loanRecoveredAmount || 0
          }
          setLoanRecoveredAmount(recovered)
          setNetEarningsOverall((walletData?.TotalAmountComeIn_Wallet || 0) + recovered)
        }

        // ---------------------------
        // PAY-IN (Wallet_In_record)
        // ---------------------------
        let allTransactionsQuery
        try {
          allTransactionsQuery = query(
            collection(db, "Wallet_In_record"),
            where("partnerId", "==", partnerRef),
            orderBy("Timestamp", "desc"),
            limit(200)
          )
        } catch {
          allTransactionsQuery = query(
            collection(db, "Wallet_In_record"),
            where("partnerId", "==", partnerRef),
            limit(200)
          )
        }

        const allTransactionsSnapshot = await getDocs(allTransactionsQuery)
        const allTransactionsData: WalletTransaction[] = []

        allTransactionsSnapshot.forEach((transactionDoc) => {
          const transaction = transactionDoc.data() as any
          if (transaction.payment_in_wallet && transaction.payment_in_wallet > 0) {
            allTransactionsData.push({
              id: transactionDoc.id,
              amount: transaction.payment_in_wallet,
              date: transaction.Timestamp || Timestamp.now(),
              partnerId: transaction.partnerId?.id || partnerId,
              user_type: transaction.user_type || "customer",
              status: "Completed",
              description: "Wallet credit",
              customer_name: "Unknown",
              bookingId:
                typeof transaction.bookingId === "string"
                  ? transaction.bookingId
                  : transaction.bookingId?.id,
            })
          }
        })

        allTransactionsData.sort(
          (a, b) => b.date.toDate().getTime() - a.date.toDate().getTime()
        )
        setAllWalletTransactions(allTransactionsData)

        // Calculate this month earnings (for growth calculation)
        const now = new Date()
        const currentMonthEarnings = allTransactionsData
          .filter((t) => {
            const d = t.date.toDate()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          })
          .reduce((sum, t) => sum + t.amount, 0)

        setThisMonthEarnings(currentMonthEarnings)

        const lastMonth = new Date()
        lastMonth.setMonth(lastMonth.getMonth() - 1)
        const lastMonthEarnings = allTransactionsData
          .filter((t) => {
            const d = t.date.toDate()
            return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear()
          })
          .reduce((sum, t) => sum + t.amount, 0)

        if (lastMonthEarnings > 0)
          setMonthlyGrowth(
            ((currentMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100
          )
        else if (currentMonthEarnings > 0) setMonthlyGrowth(100)

        // -----------------------------------------
        // PAY-OUT (Wallet_Transaction_record)
        // -----------------------------------------
        // -----------------------------------------
// PAY-OUT (Wallet_Transaction_record)  ✅ FIXED
// -----------------------------------------
let payoutDocs: any[] = []

// Try with orderBy first (requires index). If it fails, fallback without orderBy.
try {
  const payoutQueryWithOrder = query(
    collection(db, "Wallet_Transaction_record"),
    where("partnerId", "==", partnerRef),
    orderBy("spend_date", "desc"),
    limit(200)
  )
  const payoutSnap = await getDocs(payoutQueryWithOrder)
  payoutDocs = payoutSnap.docs
} catch (e) {
  console.warn(
    "Payout query with orderBy failed (likely missing index). Falling back without orderBy.",
    e
  )
  const payoutQueryNoOrder = query(
    collection(db, "Wallet_Transaction_record"),
    where("partnerId", "==", partnerRef),
    limit(200)
  )
  const payoutSnap2 = await getDocs(payoutQueryNoOrder)
  payoutDocs = payoutSnap2.docs
}

const payouts: PayoutTransaction[] = []

payoutDocs.forEach((payoutDoc) => {
  const d = payoutDoc.data() as any

  // Handle both positive and negative stored amounts
  const rawAmt = Number(d?.PAyment_out_fromWallet ?? 0)

  // If zero, skip
  if (!rawAmt) return

  payouts.push({
    id: payoutDoc.id,
    amount: Math.abs(rawAmt), // show positive number in UI
    date: d?.spend_date || Timestamp.now(),
    partnerId: d?.partnerId?.id || partnerId,
    user_type: d?.user_type,
    status: d?.PaymentStatus || "Completed",
    note: d?.Note || "",
    deductionType: d?.DetuctionType || "",
    payoutIds: Array.isArray(d?.payout_id) ? d.payout_id : [],
    bookingId:
      typeof d?.bookingId === "string" ? d.bookingId : d?.bookingId?.id,
  })
})

// If we had to fallback without orderBy, sort in-memory so UI stays correct
payouts.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())

setPayoutTransactions(payouts)

      } catch (error) {
        console.error("Error fetching earnings data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (partnerId) fetchEarningsData()
  }, [partnerId, db])

  // Calculate filtered earnings based on date range (or overall if none)
  useEffect(() => {
    if (allWalletTransactions.length === 0) return

    // If no dates selected → show overall totals
    if (!fromDate || !toDate) {
      const totalAll = allWalletTransactions.reduce((sum, t) => sum + t.amount, 0)
      setFilteredEarnings(totalAll)
      setFilteredNetEarnings(totalAll + loanRecoveredAmount)
      return
    }

    // ✅ If date range selected → filter transactions within that range
    const startDate = new Date(`${fromDate}T00:00:00`)
    const endDate = new Date(`${toDate}T23:59:59`)

    const filtered = allWalletTransactions.filter((t) => {
      const transDate = t.date.toDate()
      return transDate >= startDate && transDate <= endDate
    })

    const totalFiltered = filtered.reduce((sum, t) => sum + t.amount, 0)
    setFilteredEarnings(totalFiltered)
    setFilteredNetEarnings(totalFiltered + loanRecoveredAmount)
  }, [allWalletTransactions, fromDate, toDate, loanRecoveredAmount])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)

  // Generate monthly earnings for chart (NOT filtered by date range)
  const generateMonthlyEarnings = (transactions: WalletTransaction[], offset: number) => {
    const monthlyData: { [key: string]: number } = {}
    const months: string[] = []

    const currentDate = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate)
      date.setMonth(currentDate.getMonth() - i - offset)
      const key = date.toLocaleDateString("en-US", { year: "numeric", month: "short" })
      months.push(key)
      monthlyData[key] = 0
    }

    transactions.forEach((t) => {
      const key = t.date.toDate().toLocaleDateString("en-US", { year: "numeric", month: "short" })
      if (months.includes(key)) monthlyData[key] += t.amount
    })

    return months.map((m) => ({ month: m, amount: monthlyData[m] || 0 }))
  }

  const chartData = generateMonthlyEarnings(allWalletTransactions, monthOffset)

  // PAY-IN table filtered
  const filteredTransactionsForTable =
    !fromDate || !toDate
      ? allWalletTransactions
      : allWalletTransactions.filter((t) => {
          const startDate = new Date(`${fromDate}T00:00:00`)
          const endDate = new Date(`${toDate}T23:59:59`)
          const transDate = t.date.toDate()
          return transDate >= startDate && transDate <= endDate
        })

  const totalPages = Math.ceil(filteredTransactionsForTable.length / pageSize)
  const paginatedTransactions = filteredTransactionsForTable.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  // PAY-OUT table filtered
  const filteredPayoutsForTable =
    !fromDate || !toDate
      ? payoutTransactions
      : payoutTransactions.filter((t) => {
          const startDate = new Date(`${fromDate}T00:00:00`)
          const endDate = new Date(`${toDate}T23:59:59`)
          const transDate = t.date.toDate()
          return transDate >= startDate && transDate <= endDate
        })

  const payoutTotalPages = Math.ceil(filteredPayoutsForTable.length / pageSize)
  const paginatedPayouts = filteredPayoutsForTable.slice(
    (payoutPage - 1) * pageSize,
    payoutPage * pageSize
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading earnings data...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Earnings (before loan deductions)
                </p>
                <p className="text-2xl font-bold">{formatCurrency(filteredNetEarnings)}</p>
                <span className="text-xs text-muted-foreground">
                  {fromDate && toDate ? "In selected date range" : "Overall earnings"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Earnings</p>
                <p className="text-2xl font-bold">{formatCurrency(filteredEarnings)}</p>
                <span className="text-xs text-muted-foreground">
                  {fromDate && toDate ? "In selected date range" : "Overall earnings"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                <p className="text-2xl font-bold">{formatCurrency(currentBalance)}</p>
                <span className="text-xs text-muted-foreground">
                  Available Balance in wallet
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{formatCurrency(thisMonthEarnings)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {monthlyGrowth >= 0 ? (
                    <ArrowUpIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <ArrowDownIcon className="w-4 h-4 text-red-500" />
                  )}
                  <span
                    className={`text-xs ${
                      monthlyGrowth >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {monthlyGrowth >= 0 ? "+" : ""}
                    {monthlyGrowth.toFixed(1)}% from last month
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Chart - NOT FILTERED */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Earnings Trend - Overall{" "}
            {monthOffset === 0 ? "(Last 6 Months)" : `(Months -${monthOffset})`}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonthOffset((prev) => prev + 6)}
              title="Show previous 6 months"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonthOffset((prev) => (prev > 0 ? prev - 6 : 0))}
              disabled={monthOffset === 0}
              title="Show newer months"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="earningsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#10b981", stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: "#ffffff", stopOpacity: 0.6 }} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [formatCurrency(v as number), "Earnings"]} />
              <Bar dataKey="amount" barSize={30} radius={[10, 10, 0, 0]} fill="url(#earningsGradient)">
                <LabelList
                  dataKey="amount"
                  position="top"
                  fill="#333"
                  fontSize={12}
                  fontWeight="bold"
                  formatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Transactions - PAY IN + PAY OUT TABS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Recent Transactions
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs
            defaultValue="payin"
            onValueChange={() => {
              // keep paging sane when switching tabs
              setPage(1)
              setPayoutPage(1)
            }}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="payin">Pay In History</TabsTrigger>
              <TabsTrigger value="payout">Payout History</TabsTrigger>
            </TabsList>

            {/* PAY-IN */}
            <TabsContent value="payin">
              {filteredTransactionsForTable.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No wallet pay-in transactions found for this date range.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTransactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{formatDate(transaction.date)}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell>{transaction.customer_name || "N/A"}</TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800">
                                {transaction.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              + {formatCurrency(transaction.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <Button
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      disabled={page === totalPages || totalPages === 0}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* PAY-OUT */}
            <TabsContent value="payout">
              {filteredPayoutsForTable.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No payout transactions found for this date range.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Deduction Type</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPayouts.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell>{formatDate(t.date)}</TableCell>
                            <TableCell>{t.deductionType || "—"}</TableCell>
                            <TableCell className="max-w-[380px] truncate" title={t.note || ""}>
                              {t.note || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-orange-100 text-orange-800">
                                {t.status || "Completed"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              - {formatCurrency(t.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <Button
                      variant="outline"
                      disabled={payoutPage === 1}
                      onClick={() => setPayoutPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {payoutPage} of {payoutTotalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      disabled={payoutPage === payoutTotalPages || payoutTotalPages === 0}
                      onClick={() => setPayoutPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
