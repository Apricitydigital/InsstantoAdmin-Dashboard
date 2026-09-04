"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { collection, doc, getDocs, query, setDoc, Timestamp, updateDoc, where } from "firebase/firestore"
import { AlertCircle, Calendar, CheckCircle, ChevronLeft, ChevronRight, DollarSign, FileText, Loader2, Pencil, Plus, Save, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import { getFirestoreDb } from "@/lib/firebase"

type LoanStatus = "active" | "pending" | "closed"

type LoanBooking = {
  bookingName: string
  partnerfare: number
  bookingDate: Timestamp | Date
  loanAmount: number
  loanPercentage: number
  bookingid: string
}

type LoanData = {
  id: string
  loanAmount: number
  loanStatus: string
  amountPaid: number
  loanRecoveryPercentage: number
  loanStartDate?: Timestamp | Date
  kitName?: string
  kit_amount?: number
  bookingDetails: LoanBooking[]
  LoanRemainingAmount: number
  loanRecoveredAmount: number
}

type LoanForm = {
  loanAmount: string
  loanRecoveredAmount: string
  loanRecoveryPercentage: string
  loanStartDate: string
  kitName: string
  kitAmount: string
  loanStatus: LoanStatus
}

interface PartnerLoansSectionProps {
  partnerId: string
  fromDate: string
  toDate: string
}

const ROWS_PER_PAGE = 8

const toAmount = (value: unknown) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const toDateValue = (value?: Timestamp | Date) => {
  if (!value) return null
  if (value instanceof Date) return value
  return value.toDate?.() || null
}

const formatDateInput = (value?: Timestamp | Date) => {
  const date = toDateValue(value)
  if (!date) return new Date().toLocaleDateString("en-CA")
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const emptyLoanForm = (): LoanForm => ({
  loanAmount: "",
  loanRecoveredAmount: "0",
  loanRecoveryPercentage: "",
  loanStartDate: new Date().toLocaleDateString("en-CA"),
  kitName: "",
  kitAmount: "",
  loanStatus: "active",
})

const loanToForm = (loan: LoanData): LoanForm => ({
  loanAmount: String(loan.loanAmount),
  loanRecoveredAmount: String(loan.loanRecoveredAmount),
  loanRecoveryPercentage: String(loan.loanRecoveryPercentage),
  loanStartDate: formatDateInput(loan.loanStartDate),
  kitName: loan.kitName || "",
  kitAmount: String(loan.kit_amount || 0),
  loanStatus: ["active", "pending", "closed"].includes(loan.loanStatus)
    ? (loan.loanStatus as LoanStatus)
    : "active",
})

export function PartnerLoansSection({ partnerId, fromDate, toDate }: PartnerLoansSectionProps) {
  const db = getFirestoreDb()
  const { user } = useAuth()
  const canManageLoans = user?.role === "superadmin"

  const [loan, setLoan] = useState<LoanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<LoanForm>(emptyLoanForm)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const loadLoanData = useCallback(async () => {
    if (!partnerId) return
    setLoading(true)
    setError("")

    try {
      const partnerRef = doc(db, "customer", partnerId)
      const snapshot = await getDocs(query(
        collection(db, "PartnerKitLoan"),
        where("partnerId", "==", partnerRef)
      ))

      if (snapshot.empty) {
        setLoan(null)
        setForm(emptyLoanForm())
        setEditing(false)
        return
      }

      const loanDocuments = snapshot.docs.map((loanDocument) => {
        const data = loanDocument.data()
        const totalAmount = toAmount(data.loanAmount)
        const recoveredAmount = toAmount(data.loanRecoveredAmount ?? data.amountPaid)
        return {
          id: loanDocument.id,
          loanAmount: totalAmount,
          loanStatus: typeof data.loanStatus === "string" ? data.loanStatus : "active",
          amountPaid: toAmount(data.amountPaid),
          loanRecoveryPercentage: toAmount(data.loanRecoveryPercentage),
          loanStartDate: data.loanStartDate,
          kitName: typeof data.kitName === "string" ? data.kitName : "",
          kit_amount: toAmount(data.kit_amount),
          bookingDetails: Array.isArray(data.bookingDetails) ? data.bookingDetails : [],
          LoanRemainingAmount: toAmount(
            data.LoanRemainingAmount ?? Math.max(totalAmount - recoveredAmount, 0)
          ),
          loanRecoveredAmount: recoveredAmount,
        } satisfies LoanData
      }).sort((first, second) => {
        const firstIsActive = first.loanStatus.toLowerCase() === "active"
        const secondIsActive = second.loanStatus.toLowerCase() === "active"
        if (firstIsActive !== secondIsActive) return firstIsActive ? -1 : 1
        return (toDateValue(second.loanStartDate)?.getTime() || 0) -
          (toDateValue(first.loanStartDate)?.getTime() || 0)
      })

      const currentLoan = loanDocuments[0]
      setLoan(currentLoan)
      setForm(loanToForm(currentLoan))
      setEditing(false)
    } catch (loadError) {
      console.error("Error fetching loan data:", loadError)
      setError("Unable to load this partner's loan information.")
    } finally {
      setLoading(false)
    }
  }, [db, partnerId])

  useEffect(() => {
    void loadLoanData()
  }, [loadLoanData])

  const saveLoan = async () => {
    if (!canManageLoans || !partnerId || saving) return

    const loanAmount = Number(form.loanAmount)
    const recoveredAmount = Number(form.loanRecoveredAmount)
    const recoveryPercentage = Number(form.loanRecoveryPercentage)
    const kitAmount = form.kitAmount.trim() ? Number(form.kitAmount) : 0

    if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
      setError("Enter a total loan amount greater than zero.")
      return
    }
    if (!Number.isFinite(recoveredAmount) || recoveredAmount < 0 || recoveredAmount > loanAmount) {
      setError("Recovered amount must be between zero and the total loan amount.")
      return
    }
    if (!Number.isFinite(recoveryPercentage) || recoveryPercentage < 0 || recoveryPercentage > 100) {
      setError("Recovery percentage must be between 0 and 100.")
      return
    }
    if (!Number.isFinite(kitAmount) || kitAmount < 0) {
      setError("Kit amount cannot be negative.")
      return
    }
    if (!form.loanStartDate) {
      setError("Select a loan start date.")
      return
    }

    setSaving(true)
    setError("")
    setSuccessMessage("")

    try {
      const now = Timestamp.now()
      const remainingAmount = Math.max(loanAmount - recoveredAmount, 0)
      const loanReference = doc(db, "PartnerKitLoan", loan?.id || partnerId)
      const payload = {
        partnerId: doc(db, "customer", partnerId),
        loanAmount,
        loanStatus: form.loanStatus,
        amountPaid: recoveredAmount,
        loanRecoveredAmount: recoveredAmount,
        LoanRemainingAmount: remainingAmount,
        loanRecoveryPercentage: recoveryPercentage,
        loanStartDate: Timestamp.fromDate(new Date(`${form.loanStartDate}T00:00:00`)),
        kitName: form.kitName.trim(),
        kit_amount: kitAmount,
        edited_time: now,
        updated_by: user?.id || "admin",
        updated_by_email: user?.email || "",
      }

      if (loan) {
        await updateDoc(loanReference, payload)
      } else {
        await setDoc(loanReference, {
          ...payload,
          bookingDetails: [],
          created_time: now,
          created_by: user?.id || "admin",
          created_by_email: user?.email || "",
        })
      }

      setSuccessMessage(loan
        ? "Partner loan updated successfully."
        : "Partner loan document created successfully.")
      await loadLoanData()
    } catch (saveError) {
      console.error("Error saving partner loan:", saveError)
      setError("The loan could not be saved. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const updateForm = <Key extends keyof LoanForm>(key: Key, value: LoanForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)

  const formatDate = (value?: Timestamp | Date) => {
    const date = toDateValue(value)
    return date ? date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) : "—"
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge className="flex items-center gap-1 bg-green-100 text-green-800"><CheckCircle className="size-3" /> Active</Badge>
      case "closed":
        return <Badge className="flex items-center gap-1 bg-blue-100 text-blue-800"><CheckCircle className="size-3" /> Closed</Badge>
      case "pending":
        return <Badge variant="outline" className="flex items-center gap-1"><AlertCircle className="size-3" /> Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const filteredAndSortedBookings = useMemo(() => {
    if (!loan?.bookingDetails) return []
    const startDate = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const endDate = toDate ? new Date(`${toDate}T23:59:59.999`) : null

    return [...loan.bookingDetails].filter((booking) => {
      const bookingDate = toDateValue(booking.bookingDate)
      if (!bookingDate) return false
      if (startDate && bookingDate < startDate) return false
      if (endDate && bookingDate > endDate) return false
      return true
    }).sort((first, second) => {
      const firstDate = toDateValue(first.bookingDate) || new Date(0)
      const secondDate = toDateValue(second.bookingDate) || new Date(0)
      return secondDate.getTime() - firstDate.getTime()
    })
  }, [loan?.bookingDetails, fromDate, toDate])

  useEffect(() => {
    setCurrentPage(1)
  }, [fromDate, toDate, loan?.bookingDetails])

  const totalPages = Math.ceil(filteredAndSortedBookings.length / ROWS_PER_PAGE)
  const paginatedBookings = filteredAndSortedBookings.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  )
  const shouldShowForm = canManageLoans && (!loan || editing)

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="mr-2 size-6 animate-spin" />Loading loan data...</div>
  }

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {successMessage && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{successMessage}</div>}

      {canManageLoans && loan && !editing && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => {
            setForm(loanToForm(loan))
            setError("")
            setSuccessMessage("")
            setEditing(true)
          }}>
            <Pencil className="mr-2 size-4" /> Edit Current Loan
          </Button>
        </div>
      )}

      {shouldShowForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {loan ? <Pencil className="size-5" /> : <Plus className="size-5" />}
              {loan ? "Manage Current Loan" : "Create Partner Loan"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium">Total loan amount
                <Input type="number" min="0.01" step="0.01" inputMode="decimal" value={form.loanAmount} onChange={(event) => updateForm("loanAmount", event.target.value)} className="mt-1" />
              </label>
              <label className="text-sm font-medium">Recovered amount
                <Input type="number" min="0" step="0.01" inputMode="decimal" value={form.loanRecoveredAmount} onChange={(event) => updateForm("loanRecoveredAmount", event.target.value)} className="mt-1" />
              </label>
              <label className="text-sm font-medium">Recovery per booking (%)
                <Input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={form.loanRecoveryPercentage} onChange={(event) => updateForm("loanRecoveryPercentage", event.target.value)} className="mt-1" />
              </label>
              <label className="text-sm font-medium">Loan start date
                <Input type="date" value={form.loanStartDate} onChange={(event) => updateForm("loanStartDate", event.target.value)} className="mt-1" />
              </label>
              <label className="text-sm font-medium">Kit name
                <Input value={form.kitName} onChange={(event) => updateForm("kitName", event.target.value)} placeholder="Optional" className="mt-1" />
              </label>
              <label className="text-sm font-medium">Kit amount
                <Input type="number" min="0" step="0.01" inputMode="decimal" value={form.kitAmount} onChange={(event) => updateForm("kitAmount", event.target.value)} className="mt-1" />
              </label>
              <label className="text-sm font-medium">Loan status
                <select value={form.loanStatus} onChange={(event) => updateForm("loanStatus", event.target.value as LoanStatus)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <div className="rounded-lg border bg-muted/30 p-3 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Calculated remaining amount</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(Math.max(toAmount(form.loanAmount) - toAmount(form.loanRecoveredAmount), 0))}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {loan && <Button type="button" variant="outline" disabled={saving} onClick={() => {
                setForm(loanToForm(loan))
                setError("")
                setEditing(false)
              }}><X className="mr-2 size-4" /> Cancel</Button>}
              <Button type="button" disabled={saving} onClick={() => void saveLoan()}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                {loan ? "Save Loan Changes" : "Create Loan Document"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loan && !canManageLoans && (
        <div className="py-8 text-center text-muted-foreground"><FileText className="mx-auto mb-4 size-12 opacity-50" /><p>No loan found for this partner.</p></div>
      )}

      {loan && <>
        <div className="flex justify-end">{getStatusBadge(loan.loanStatus)}</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><DollarSign className="size-5 text-blue-600" /><div><p className="text-sm font-medium">Total Loan Amount</p><p className="text-2xl font-bold">{formatCurrency(loan.loanAmount)}</p>{loan.kitName && <p className="text-xs text-muted-foreground">{loan.kitName}{loan.kit_amount ? ` · ${formatCurrency(loan.kit_amount)}` : ""}</p>}</div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle className="size-5 text-green-600" /><div><p className="text-sm font-medium">Recovered Amount</p><p className="text-2xl font-bold">{formatCurrency(loan.loanRecoveredAmount)}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><AlertCircle className="size-5 text-red-600" /><div><p className="text-sm font-medium">Remaining Amount</p><p className="text-2xl font-bold">{formatCurrency(loan.LoanRemainingAmount)}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Calendar className="size-5 text-purple-600" /><div><p className="text-sm font-medium">Start Date &amp; Recovery</p><p className="text-lg font-bold">{formatDate(loan.loanStartDate)} · {loan.loanRecoveryPercentage}%</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Loan Deduction Summary ({filteredAndSortedBookings.length} deductions)</CardTitle></CardHeader>
          <CardContent>
            {!filteredAndSortedBookings.length ? (
              <div className="py-8 text-center text-muted-foreground"><FileText className="mx-auto mb-4 size-12 opacity-50" /><p>No deduction records found for this date range.</p></div>
            ) : <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Booking Name</TableHead><TableHead>Partner Fare</TableHead><TableHead>Loan Deducted</TableHead><TableHead>Percentage</TableHead><TableHead>Booking ID</TableHead></TableRow></TableHeader>
                  <TableBody>{paginatedBookings.map((booking, index) => (
                    <TableRow key={booking.bookingid || index}><TableCell>{formatDate(booking.bookingDate)}</TableCell><TableCell>{booking.bookingName || "—"}</TableCell><TableCell>{formatCurrency(booking.partnerfare)}</TableCell><TableCell>{formatCurrency(booking.loanAmount)}</TableCell><TableCell>{booking.loanPercentage}%</TableCell><TableCell>{booking.bookingid}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
              </div>
              {totalPages > 1 && <div className="mt-4 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={currentPage === 1}><ChevronLeft className="mr-1 size-4" /> Previous</Button>
                <span className="text-sm">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))} disabled={currentPage === totalPages}>Next <ChevronRight className="ml-1 size-4" /></Button>
              </div>}
            </>}
          </CardContent>
        </Card>
      </>}
    </div>
  )
}
