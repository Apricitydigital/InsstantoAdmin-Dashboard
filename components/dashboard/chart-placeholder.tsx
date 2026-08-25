import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from "recharts"
import { doc, collection, query, where, getDocs, Timestamp } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { PROVIDER_ID_LIST } from "@/lib/queries/partners"

interface ChartPlaceholderProps {
  title: string
  description: string
  icon: LucideIcon
  iconColor?: string
  children?: React.ReactNode
  className?: string
}

interface BookingData {
  month: string
  bookings: number
}

const INTERNAL_CUSTOMER_ID = "aZ0kM3TQB1TuDq52bS7AEeVWQ6V2"

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

export function ChartPlaceholder({
  title,
  description,
  icon: Icon,
  iconColor = "text-primary/50",
  children,
  className = "",
}: ChartPlaceholderProps) {
  const [bookingsData, setBookingsData] = useState<BookingData[]>([])
  const [monthOffset, setMonthOffset] = useState(0) // 0 = current 6 months, 6 = previous 6 months, etc.

  const fetchBookingsData = async (offset: number) => {
    const db = getFirestoreDb()
    const customerRefs = PROVIDER_ID_LIST.map((id) => doc(db, "customer", id))

    const currentDate = new Date()
    // Generate 6 months starting from offset
    const monthsAgo = Array.from(
      { length: 6 },
      (_, i) =>
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - i - offset,
          1
        )
    )

    const visibleMonths = [...monthsAgo].reverse()
    const rangeStart = new Date(
      visibleMonths[0].getFullYear(),
      visibleMonths[0].getMonth(),
      1
    )
    const lastMonth = visibleMonths[visibleMonths.length - 1]
    const rangeEnd = new Date(
      lastMonth.getFullYear(),
      lastMonth.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    )

    const bookingsCol = collection(db, "bookings")
    const bookingsQuery = query(
      bookingsCol,
      where("provider_id", "in", customerRefs),
      where("status", "==", "Service_Completed"),
      where("date", ">=", Timestamp.fromDate(rangeStart)),
      where("date", "<=", Timestamp.fromDate(rangeEnd))
    )
    const snapshot = await getDocs(bookingsQuery)

    const bookingsCount = visibleMonths.map((date) => ({
      month: date.toLocaleString("default", { month: "short", year: "2-digit" }),
      key: monthKey(date),
      bookings: 0,
    }))

    snapshot.forEach((bookingDocument) => {
      const data = bookingDocument.data()
      if (data.customer_id?.id === INTERNAL_CUSTOMER_ID) return

      const bookingDate = data.date?.toDate?.()
      if (!bookingDate) return

      const monthIndex = bookingsCount.findIndex(
        (month) => month.key === monthKey(bookingDate)
      )
      if (monthIndex !== -1) bookingsCount[monthIndex].bookings += 1
    })

    setBookingsData(
      bookingsCount.map(({ month, bookings }) => ({ month, bookings }))
    )
  }

  useEffect(() => {
    fetchBookingsData(monthOffset)
  }, [monthOffset])

  return (
    <Card
      className={`overflow-hidden border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      <CardHeader className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${iconColor.replace("/50", "")}`} />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonthOffset((prev) => prev + 6)}
              title="Previous 6 months"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonthOffset((prev) => (prev > 0 ? prev - 6 : 0))}
              disabled={monthOffset === 0}
              title="Next 6 months"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-5">
        {children || (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradientColor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: "#6a11cb", stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: "#ffffff", stopOpacity: 0.6 }} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="bookings" barSize={30} radius={[10, 10, 0, 0]} fill="url(#gradientColor)">
                  <LabelList dataKey="bookings" position="top" fill="#333" fontSize={14} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
