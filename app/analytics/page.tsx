import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { RevenueChart } from "@/components/analytics/revenue-chart"
import { ServicePerformance } from "@/components/analytics/service-performance"
import { OperationalMetrics } from "@/components/analytics/operational-metrics"
import { MarketingMetrics } from "@/components/analytics/marketing-metrics"

export default function AnalyticsPage() {
  return (
    <ProtectedRoute requiredPermission="analytics:view">
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AdminSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <AdminHeader title="Analytics Hub" />
          <main className="flex-1 space-y-4 p-4 md:p-6">
            {/* Revenue Analytics */}
            <div className="grid gap-4 md:grid-cols-3">
              <RevenueChart />
              <ServicePerformance />
            </div>

            {/* Operational & Marketing Metrics */}
            <div className="grid gap-4 md:grid-cols-2">
              <OperationalMetrics />
              <MarketingMetrics />
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
