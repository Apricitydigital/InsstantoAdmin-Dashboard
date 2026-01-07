"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchDailyOverviewSummary, DailyOverview } from "@/lib/queries/daily-overview";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, CalendarDays, TrendingUp, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

const ITEMS_PER_PAGE = 4;

export function DailyOverviewCard() {
  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchDailyOverviewSummary();
      setOverview(data);
      setPage(1); // reset pagination on fresh data
      setLoading(false);
    };
    load();
  }, []);

  const services = overview?.services || [];

  const totalPages = Math.ceil(services.length / ITEMS_PER_PAGE);

  const paginatedServices = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return services.slice(start, start + ITEMS_PER_PAGE);
  }, [services, page]);

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

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 rounded-md border bg-gray-50">
                <p className="text-xs text-gray-500">Avg Daily Expense</p>
                <p className="text-lg font-semibold">
                  {formatINR(overview?.dailyAverageExpense || 0)}
                </p>
              </div>
              <div className="p-3 rounded-md border bg-gray-50">
                <p className="text-xs text-gray-500">Booking Amount</p>
                <p className="text-lg font-semibold">
                  {formatINR(overview?.totalBookingAmount || 0)}
                </p>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center gap-2 mb-3 text-gray-700">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <p className="text-sm font-medium">
                Available Partners Today:
                <span className="ml-1 font-semibold">
                  {services.length}
                </span>
              </p>
            </div>

            {/* List */}
            <div className="text-sm font-medium text-gray-700 mb-2">
              Available Partners for Today
            </div>
            <ScrollArea className="flex-1 pr-2">

              {paginatedServices.length > 0 ? (
                paginatedServices.map((srv, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-blue-400" />
                      {srv.name}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </Button>

                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
