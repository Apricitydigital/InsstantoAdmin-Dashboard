"use client"

import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Calendar, BarChart3, Users, DollarSign } from "lucide-react"

export default function ReportsPage() {
  const reportTypes = [
    {
      id: "revenue",
      title: "Revenue Report",
      description: "Detailed revenue analysis and trends",
      icon: DollarSign,
      color: "from-green-50 to-emerald-50 border-green-200",
      iconColor: "text-green-600",
      textColor: "text-green-900",
    },
    {
      id: "bookings",
      title: "Booking Report",
      description: "Booking statistics and performance metrics",
      icon: Calendar,
      color: "from-blue-50 to-cyan-50 border-blue-200",
      iconColor: "text-blue-600",
      textColor: "text-blue-900",
    },
    {
      id: "customers",
      title: "Customer Report",
      description: "Customer acquisition and retention analysis",
      icon: Users,
      color: "from-purple-50 to-violet-50 border-purple-200",
      iconColor: "text-purple-600",
      textColor: "text-purple-900",
    },
    {
      id: "performance",
      title: "Performance Report",
      description: "Service and partner performance metrics",
      icon: BarChart3,
      color: "from-orange-50 to-amber-50 border-orange-200",
      iconColor: "text-orange-600",
      textColor: "text-orange-900",
    },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports Center</h1>
            <p className="text-gray-600">Generate and export comprehensive business reports</p>
          </div>
          <Button className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600">
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportTypes.map((report) => {
            const IconComponent = report.icon
            return (
              <Card key={report.id} className={`bg-gradient-to-br ${report.color} hover:shadow-lg transition-shadow`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <IconComponent className={`w-10 h-10 ${report.iconColor}`} />
                    <Badge variant="secondary">Available</Badge>
                  </div>
                  <CardTitle className={`text-xl ${report.textColor}`}>{report.title}</CardTitle>
                  <CardDescription className={report.iconColor}>{report.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex space-x-2">
                    <Button size="sm" className="flex-1">
                      <FileText className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription>Your recently generated reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Reports Generated</h3>
              <p className="mb-4">Generate your first report to see it here</p>
              <Button>Generate Report</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
