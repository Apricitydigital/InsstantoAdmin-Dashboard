import type { Service, ServiceCategory, PricingRule } from "@/types/service"

export const mockServiceCategories: ServiceCategory[] = [
  {
    id: "1",
    name: "Home Cleaning",
    description: "Professional home cleaning services",
    icon: "🏠",
    serviceCount: 8,
    isActive: true,
  },
  {
    id: "2",
    name: "Beauty & Wellness",
    description: "Beauty and wellness services at home",
    icon: "💄",
    serviceCount: 12,
    isActive: true,
  },
  {
    id: "3",
    name: "Repairs & Maintenance",
    description: "Home repair and maintenance services",
    icon: "🔧",
    serviceCount: 15,
    isActive: true,
  },
  {
    id: "4",
    name: "Pet Care",
    description: "Professional pet care services",
    icon: "🐕",
    serviceCount: 6,
    isActive: true,
  },
]

export const mockServices: Service[] = [
  {
    id: "1",
    name: "Deep House Cleaning",
    category: "Home Cleaning",
    description: "Comprehensive deep cleaning service for your entire home",
    basePrice: 2500,
    duration: 180,
    isActive: true,
    rating: 4.8,
    totalBookings: 1250,
    createdAt: "2024-01-15",
    updatedAt: "2024-03-10",
  },
  {
    id: "2",
    name: "Hair Styling at Home",
    category: "Beauty & Wellness",
    description: "Professional hair styling services in the comfort of your home",
    basePrice: 1800,
    duration: 120,
    isActive: true,
    rating: 4.9,
    totalBookings: 890,
    createdAt: "2024-01-20",
    updatedAt: "2024-03-08",
  },
  {
    id: "3",
    name: "AC Repair & Service",
    category: "Repairs & Maintenance",
    description: "Complete AC repair and maintenance service",
    basePrice: 1200,
    duration: 90,
    isActive: true,
    rating: 4.7,
    totalBookings: 650,
    createdAt: "2024-02-01",
    updatedAt: "2024-03-12",
  },
]

export const mockPricingRules: PricingRule[] = [
  {
    id: "1",
    serviceId: "1",
    type: "peak_hours",
    multiplier: 1.2,
    conditions: { hours: ["18:00", "19:00", "20:00"] },
    isActive: true,
  },
  {
    id: "2",
    serviceId: "2",
    type: "weekend",
    multiplier: 1.15,
    conditions: { days: ["saturday", "sunday"] },
    isActive: true,
  },
]
