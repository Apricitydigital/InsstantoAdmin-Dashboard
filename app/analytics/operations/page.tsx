"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Clock, Users, CheckCircle } from "lucide-react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"

export default function OperationsAnalyticsPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <AdminSidebar />
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <AdminHeader title="Operations Analytics" />
        <main className="flex-1 space-y-6 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Activity className="w-8 h-8 text-blue-600" />
                  <Badge variant="secondary">92%</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-blue-900">92%</CardTitle>
                <CardDescription className="text-blue-700">Operational Efficiency</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <Badge variant="secondary">98%</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-green-900">98%</CardTitle>
                <CardDescription className="text-green-700">Completion Rate</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Clock className="w-8 h-8 text-purple-600" />
                  <Badge variant="secondary">45min</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-purple-900">45min</CardTitle>
                <CardDescription className="text-purple-700">Avg Response Time</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Users className="w-8 h-8 text-orange-600" />
                  <Badge variant="secondary">156</Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-orange-900">156</CardTitle>
                <CardDescription className="text-orange-700">Active Partners</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Tabs defaultValue="efficiency" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
              <TabsTrigger value="capacity">Capacity</TabsTrigger>
              <TabsTrigger value="quality">Quality</TabsTrigger>
              <TabsTrigger value="optimization">Optimization</TabsTrigger>
            </TabsList>

            <TabsContent value="efficiency" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Operational Efficiency</CardTitle>
                  <CardDescription>Track operational performance and efficiency metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Efficiency analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="capacity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Capacity Management</CardTitle>
                  <CardDescription>Monitor resource utilization and capacity planning</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Capacity analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quality" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quality Metrics</CardTitle>
                  <CardDescription>Service quality and customer satisfaction metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Quality analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="optimization" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Process Optimization</CardTitle>
                  <CardDescription>Identify optimization opportunities and bottlenecks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Optimization insights coming soon</p>
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
