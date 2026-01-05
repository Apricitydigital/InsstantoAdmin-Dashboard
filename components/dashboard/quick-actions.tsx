import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, BarChart3, PieChart, DollarSign, Star, Users, Settings, FileText } from "lucide-react"

const quickActions = [
  { title: "View All Bookings", href: "/bookings", icon: Calendar, description: "Manage bookings" },
  { title: "Revenue Report", href: "/analytics/revenue", icon: BarChart3, description: "Financial insights" },
  { title: "Customer Cohorts", href: "/analytics/marketing", icon: PieChart, description: "User analytics" },
  { title: "Service Pricing", href: "/services", icon: DollarSign, description: "Update pricing" },
  { title: "Reviews & Replies", href: "/support", icon: Star, description: "Customer feedback" },
  { title: "Partner Management", href: "/partners", icon: Users, description: "Manage partners" },
  { title: "System Settings", href: "/settings", icon: Settings, description: "Configuration" },
  { title: "Export Reports", href: "/reports", icon: FileText, description: "Generate reports" },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Frequently used dashboard shortcuts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-8">
          {quickActions.map((action) => (
            <Button
              key={action.title}
              variant="outline"
              className="h-auto flex-col gap-2 p-4 hover:bg-gradient-to-br hover:from-primary/5 hover:to-secondary/5 bg-transparent group"
            >
              <action.icon className="h-5 w-5 group-hover:text-primary transition-colors" />
              <div className="text-center">
                <span className="text-xs font-medium">{action.title}</span>
                <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
