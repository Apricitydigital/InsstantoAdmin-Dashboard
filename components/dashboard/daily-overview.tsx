"use client";

import { useEffect, useState } from "react";
import { fetchDailyOverviewSummary, DailyOverview } from "@/lib/queries/daily-overview";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2, CalendarDays, TrendingUp, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function DailyOverviewCard() {
  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchDailyOverviewSummary();
      setOverview(data);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <Card className="relative border-l-4 border-blue-500 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md rounded-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2 text-blue-500">
          <CalendarDays className="h-5 w-5" />
          <CardTitle className="text-blue-500 text-base font-semibold">
            Daily Overview
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
            <p className="text-sm text-gray-500">Loading today’s summary...</p>
          </div>
        ) : (
          <>
            {/* Date */}
            <div className="text-sm text-gray-500 mb-2">{overview?.date}</div>

            {/* Main summary metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 transition">
<p className="text-xs text-gray-500">Avg Daily Expense</p>
<p className="text-lg font-semibold text-gray-800">
  {formatINR(overview?.dailyAverageExpense || 0)}
</p>

              </div>
              <div className="p-3 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 transition">
                <p className="text-xs text-gray-500">Booking Amount</p>
                <p className="text-lg font-semibold text-gray-800">
                  {formatINR(overview?.totalBookingAmount || 0)}
                </p>
              </div>
            </div>

            {/* Total bookings */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-gray-700">
                <TrendingUp className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium">
  Available Partners Today:{" "}

                  <span className="text-gray-800 font-semibold">
                    {overview?.totalBookings || 0}
                  </span>
                </p>
              </div>
            </div>

            {/* Services List */}
<div className="text-sm font-medium text-gray-700 mb-2">
  Available Partners for Today
</div>

            <ScrollArea className="h-[150px] pr-2">
              {overview?.services && overview.services.length > 0 ? (
                overview.services.map((srv, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-gray-100 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="h-4 w-4 text-blue-400" />
                      {srv.name}
                    </div>
                    <div className="text-gray-600 text-xs sm:text-sm text-right">
                      {srv.count}× — {formatINR(srv.amount)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 text-sm py-4">
                  No Partner Available for today.
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}