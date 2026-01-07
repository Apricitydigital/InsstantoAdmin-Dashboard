import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from "recharts"
import { doc, collection, query, where, getDocs } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { Button } from "@/components/ui/button"

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
    const customerIds = [
        "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
        "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
        "VxxapfO7l8YM5f6xmFqpThc17eD3",
        "Q0kKYbdOKVbeZsdiLGsJoM5BWQl1",
        "7KlujhUyJbeCTPG6Pty8exlxXuM2",
        "fGLJCCFDEneQZ7ciz71Q29WBgGQ2",
        "MstGdrDCHkZ1KKf0xtZctauIovf2",
        "OgioZJvg0DWWRnqZLj2AUMUljZN2",
        "B1FsSfpqRIPS6Sg0fn3QetCOyAw2",
        "uSZdJdat03froahSdGmPpFWDGhi2",

    ]
    const customerRefs = customerIds.map((id) => doc(db, "customer", id))

    const currentDate = new Date()
    // Generate 6 months starting from offset
    const monthsAgo = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(currentDate)
      date.setMonth(currentDate.getMonth() - i - offset)
      return date
    })

    const months = monthsAgo.map((date) => date.toLocaleString("default", { month: "short", year: "2-digit" }))
    const reversedMonths = [...months].reverse()

    const bookingsCol = collection(db, "bookings")
    const bookingsQuery = query(
      bookingsCol,
      where("provider_id", "in", customerRefs),
      where("status", "==", "Service_Completed")
    )
    const snapshot = await getDocs(bookingsQuery)

    const bookingsCount = reversedMonths.map((month) => ({
      month,
      bookings: 0,
    }))

    snapshot.forEach((doc) => {
      const data = doc.data()
      const bookingDate = data.timeSlot.toDate()
      const monthName = bookingDate.toLocaleString("default", { month: "short", year: "2-digit" })
      const monthIndex = reversedMonths.indexOf(monthName)
      if (monthIndex !== -1) bookingsCount[monthIndex].bookings += 1
    })

    setBookingsData(bookingsCount)
  }

  useEffect(() => {
    fetchBookingsData(monthOffset)
  }, [monthOffset])

  return (
    <Card
      className={`border-l-4 border-gray-300 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md ${className}`}
    >
      <CardHeader>
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
      <CardContent>
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