"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Calendar, ListChecks } from "lucide-react";
import { fetchCustomerStats } from "@/lib/queries/customers";

type Stats = {
  totalCustomers: number;
  newCustomersToday: number;
  customersWithOneBooking: number;
  customersWithMultipleBookings: number;
};

interface CustomerStatsProps {
  fromDate: string;
  toDate: string;
}

export function CustomerStats({ fromDate, toDate }: CustomerStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      const data = await fetchCustomerStats(fromDate, toDate);
      setStats(data);
      setLoading(false);
    }
    loadStats();
  }, [fromDate, toDate]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading customer stats...</div>;
  }

  const kpiCards = [
    {
      title: "Total Sign-Ups",
      value: stats?.totalCustomers.toString() || "0",
      icon: Users,
      color: "bg-blue-100 text-blue-600 border-blue-600",
      description: "All registered customers",
      percentageChange: "-9.2%",
    },
    {
      title: "Today's Sign-Ups",
      value: stats?.newCustomersToday.toString() || "0",
      icon: Calendar,
      color: "bg-green-100 text-green-600 border-green-600",
      description: "New signups today",
      percentageChange: "-5.1%",
    },
    {
      title: "Total New Customers",
      value: stats?.customersWithOneBooking.toString() || "0",
      icon: UserPlus,
      color: "bg-yellow-100 text-yellow-600 border-yellow-600",
      description: "Customers with exactly 1 booking",
      percentageChange: "-4.8%",
    },
    {
      title: "Total Repeated Customers",
      value: stats?.customersWithMultipleBookings.toString() || "0",
      icon: ListChecks,
      color: "bg-purple-100 text-purple-600 border-purple-600",
      description: "Customers with multiple bookings",
      percentageChange: "-6.4%",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      {kpiCards.map((stat) => (
        <Card
          key={stat.title}
          className={`border-l-4 ${stat.color} shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color.replace('bg-', 'text-')}`} />
          </CardHeader>
          <CardContent className={`bg-${stat.color.replace('bg-', 'bg-opacity-')} text-black`}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
            <div className="text-xs text-muted-foreground">{stat.percentageChange} from last month</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}