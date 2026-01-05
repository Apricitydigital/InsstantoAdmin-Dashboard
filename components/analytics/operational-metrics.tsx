"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Clock, Heart, XCircle, UserCheck, Repeat } from "lucide-react"
import { mockOperationalMetrics } from "@/lib/queries/analytics"

const metrics = [
  {
    title: "Total Partners",
    value: mockOperationalMetrics.totalPartners.toString(),
    description: "Registered partners",
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    title: "Active Partners",
    value: mockOperationalMetrics.activePartners.toString(),
    description: "Currently active",
    icon: UserCheck,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  {
    title: "Response Time",
    value: `${mockOperationalMetrics.averageResponseTime} min`,
    description: "Average response",
    icon: Clock,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    title: "Customer Satisfaction",
    value: mockOperationalMetrics.customerSatisfaction.toString(),
    description: "Average rating",
    icon: Heart,
    color: "text-pink-600",
    bgColor: "bg-pink-100",
  },
  {
    title: "Repeat Customers",
    value: `${mockOperationalMetrics.repeatCustomers}%`,
    description: "Customer retention",
    icon: Repeat,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    title: "Cancellation Rate",
    value: `${mockOperationalMetrics.cancellationRate}%`,
    description: "Booking cancellations",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
]

export function OperationalMetrics() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-chart-3" />
          Operational Metrics
        </CardTitle>
        <CardDescription>Key operational performance indicators</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.title} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{metric.title}</p>
                <p className={`text-lg font-semibold ${metric.color}`}>{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
