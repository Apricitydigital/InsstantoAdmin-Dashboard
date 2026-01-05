import type { RevenueData, ServicePerformance, OperationalMetrics, MarketingMetrics } from "@/types/analytics"

export const mockRevenueData: RevenueData[] = [
  { month: "Jul", revenue: 645000, bookings: 2100, growth: 12.5 },
  { month: "Aug", revenue: 720000, bookings: 2350, growth: 11.6 },
  { month: "Sep", revenue: 680000, bookings: 2200, growth: -5.6 },
  { month: "Oct", revenue: 780000, bookings: 2500, growth: 14.7 },
  { month: "Nov", revenue: 820000, bookings: 2650, growth: 5.1 },
  { month: "Dec", revenue: 845000, bookings: 2750, growth: 3.0 },
]

export const mockServicePerformance: ServicePerformance[] = [
  {
    serviceName: "AC Repair",
    category: "Home Appliances",
    bookings: 450,
    revenue: 675000,
    rating: 4.8,
    completionRate: 94.2,
  },
  {
    serviceName: "Deep Cleaning",
    category: "Cleaning",
    bookings: 380,
    revenue: 570000,
    rating: 4.6,
    completionRate: 96.8,
  },
  {
    serviceName: "Plumbing Repair",
    category: "Plumbing",
    bookings: 320,
    revenue: 384000,
    rating: 4.5,
    completionRate: 91.3,
  },
  {
    serviceName: "Electrical Work",
    category: "Electrical",
    bookings: 280,
    revenue: 420000,
    rating: 4.7,
    completionRate: 89.6,
  },
  {
    serviceName: "Painting",
    category: "Home Improvement",
    bookings: 220,
    revenue: 440000,
    rating: 4.4,
    completionRate: 87.3,
  },
]

export const mockOperationalMetrics: OperationalMetrics = {
  totalPartners: 456,
  activePartners: 342,
  averageResponseTime: 12.5,
  customerSatisfaction: 4.6,
  repeatCustomers: 68.4,
  cancellationRate: 8.7,
}

export const mockMarketingMetrics: MarketingMetrics = {
  newCustomers: 1234,
  customerAcquisitionCost: 145,
  lifetimeValue: 2850,
  conversionRate: 12.8,
  organicTraffic: 65.2,
  paidTraffic: 34.8,
}
