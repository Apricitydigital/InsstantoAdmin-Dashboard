"use client";

import { useEffect, useMemo, useState } from "react";

type SheetBooking = {
  bookingDate: string;
  employeeName: string;
  leadSource: string;
  amount: number;
};

type Props = {
  fromDate: string;
  toDate: string;
};

export default function SheetBookingStats({ fromDate, toDate }: Props) {
  const [data, setData] = useState<SheetBooking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/bookings/sheet?from=${fromDate}&to=${toDate}`
        );
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        console.error("Failed to load sheet stats", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [fromDate, toDate]);

  const stats = useMemo(() => {
    if (!data.length) {
      return {
        totalBookings: 0,
        totalRevenue: 0,
        topEmployee: "—",
        topLeadSource: "—",
      };
    }

    let totalRevenue = 0;
    const employeeCount: Record<string, number> = {};
    const sourceCount: Record<string, number> = {};

    data.forEach((b) => {
      totalRevenue += b.amount || 0;

      employeeCount[b.employeeName] =
        (employeeCount[b.employeeName] || 0) + 1;

      sourceCount[b.leadSource] =
        (sourceCount[b.leadSource] || 0) + 1;
    });

    const topEmployee =
      Object.entries(employeeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "—";

    const topLeadSource =
      Object.entries(sourceCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "—";

    return {
      totalBookings: data.length,
      totalRevenue,
      topEmployee,
      topLeadSource,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border rounded-lg p-4 text-sm text-muted-foreground"
          >
            Loading...
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        title="Total Sheet Bookings"
        value={stats.totalBookings.toString()}
      />
      <StatCard
        title="Total Revenue"
        value={`₹${stats.totalRevenue.toLocaleString()}`}
      />
      <StatCard title="Top Employee" value={stats.topEmployee} />
      <StatCard title="Top Lead Source" value={stats.topLeadSource} />
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
