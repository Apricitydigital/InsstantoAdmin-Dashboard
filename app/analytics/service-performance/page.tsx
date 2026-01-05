"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, Clock, Users, Award } from "lucide-react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"

export default function ServicePerformancePage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <AdminSidebar />
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <AdminHeader title="Service Performance" />
        <main className="flex-1 space-y-6 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Star className="w-8 h-8 text-yellow-600" />
                  <Badge variant="secondary">4.8</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-yellow-900">4.8</CardTitle>
                <CardDescription className="text-yellow-700">Average Rating</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Clock className="w-8 h-8 text-blue-600" />
                  <Badge variant="secondary">95%</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-blue-900">95%</CardTitle>
                <CardDescription className="text-blue-700">On-Time Completion</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Users className="w-8 h-8 text-green-600" />
                  <Badge variant="secondary">89%</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-green-900">89%</CardTitle>
                <CardDescription className="text-green-700">Customer Satisfaction</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Award className="w-8 h-8 text-purple-600" />
                  <Badge variant="secondary">12</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-purple-900">12</CardTitle>
                <CardDescription className="text-purple-700">Top Performers</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Tabs defaultValue="ratings" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="ratings">Ratings</TabsTrigger>
              <TabsTrigger value="quality">Quality</TabsTrigger>
              <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
              <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
            </TabsList>

            <TabsContent value="ratings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Service Ratings</CardTitle>
                  <CardDescription>Detailed analysis of service ratings and reviews</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Star className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Rating analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quality" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quality Metrics</CardTitle>
                  <CardDescription>Service quality indicators and improvement areas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Quality metrics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="efficiency" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Service Efficiency</CardTitle>
                  <CardDescription>Time management and efficiency analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Efficiency analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="benchmarks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Benchmarks</CardTitle>
                  <CardDescription>Compare performance against industry standards</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Benchmark analysis coming soon</p>
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
