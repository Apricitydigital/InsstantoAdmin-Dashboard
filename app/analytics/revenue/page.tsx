"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, TrendingUp, TrendingDown, Calendar } from "lucide-react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"

export default function RevenueAnalyticsPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <AdminSidebar />
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <AdminHeader title="Revenue Analytics" />
        <main className="flex-1 space-y-6 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <DollarSign className="w-8 h-8 text-green-600" />
                  <Badge variant="secondary">+12%</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-green-900">₹8.4L</CardTitle>
                <CardDescription className="text-green-700">Total Revenue</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                  <Badge variant="secondary">+8%</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-blue-900">₹2.1L</CardTitle>
                <CardDescription className="text-blue-700">Monthly Growth</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Calendar className="w-8 h-8 text-purple-600" />
                  <Badge variant="secondary">₹28K</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-purple-900">₹28K</CardTitle>
                <CardDescription className="text-purple-700">Daily Average</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <TrendingDown className="w-8 h-8 text-orange-600" />
                  <Badge variant="secondary">18%</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-orange-900">18%</CardTitle>
                <CardDescription className="text-orange-700">Commission Rate</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
              <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Overview</CardTitle>
                  <CardDescription>Comprehensive revenue analysis and key metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Revenue analytics dashboard coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trends</CardTitle>
                  <CardDescription>Historical revenue trends and patterns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Trend analysis coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="breakdown" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                  <CardDescription>Revenue breakdown by service, location, and time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Revenue breakdown coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="forecasting" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Forecasting</CardTitle>
                  <CardDescription>Predictive revenue analysis and projections</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Revenue forecasting coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
