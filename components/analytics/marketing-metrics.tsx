"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Users, DollarSign, Target, Globe, CreditCard } from "lucide-react"
import { mockMarketingMetrics } from "@/lib/queries/analytics"

export function MarketingMetrics() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-chart-4" />
          Marketing Analytics
        </CardTitle>
        <CardDescription>Customer acquisition and marketing performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">New Customers</span>
              </div>
              <p className="text-2xl font-bold text-primary">{mockMarketingMetrics.newCustomers.toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-secondary" />
                <span className="text-sm text-muted-foreground">Customer LTV</span>
              </div>
              <p className="text-2xl font-bold text-secondary">
                ₹{mockMarketingMetrics.lifetimeValue.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Acquisition Cost & Conversion */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Acquisition Cost
                </span>
                <span className="font-medium">₹{mockMarketingMetrics.customerAcquisitionCost}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Conversion Rate
                </span>
                <span className="font-medium">{mockMarketingMetrics.conversionRate}%</span>
              </div>
            </div>
          </div>

          {/* Traffic Sources */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Traffic Sources
            </h4>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Organic Traffic</span>
                  <span className="font-medium">{mockMarketingMetrics.organicTraffic}%</span>
                </div>
                <Progress value={mockMarketingMetrics.organicTraffic} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Paid Traffic</span>
                  <span className="font-medium">{mockMarketingMetrics.paidTraffic}%</span>
                </div>
                <Progress value={mockMarketingMetrics.paidTraffic} className="h-2" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
