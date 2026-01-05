"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, DollarSign } from "lucide-react"
import { mockRevenueData } from "@/lib/queries/analytics"

export function RevenueChart() {
  const totalRevenue = mockRevenueData.reduce((sum, data) => sum + data.revenue, 0)
  const averageGrowth = mockRevenueData.reduce((sum, data) => sum + data.growth, 0) / mockRevenueData.length

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Revenue Analytics
        </CardTitle>
        <CardDescription>Monthly revenue trends and growth analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Revenue (6 months)</p>
            <p className="text-2xl font-bold text-primary">₹{totalRevenue.toLocaleString()}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Average Growth Rate</p>
            <p className="text-2xl font-bold text-green-600 flex items-center gap-1">
              <TrendingUp className="h-5 w-5" />
              {averageGrowth.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {mockRevenueData.map((data, index) => (
            <div key={data.month} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="font-semibold text-primary">{data.month}</span>
                </div>
                <div>
                  <p className="font-medium">₹{data.revenue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{data.bookings} bookings</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                  data.growth >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                <TrendingUp className={`h-3 w-3 ${data.growth < 0 ? "rotate-180" : ""}`} />
                {data.growth >= 0 ? "+" : ""}
                {data.growth}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
