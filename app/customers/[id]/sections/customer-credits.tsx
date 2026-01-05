// app/admin/customers/[id]/sections/customer-credits.tsx
"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Calendar,
  Wallet,
  Star,
  Loader2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Receipt
} from "lucide-react"

type WalletDoc = {
  id: string
  service_partner_id?: any
  user_type?: any
  credit_balance?: number
  expiryDate?: Timestamp
  WalletBonusStatus?: string
}

type CreditPurchaseRecord = {
  id: string
  partnerId?: any
  credits_purchased?: number
  purchase_date?: Timestamp
  amount_paid?: number
  status?: string
  user_type?: any
  expiryDate?: Timestamp
  WalletBonusStatus?: string
}

type ChemicalSpendRecord = {
  id: string
  bookingId?: any
  partnerId?: any
  spend_date?: Timestamp
  chemical_spend?: number
}

const PAGE_SIZE = 10

interface CustomerCreditsTabProps {
  customerId: string
}

export function CustomerCreditsTab({ customerId }: CustomerCreditsTabProps) {
  const db = getFirestoreDb()
  
  const [walletInfo, setWalletInfo] = useState<WalletDoc | null>(null)
  const [purchaseRecords, setPurchaseRecords] = useState<CreditPurchaseRecord[]>([])
  const [spendRecords, setSpendRecords] = useState<ChemicalSpendRecord[]>([])
  const [walletLoading, setWalletLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState(true)
  const [spendLoading, setSpendLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState("purchases")
  
  // Purchase filters and pagination
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState("")
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState("all")
  const [purchaseCurrentPage, setPurchaseCurrentPage] = useState(1)

  // Spend filters and pagination
  const [spendSearchTerm, setSpendSearchTerm] = useState("")
  const [spendCurrentPage, setSpendCurrentPage] = useState(1)

  // Fetch wallet information
  useEffect(() => {
    const fetchWalletInfo = async () => {
      if (!customerId) return

      try {
        setWalletLoading(true)
        const customerRef = doc(db, "customer", customerId)
        
        try {
          const walletQuery = query(
            collection(db, "partner_overall_credits"),
            where("service_partner_id", "==", customerRef)
          )
          const snapshot = await getDocs(walletQuery)
          
          if (!snapshot.empty) {
            const walletDoc = snapshot.docs[0]
            setWalletInfo({ id: walletDoc.id, ...walletDoc.data() } as WalletDoc)
          } else {
            const directWalletDoc = await getDoc(doc(db, "partner_overall_credits", customerId))
            if (directWalletDoc.exists()) {
              setWalletInfo({ id: directWalletDoc.id, ...directWalletDoc.data() } as WalletDoc)
            }
          }
        } catch (walletErr) {
          console.error("Error fetching wallet from partner_overall_credits:", walletErr)
        }
        
      } catch (err: any) {
        console.error("Failed to load wallet info:", err)
      } finally {
        setWalletLoading(false)
      }
    }

    fetchWalletInfo()
  }, [customerId, db])

  // Fetch credit purchase records
  useEffect(() => {
    const fetchPurchaseRecords = async () => {
      if (!customerId) return

      try {
        setPurchaseLoading(true)
        const customerRef = doc(db, "customer", customerId)
        
        const purchaseQuery = query(
          collection(db, "credits_purchase_record"),
          where("partnerId", "==", customerRef),
          orderBy("purchase_date", "desc")
        )

        try {
          const snapshot = await getDocs(purchaseQuery)
          const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as CreditPurchaseRecord[]
          
          setPurchaseRecords(records)
        } catch (err) {
          console.error("Error fetching purchase records with orderBy:", err)
          // Fallback without orderBy
          const fallbackQuery = query(
            collection(db, "credits_purchase_record"),
            where("partnerId", "==", customerRef)
          )
          const snapshot = await getDocs(fallbackQuery)
          const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as CreditPurchaseRecord[]
          
          // Sort manually
          records.sort((a, b) => {
            const dateA = a.purchase_date?.toDate?.() || new Date(0)
            const dateB = b.purchase_date?.toDate?.() || new Date(0)
            return dateB.getTime() - dateA.getTime()
          })
          
          setPurchaseRecords(records)
        }
        
      } catch (err: any) {
        console.error("Failed to load purchase records:", err)
        setPurchaseRecords([])
      } finally {
        setPurchaseLoading(false)
      }
    }

    if (activeSubTab === "purchases") {
      fetchPurchaseRecords()
    }
  }, [customerId, db, activeSubTab])

  // Fetch chemical spend records
  useEffect(() => {
    const fetchSpendRecords = async () => {
      if (!customerId) return

      try {
        setSpendLoading(true)
        const customerRef = doc(db, "customer", customerId)
        
        const spendQuery = query(
          collection(db, "chemical_spend_record"),
          where("partnerId", "==", customerRef),
          orderBy("spend_date", "desc")
        )

        try {
          const snapshot = await getDocs(spendQuery)
          const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ChemicalSpendRecord[]
          
          setSpendRecords(records)
        } catch (err) {
          console.error("Error fetching spend records with orderBy:", err)
          // Fallback without orderBy
          const fallbackQuery = query(
            collection(db, "chemical_spend_record"),
            where("partnerId", "==", customerRef)
          )
          const snapshot = await getDocs(fallbackQuery)
          const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ChemicalSpendRecord[]
          
          // Sort manually
          records.sort((a, b) => {
            const dateA = a.spend_date?.toDate?.() || new Date(0)
            const dateB = b.spend_date?.toDate?.() || new Date(0)
            return dateB.getTime() - dateA.getTime()
          })
          
          setSpendRecords(records)
        }
        
      } catch (err: any) {
        console.error("Failed to load spend records:", err)
        setSpendRecords([])
      } finally {
        setSpendLoading(false)
      }
    }

    if (activeSubTab === "spends") {
      fetchSpendRecords()
    }
  }, [customerId, db, activeSubTab])

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp?.toDate) return "—"
    return timestamp.toDate().toLocaleString()
  }

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== 'number') return "₹0"
    return `₹${amount.toLocaleString()}`
  }

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case 'failed':
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800"><AlertCircle className="w-3 h-3 mr-1" />Active</Badge>
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>
    }
  }

  // Filter purchase records
  const filteredPurchases = useMemo(() => {
    const term = purchaseSearchTerm.trim().toLowerCase()
    
    return purchaseRecords.filter((record) => {
      const text = [
        record.id,
        record.status,
        record.credits_purchased?.toString(),
        record.amount_paid?.toString(),
      ]
        .map(v => (v ?? "").toString().toLowerCase())
        .join(" ")

      const matchesSearch = !term || text.includes(term)
      const matchesStatus = purchaseStatusFilter === "all" || record.status?.toLowerCase() === purchaseStatusFilter.toLowerCase()

      return matchesSearch && matchesStatus
    })
  }, [purchaseRecords, purchaseSearchTerm, purchaseStatusFilter])

  // Pagination for purchases
  const paginatedPurchases = useMemo(() => {
    const startIndex = (purchaseCurrentPage - 1) * PAGE_SIZE
    const endIndex = startIndex + PAGE_SIZE
    return filteredPurchases.slice(startIndex, endIndex)
  }, [filteredPurchases, purchaseCurrentPage])

  const purchaseTotalPages = Math.ceil(filteredPurchases.length / PAGE_SIZE)
  const purchaseHasNextPage = purchaseCurrentPage < purchaseTotalPages
  const purchaseHasPrevPage = purchaseCurrentPage > 1

  useEffect(() => {
    setPurchaseCurrentPage(1)
  }, [purchaseSearchTerm, purchaseStatusFilter])

  // Filter spend records
  const filteredSpends = useMemo(() => {
    const term = spendSearchTerm.trim().toLowerCase()
    
    return spendRecords.filter((record) => {
      const text = [
        record.id,
        record.chemical_spend?.toString(),
      ]
        .map(v => (v ?? "").toString().toLowerCase())
        .join(" ")

      const matchesSearch = !term || text.includes(term)
      return matchesSearch
    })
  }, [spendRecords, spendSearchTerm])

  // Pagination for spends
  const paginatedSpends = useMemo(() => {
    const startIndex = (spendCurrentPage - 1) * PAGE_SIZE
    const endIndex = startIndex + PAGE_SIZE
    return filteredSpends.slice(startIndex, endIndex)
  }, [filteredSpends, spendCurrentPage])

  const spendTotalPages = Math.ceil(filteredSpends.length / PAGE_SIZE)
  const spendHasNextPage = spendCurrentPage < spendTotalPages
  const spendHasPrevPage = spendCurrentPage > 1

  useEffect(() => {
    setSpendCurrentPage(1)
  }, [spendSearchTerm])

  // Calculate totals
  const totalPurchased = purchaseRecords
    .filter(r => r.status?.toLowerCase() === 'completed' || r.status?.toLowerCase() === 'success')
    .reduce((sum, r) => sum + (r.credits_purchased || 0), 0)
  
  const totalSpent = spendRecords.reduce((sum, r) => sum + (r.chemical_spend || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Credits Summary</h3>
      </div>

      {/* Credit Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Wallet className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Available Balance</p>
                <p className="text-2xl font-bold">
                  {walletLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : formatCurrency(walletInfo?.credit_balance || 0)}
                </p>
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
                <p className="text-sm font-medium">Total Purchased</p>
                <p className="text-2xl font-bold">{totalPurchased}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Total Spent</p>
                <p className="text-2xl font-bold">{totalSpent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Bonus Status</p>
                <Badge 
                  variant={walletInfo?.WalletBonusStatus === "Active" ? "default" : "secondary"} 
                  className="text-xs mt-1"
                >
                  {walletInfo?.WalletBonusStatus || "N/A"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card> */}
      </div>

      {/* Sub-tabs for Purchases and Spends */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="purchases" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Credit Purchases ({purchaseRecords.length})
          </TabsTrigger>
          <TabsTrigger value="spends" className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Chemical Spends ({spendRecords.length})
          </TabsTrigger>
        </TabsList>

        {/* Purchase Records Tab */}
        <TabsContent value="purchases" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center space-x-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search purchases..."
                  value={purchaseSearchTerm}
                  onChange={(e) => setPurchaseSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={purchaseStatusFilter} onValueChange={setPurchaseStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {purchaseLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading purchase records...
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {purchaseSearchTerm || purchaseStatusFilter !== "all" 
                  ? "No purchase records found matching your criteria." 
                  : "No purchase records found."}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record ID</TableHead>
                      <TableHead>Credits Purchased</TableHead>
                      <TableHead>Amount Paid</TableHead>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPurchases.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium font-mono text-xs">{record.id}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          +{record.credits_purchased || 0}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(record.amount_paid)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(record.purchase_date)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(record.expiryDate)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(record.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {purchaseCurrentPage} of {purchaseTotalPages || 1}
                  {filteredPurchases.length > 0 && (
                    <span className="ml-2">
                      ({((purchaseCurrentPage - 1) * PAGE_SIZE) + 1}-{Math.min(purchaseCurrentPage * PAGE_SIZE, filteredPurchases.length)} of {filteredPurchases.length})
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => purchaseHasPrevPage && setPurchaseCurrentPage(p => p - 1)} 
                    disabled={!purchaseHasPrevPage || purchaseLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> 
                    Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => purchaseHasNextPage && setPurchaseCurrentPage(p => p + 1)}
                    disabled={!purchaseHasNextPage || purchaseLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* Spend Records Tab */}
        <TabsContent value="spends" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center space-x-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search spends..."
                  value={spendSearchTerm}
                  onChange={(e) => setSpendSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          {spendLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading spend records...
            </div>
          ) : filteredSpends.length === 0 ? (
            <div className="text-center py-8">
              <TrendingDown className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {spendSearchTerm 
                  ? "No spend records found matching your criteria." 
                  : "No spend records found."}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record ID</TableHead>
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Chemical Spend</TableHead>
                      <TableHead>Spend Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSpends.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium font-mono text-xs">{record.id}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {record.bookingId?.id || "—"}
                        </TableCell>
                        <TableCell className="font-semibold text-red-600">
                          -{record.chemical_spend || 0}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(record.spend_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {spendCurrentPage} of {spendTotalPages || 1}
                  {filteredSpends.length > 0 && (
                    <span className="ml-2">
                      ({((spendCurrentPage - 1) * PAGE_SIZE) + 1}-{Math.min(spendCurrentPage * PAGE_SIZE, filteredSpends.length)} of {filteredSpends.length})
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => spendHasPrevPage && setSpendCurrentPage(p => p - 1)} 
                    disabled={!spendHasPrevPage || spendLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> 
                    Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => spendHasNextPage && setSpendCurrentPage(p => p + 1)}
                    disabled={!spendHasNextPage || spendLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}