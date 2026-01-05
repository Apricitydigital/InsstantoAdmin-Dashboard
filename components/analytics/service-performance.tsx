"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart3, Star, CheckCircle } from "lucide-react"
import { mockServicePerformance } from "@/lib/queries/analytics"

export function ServicePerformance() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-secondary" />
          Service Performance
        </CardTitle>
        <CardDescription>Top performing services by bookings and revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockServicePerformance.map((service, index) => (
            <div key={service.serviceName} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium">{service.serviceName}</h4>
                  <Badge variant="outline" className="text-xs mt-1">
                    {service.category}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary">₹{service.revenue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{service.bookings} bookings</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      Rating
                    </span>
                    <span className="font-medium">{service.rating}</span>
                  </div>
                  <Progress value={service.rating * 20} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Completion
                    </span>
                    <span className="font-medium">{service.completionRate}%</span>
                  </div>
                  <Progress value={service.completionRate} className="h-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
