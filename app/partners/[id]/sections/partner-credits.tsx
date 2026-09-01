"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  Timestamp,
  where,
} from "firebase/firestore"
import {
  Calendar,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { getFirestoreDb } from "@/lib/firebase"

type CreditAccount = {
  id?: string
  exists: boolean
  credit_balance: number
  user_type?: string
  expiryDate?: Timestamp
  WalletBonusStatus?: string
}

type PurchaseRecord = {
  id: string
  credits: number
  amount: number
  date?: Timestamp
  status?: string
  note?: string
  source?: string
}

type SpendRecord = {
  id: string
  credits: number
  date?: Timestamp
  note?: string
  source?: string
  bookingId?: string
}

type AdjustmentType = "add" | "deduct"

interface PartnerCreditsSectionProps {
  partnerId: string
}

const ROWS_PER_PAGE = 8

const toAmount = (value: unknown) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const getReferenceId = (value: unknown) => {
  if (!value) return ""
  if (typeof value === "string") return value
  if (typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === "string" ? id : ""
  }
  return ""
}

export function PartnerCreditsSection({ partnerId }: PartnerCreditsSectionProps) {
  const db = getFirestoreDb()
  const { user } = useAuth()
  const canManageCredits = user?.role === "superadmin"

  const [creditAccount, setCreditAccount] = useState<CreditAccount>({
    exists: false,
    credit_balance: 0,
  })
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([])
  const [spendHistory, setSpendHistory] = useState<SpendRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("add")
  const [adjustmentAmount, setAdjustmentAmount] = useState("")
  const [adjustmentNote, setAdjustmentNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [purchasePage, setPurchasePage] = useState(1)
  const [spendPage, setSpendPage] = useState(1)

  const loadCreditsData = useCallback(async () => {
    if (!partnerId) return

    setLoading(true)
    setError("")

    try {
      const partnerReference = doc(db, "customer", partnerId)
      const [overallSnapshot, purchaseSnapshot, spendSnapshot] =
        await Promise.all([
          getDocs(
            query(
              collection(db, "partner_overall_credits"),
              where("service_partner_id", "==", partnerReference)
            )
          ),
          getDocs(
            query(
              collection(db, "credits_purchase_record"),
              where("partnerId", "==", partnerReference)
            )
          ),
          getDocs(
            query(
              collection(db, "chemical_spend_record"),
              where("partnerId", "==", partnerReference)
            )
          ),
        ])

      let overallDocument = overallSnapshot.docs[0]

      if (!overallDocument) {
        const directSnapshot = await getDoc(
          doc(db, "partner_overall_credits", partnerId)
        )
        if (directSnapshot.exists()) overallDocument = directSnapshot
      }

      if (overallDocument?.exists()) {
        const data = overallDocument.data()
        setCreditAccount({
          id: overallDocument.id,
          exists: true,
          credit_balance: toAmount(data.credit_balance),
          user_type:
            typeof data.user_type === "string" ? data.user_type : undefined,
          expiryDate: data.expiryDate,
          WalletBonusStatus:
            typeof data.WalletBonusStatus === "string"
              ? data.WalletBonusStatus
              : undefined,
        })
      } else {
        setCreditAccount({ exists: false, credit_balance: 0 })
      }

      const purchases = purchaseSnapshot.docs
        .map((snapshot): PurchaseRecord => {
          const data = snapshot.data()
          return {
            id: snapshot.id,
            credits: toAmount(data.credits_purchased),
            amount: toAmount(data.amount_paid),
            date: data.purchase_date,
            status:
              typeof data.status === "string" ? data.status : "completed",
            note:
              typeof data.note === "string"
                ? data.note
                : typeof data.reason === "string"
                  ? data.reason
                  : "",
            source:
              typeof data.source === "string" ? data.source : "purchase",
          }
        })
        .sort(
          (first, second) =>
            (second.date?.toDate?.().getTime() || 0) -
            (first.date?.toDate?.().getTime() || 0)
        )

      const spends = spendSnapshot.docs
        .map((snapshot): SpendRecord => {
          const data = snapshot.data()
          return {
            id: snapshot.id,
            credits: toAmount(data.credits_spent ?? data.chemical_spend),
            date: data.spend_date,
            note:
              typeof data.note === "string"
                ? data.note
                : typeof data.reason === "string"
                  ? data.reason
                  : "",
            source:
              typeof data.source === "string" ? data.source : "service",
            bookingId: getReferenceId(data.bookingId),
          }
        })
        .sort(
          (first, second) =>
            (second.date?.toDate?.().getTime() || 0) -
            (first.date?.toDate?.().getTime() || 0)
        )

      setPurchaseHistory(purchases)
      setSpendHistory(spends)
    } catch (loadError) {
      console.error("Error fetching partner credits:", loadError)
      setError("Unable to load partner credit information.")
    } finally {
      setLoading(false)
    }
  }, [db, partnerId])

  useEffect(() => {
    void loadCreditsData()
  }, [loadCreditsData])

  const createCreditAccount = async () => {
    if (!canManageCredits || !partnerId) return

    setCreatingAccount(true)
    setError("")
    setSuccessMessage("")

    try {
      const accountReference = doc(db, "partner_overall_credits", partnerId)
      const partnerReference = doc(db, "customer", partnerId)

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(accountReference)
        if (snapshot.exists()) return

        const now = Timestamp.now()
        transaction.set(accountReference, {
          service_partner_id: partnerReference,
          credit_balance: 0,
          user_type: "service_partner",
          WalletBonusStatus: "active",
          createdAt: now,
          edited_time: now,
          created_by: user?.id || "admin",
        })
      })

      setSuccessMessage("Partner credit account created successfully.")
      await loadCreditsData()
    } catch (createError) {
      console.error("Error creating partner credit account:", createError)
      setError("Credit account creation failed. Please try again.")
    } finally {
      setCreatingAccount(false)
    }
  }

  const submitAdjustment = async () => {
    if (!canManageCredits || !partnerId || submitting) return

    const amount = Number(adjustmentAmount)
    const note = adjustmentNote.trim()

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a credit amount greater than zero.")
      return
    }
    if (!note) {
      setError("Add a reason for this credit adjustment.")
      return
    }
    if (adjustmentType === "deduct" && amount > creditAccount.credit_balance) {
      setError("The deduction cannot be greater than the current balance.")
      return
    }

    const actionLabel = adjustmentType === "add" ? "add" : "deduct"
    if (
      !window.confirm(
        `Confirm that you want to ${actionLabel} ${amount.toLocaleString(
          "en-IN"
        )} credits?`
      )
    ) {
      return
    }

    setSubmitting(true)
    setError("")
    setSuccessMessage("")

    try {
      const partnerReference = doc(db, "customer", partnerId)
      const accountReference = doc(
        db,
        "partner_overall_credits",
        creditAccount.id || partnerId
      )
      const historyReference = doc(
        collection(
          db,
          adjustmentType === "add"
            ? "credits_purchase_record"
            : "chemical_spend_record"
        )
      )

      await runTransaction(db, async (transaction) => {
        const accountSnapshot = await transaction.get(accountReference)
        const currentBalance = accountSnapshot.exists()
          ? toAmount(accountSnapshot.data().credit_balance)
          : 0

        if (adjustmentType === "deduct" && amount > currentBalance) {
          throw new Error("INSUFFICIENT_CREDITS")
        }

        const nextBalance =
          adjustmentType === "add"
            ? currentBalance + amount
            : currentBalance - amount
        const now = Timestamp.now()
        const auditFields = {
          note,
          reason: note,
          source: "admin_adjustment",
          admin_adjustment: true,
          created_by: user?.id || "admin",
          created_by_email: user?.email || "",
        }

        if (accountSnapshot.exists()) {
          transaction.update(accountReference, {
            credit_balance: nextBalance,
            edited_time: now,
            updated_by: user?.id || "admin",
          })
        } else {
          transaction.set(accountReference, {
            service_partner_id: partnerReference,
            credit_balance: nextBalance,
            user_type: "service_partner",
            WalletBonusStatus: "active",
            createdAt: now,
            edited_time: now,
            created_by: user?.id || "admin",
          })
        }

        if (adjustmentType === "add") {
          transaction.set(historyReference, {
            partnerId: partnerReference,
            credits_purchased: amount,
            amount_paid: 0,
            purchase_date: now,
            status: "completed",
            user_type: "service_partner",
            ...auditFields,
          })
        } else {
          transaction.set(historyReference, {
            partnerId: partnerReference,
            credits_spent: amount,
            chemical_spend: amount,
            spend_date: now,
            bookingId: null,
            ...auditFields,
          })
        }
      })

      setAdjustmentAmount("")
      setAdjustmentNote("")
      setSuccessMessage(
        `${amount.toLocaleString("en-IN")} credits ${
          adjustmentType === "add" ? "added" : "deducted"
        } successfully.`
      )
      await loadCreditsData()
    } catch (adjustmentError) {
      console.error("Partner credit adjustment failed:", adjustmentError)
      setError(
        adjustmentError instanceof Error &&
          adjustmentError.message === "INSUFFICIENT_CREDITS"
          ? "The balance changed and no longer has enough credits for this deduction."
          : "Credit adjustment failed. No balance or history changes were saved."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)

  const formatDate = (timestamp?: Timestamp) =>
    timestamp?.toDate?.().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) || "—"

  const totalPurchaseAmount = useMemo(
    () => purchaseHistory.reduce((sum, record) => sum + record.amount, 0),
    [purchaseHistory]
  )
  const totalCreditsPurchased = useMemo(
    () => purchaseHistory.reduce((sum, record) => sum + record.credits, 0),
    [purchaseHistory]
  )
  const totalCreditsSpent = useMemo(
    () => spendHistory.reduce((sum, record) => sum + record.credits, 0),
    [spendHistory]
  )
  const purchasePages = Math.max(
    1,
    Math.ceil(purchaseHistory.length / ROWS_PER_PAGE)
  )
  const spendPages = Math.max(1, Math.ceil(spendHistory.length / ROWS_PER_PAGE))
  const currentPurchases = purchaseHistory.slice(
    (purchasePage - 1) * ROWS_PER_PAGE,
    purchasePage * ROWS_PER_PAGE
  )
  const currentSpends = spendHistory.slice(
    (spendPage - 1) * ROWS_PER_PAGE,
    spendPage * ROWS_PER_PAGE
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="mr-2 size-6 animate-spin" />
        Loading credits data...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-100 p-3">
                <Wallet className="size-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Credit Balance</p>
                <p className="text-2xl font-bold">{creditAccount.credit_balance.toLocaleString("en-IN")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {creditAccount.exists ? "Credit account active" : "Credit account not created"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Purchase Amount</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(totalPurchaseAmount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Total amount paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Credits Added</p>
            <p className="mt-2 text-2xl font-bold text-green-700">+{totalCreditsPurchased.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs text-muted-foreground">Purchase history total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Credits Spent</p>
            <p className="mt-2 text-2xl font-bold text-red-700">-{totalCreditsSpent.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs text-muted-foreground">Spend history total</p>
          </CardContent>
        </Card>
      </div>

      {canManageCredits && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" /> Manage Partner Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!creditAccount.exists && (
              <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-amber-900">No overall credit document exists</p>
                  <p className="text-sm text-amber-700">Create an empty account now, or it will be created automatically when credits are added.</p>
                </div>
                <Button type="button" variant="outline" disabled={creatingAccount} onClick={() => void createCreditAccount()}>
                  {creatingAccount && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create Credit Account
                </Button>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[180px_220px_1fr_auto] lg:items-end">
              <label className="text-sm font-medium">
                Adjustment
                <select
                  value={adjustmentType}
                  onChange={(event) => setAdjustmentType(event.target.value as AdjustmentType)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="add">Add credits</option>
                  <option value="deduct">Deduct credits</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Credit amount
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={adjustmentAmount}
                  onChange={(event) => setAdjustmentAmount(event.target.value)}
                  placeholder="Enter credits"
                  className="mt-1"
                />
              </label>
              <label className="text-sm font-medium">
                Reason / admin note
                <Textarea
                  value={adjustmentNote}
                  onChange={(event) => setAdjustmentNote(event.target.value)}
                  placeholder="Required for the audit history"
                  className="mt-1 min-h-10"
                />
              </label>
              <Button
                type="button"
                disabled={submitting}
                onClick={() => void submitAdjustment()}
                className={adjustmentType === "deduct" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              >
                {submitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : adjustmentType === "add" ? (
                  <Plus className="mr-2 size-4" />
                ) : (
                  <Minus className="mr-2 size-4" />
                )}
                {adjustmentType === "add" ? "Add Credits" : "Deduct Credits"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" /> Credit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="purchases">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="purchases">
                <TrendingUp className="size-4" /> Purchases ({purchaseHistory.length})
              </TabsTrigger>
              <TabsTrigger value="spends">
                <TrendingDown className="size-4" /> Spends ({spendHistory.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="purchases" className="mt-4 space-y-4">
              {purchaseHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Receipt className="mx-auto mb-4 size-12 opacity-50" />
                  No credit purchases found.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Amount Paid</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentPurchases.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="whitespace-nowrap">{formatDate(record.date)}</TableCell>
                            <TableCell className="font-semibold text-green-700">+{record.credits.toLocaleString("en-IN")}</TableCell>
                            <TableCell>{formatCurrency(record.amount)}</TableCell>
                            <TableCell><Badge variant="outline">{record.status || "completed"}</Badge></TableCell>
                            <TableCell>{record.source || "purchase"}</TableCell>
                            <TableCell className="max-w-sm whitespace-normal">{record.note || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <HistoryPagination page={purchasePage} pages={purchasePages} onChange={setPurchasePage} />
                </>
              )}
            </TabsContent>

            <TabsContent value="spends" className="mt-4 space-y-4">
              {spendHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <TrendingDown className="mx-auto mb-4 size-12 opacity-50" />
                  No credit spends found.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Booking ID</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentSpends.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="whitespace-nowrap">{formatDate(record.date)}</TableCell>
                            <TableCell className="font-semibold text-red-700">-{record.credits.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="font-mono text-xs">{record.bookingId || "—"}</TableCell>
                            <TableCell>{record.source || "service"}</TableCell>
                            <TableCell className="max-w-sm whitespace-normal">{record.note || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <HistoryPagination page={spendPage} pages={spendPages} onChange={setSpendPage} />
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function HistoryPagination({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </div>
  )
}
