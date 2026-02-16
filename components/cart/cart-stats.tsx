"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, getDocs, orderBy, query, where, Timestamp } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShoppingCart, IndianRupee, BadgeCheck, BadgeX } from "lucide-react"

interface CartStatsProps {
  fromDate: string
  toDate: string
}

type CartDoc = {
  subTotal?: number
  cartStatus?: string
  bookingCreationDate?: Timestamp
}

export default function CartStats({ fromDate, toDate }: CartStatsProps) {
  const db = getFirestoreDb()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [cartDocs, setCartDocs] = useState<CartDoc[]>([])

  useEffect(() => {
    const fetchCartStats = async () => {
      setLoading(true)
      setError("")

      try {
        const startDate = fromDate
          ? new Date(fromDate + "T00:00:00Z")
          : new Date(2025, 3, 1)

        const endDate = toDate
          ? new Date(toDate + "T23:59:59Z")
          : new Date()

        const fromTimestamp = Timestamp.fromDate(startDate)
        const toTimestamp = Timestamp.fromDate(endDate)

const cartQuery = query(
  collection(db, "cart"),
  orderBy("bookingCreationDate", "desc")
)

        const snapshot = await getDocs(cartQuery)

        const docs: CartDoc[] = snapshot.docs.map((d) => d.data() as any)

        setCartDocs(docs)
      } catch (e: any) {
        console.error("Failed to load cart stats:", e)
        setError(e.message ?? "Failed to load cart stats.")
      } finally {
        setLoading(false)
      }
    }

    fetchCartStats()
  }, [db, fromDate, toDate])

  // ---------- Calculations ----------
  const stats = useMemo(() => {
    let totalCount = 0
    let unpaidCount = 0
    let paidCount = 0

    let totalValue = 0
    let unpaidValue = 0
    let paidValue = 0

    cartDocs.forEach((c) => {
      totalCount += 1

      const status = (c.cartStatus ?? "").toLowerCase()
      const subTotal = typeof c.subTotal === "number" ? c.subTotal : 0

      totalValue += subTotal

      if (status === "unpaid") {
        unpaidCount += 1
        unpaidValue += subTotal
      } else if (status === "paid") {
        paidCount += 1
        paidValue += subTotal
      }
    })

    return {
      totalCount,
      unpaidCount,
      paidCount,
      totalValue,
      unpaidValue,
      paidValue,
    }
  }, [cartDocs])

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading cart stats...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg border">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Total Cart Records */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Total Cart Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Total cart records in selected date range
          </p>
        </CardContent>
      </Card>

      {/* Total Value */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-primary" />
            Total Cart Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹{stats.totalValue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Sum of subtotal field
          </p>
        </CardContent>
      </Card>

      {/* Unpaid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <BadgeX className="h-4 w-4 text-yellow-600" />
            Unpaid Cart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.unpaidCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            ₹{stats.unpaidValue.toLocaleString()} unpaid total
          </p>
        </CardContent>
      </Card>

      {/* Paid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-green-600" />
            Paid Cart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.paidCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            ₹{stats.paidValue.toLocaleString()} paid total
          </p>
        </CardContent>
      </Card>

      {/* Extra: Paid vs Unpaid % */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Paid Conversion
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.totalCount === 0 ? (
            <div className="text-sm text-muted-foreground">—</div>
          ) : (
            <>
              <div className="text-2xl font-bold">
                {Math.round((stats.paidCount / stats.totalCount) * 100)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Paid cart records out of total
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
