"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Target, Users, TrendingUp, Zap } from "lucide-react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"

export default function MarketingAnalyticsPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <AdminSidebar />
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <AdminHeader title="Marketing Analytics" />
        <main className="flex-1 space-y-6 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Target className="w-8 h-8 text-pink-600" />
                  <Badge variant="secondary">+15%</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-pink-900">₹450</CardTitle>
                <CardDescription className="text-pink-700">Customer Acquisition Cost</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Users className="w-8 h-8 text-blue-600" />
                  <Badge variant="secondary">1,245</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-blue-900">1,245</CardTitle>
                <CardDescription className="text-blue-700">New Customers</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                  <Badge variant="secondary">3.2%</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-green-900">3.2%</CardTitle>
                <CardDescription className="text-green-700">Conversion Rate</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Zap className="w-8 h-8 text-purple-600" />
                  <Badge variant="secondary">4.2x</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-purple-900">4.2x</CardTitle>
                <CardDescription className="text-purple-700">Return on Ad Spend</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Tabs defaultValue="acquisition" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
              <TabsTrigger value="channels">Channels</TabsTrigger>
              <TabsTrigger value="retention">Retention</TabsTrigger>
            </TabsList>

            <TabsContent value="acquisition" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Acquisition</CardTitle>
                  <CardDescription>Track customer acquisition metrics and costs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Acquisition analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="campaigns" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Performance</CardTitle>
                  <CardDescription>Analyze marketing campaign effectiveness</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Campaign analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="channels" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Marketing Channels</CardTitle>
                  <CardDescription>Compare performance across marketing channels</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Channel analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="retention" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Retention</CardTitle>
                  <CardDescription>Monitor customer retention and lifetime value</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Retention analytics coming soon</p>
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
