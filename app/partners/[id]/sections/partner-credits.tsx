"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import {
  CreditCard,
  TrendingUp,
  Calendar,
  Wallet,
  Plus,
  Loader2,
} from "lucide-react"

type CreditTransaction = {
  id: string
  amount?: number
  credits?: number
  type?: 'purchase'
  description?: string
  transaction_date?: Timestamp
}

interface PartnerCreditsSectionProps {
  partnerId: string
}

export function PartnerCreditsSection({ partnerId }: PartnerCreditsSectionProps) {
  const db = getFirestoreDb()
  const [creditData, setCreditData] = useState<any>(null)
  const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 5

  useEffect(() => {
    const fetchCreditsData = async () => {
      try {
        setLoading(true)

        const partnerRef = doc(db, "customer", partnerId)

        // 🔹 Fetch overall credit balance
        const overallQuery = query(
          collection(db, "partner_overall_credits"),
          where("service_partner_id", "==", partnerRef)
        )
        const overallSnap = await getDocs(overallQuery)
        let overallData: any = null

        if (!overallSnap.empty) {
          const d = overallSnap.docs[0]
          overallData = { id: d.id, ...d.data() }
        }

        // 🔹 Fetch Purchases only
        const purchaseQuery = query(
          collection(db, "credits_purchase_record"),
          where("partnerId", "==", partnerRef)
        )
        const purchaseSnap = await getDocs(purchaseQuery)

        const purchases: CreditTransaction[] = purchaseSnap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            amount: data.amount_paid || 0,
            credits: data.credits_purchased || 0,
            type: "purchase",
            description: `Purchased ${data.credits_purchased || 0} credits`,
            transaction_date: data.purchase_date,
          }
        })

        // 🔹 Sort purchases by date
        const sortedHistory = purchases.sort((a, b) => {
          const dateA = a.transaction_date?.toDate().getTime() || 0
          const dateB = b.transaction_date?.toDate().getTime() || 0
          return dateB - dateA
        })

        setCreditHistory(sortedHistory)

        // 🔹 Set Credit Data
        setCreditData({
          credit_balance: overallData?.credit_balance || 0,
          user_type: overallData?.user_type,
          expiryDate: overallData?.expiryDate,
          WalletBonusStatus: overallData?.WalletBonusStatus
        })

      } catch (error) {
        console.error("Error fetching credits data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (partnerId) {
      fetchCreditsData()
    }
  }, [partnerId, db])

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== 'number') return "₹0"
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp?.toDate) return "—"
    return timestamp.toDate().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTransactionBadge = (type?: string) => {
    if (type === "purchase") {
      return <Badge className="bg-blue-100 text-blue-800">Purchase</Badge>
    }
    return <Badge variant="secondary">Unknown</Badge>
  }

  // Totals
  const totalPurchaseAmount = creditHistory.reduce((sum, t) => sum + (t.amount || 0), 0)
  const totalCreditsPurchased = creditHistory.reduce((sum, t) => sum + (t.credits || 0), 0)

  // Pagination logic
  const indexOfLast = currentPage * rowsPerPage
  const indexOfFirst = indexOfLast - rowsPerPage
  const currentRecords = creditHistory.slice(indexOfFirst, indexOfLast)
  const totalPages = Math.ceil(creditHistory.length / rowsPerPage)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading credits data...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Credits Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Creadit Balance</p>
                <p className="text-2xl font-bold">{formatCurrency(creditData?.credit_balance || 0)}</p>
                {creditData?.expiryDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires: {formatDate(creditData.expiryDate)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Purchases</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPurchaseAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1">Amount paid</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Plus className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Credits Purchased</p>
                <p className="text-2xl font-bold">{totalCreditsPurchased}</p>
                <p className="text-xs text-muted-foreground mt-1">Credits (units)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Credit Purchase History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {creditHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No credit purchases found.</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRecords.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(transaction.transaction_date)}
                        </TableCell>
                        <TableCell>{getTransactionBadge(transaction.type)}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(transaction.amount || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => prev - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
