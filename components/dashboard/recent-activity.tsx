import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface RecentBooking {
  service: string
  customer: string
  amount: string
  status: "confirmed" | "in-progress" | "completed" | "cancelled"
}

interface SystemAlert {
  title: string
  description: string
  type: "warning" | "info" | "success"
  color: string
}

const recentBookings: RecentBooking[] = [
  { service: "Home Cleaning", customer: "Priya Sharma", amount: "₹1,200", status: "confirmed" },
  { service: "AC Repair", customer: "Rahul Gupta", amount: "₹2,500", status: "in-progress" },
  { service: "Pest Control", customer: "Anjali Singh", amount: "₹1,800", status: "completed" },
  { service: "Plumbing", customer: "Vikram Patel", amount: "₹950", status: "confirmed" },
]

const systemAlerts: SystemAlert[] = [
  {
    title: "Low Stock Alert",
    description: "Cleaning supplies running low in Mumbai warehouse",
    type: "warning",
    color: "secondary",
  },
  {
    title: "Partner Verification",
    description: "3 partners pending document verification",
    type: "info",
    color: "primary",
  },
  {
    title: "Revenue Milestone",
    description: "Monthly revenue target achieved 5 days early!",
    type: "success",
    color: "chart-3",
  },
]

export function RecentActivity() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
          <CardDescription>Latest service bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentBookings.map((booking, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium">{booking.service}</p>
                  <p className="text-sm text-muted-foreground">{booking.customer}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{booking.amount}</p>
                  <Badge
                    variant={
                      booking.status === "completed"
                        ? "default"
                        : booking.status === "confirmed"
                          ? "secondary"
                          : booking.status === "in-progress"
                            ? "outline"
                            : "destructive"
                    }
                    className="text-xs"
                  >
                    {booking.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Alerts</CardTitle>
          <CardDescription>Important notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemAlerts.map((alert, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg bg-${alert.color}/10 border border-${alert.color}/20 hover:bg-${alert.color}/15 transition-colors`}
              >
                <div className={`h-2 w-2 rounded-full bg-${alert.color} mt-2 flex-shrink-0`} />
                <div>
                  <p className="font-medium text-sm">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
