"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchTopPartners, TopPartner } from "@/lib/queries/top-partners";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Star, Users, ChevronLeft, ChevronRight } from "lucide-react";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

const PAGE_SIZE = 4;

export function TopPartnersCard() {
  const [partners, setPartners] = useState<TopPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchTopPartners().then((res) => {
      setPartners(res);
      setLoading(false);
    });
  }, []);

  const totalPages = Math.ceil(partners.length / PAGE_SIZE);

  const paginatedPartners = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return partners.slice(start, start + PAGE_SIZE);
  }, [partners, page]);

  return (
    <Card className="relative border-l-4 border-blue-500 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md rounded-md">
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2 text-blue-500">
          <Users className="h-5 w-5" />
          <CardTitle className="text-blue-500 text-base font-semibold">
            Top Partners
          </CardTitle>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="space-y-4 pt-4">
        {loading && (
          <div className="text-center text-gray-500 py-6">Loading...</div>
        )}

        {!loading && partners.length === 0 && (
          <div className="text-center text-gray-500 py-6">
            No top partners found.
          </div>
        )}

        {!loading &&
          paginatedPartners.map((partner, idx) => {
            const rank = (page - 1) * PAGE_SIZE + idx + 1;

            return (
              <div
                key={partner.id}
                className="border-b border-gray-100 pb-3 last:border-b-0 transition-colors hover:bg-blue-50/40 rounded-md px-2 py-1"
              >
                {/* Row 1 */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 text-sm sm:text-base">
                      {rank}. {partner.name}
                    </p>
                  </div>

                  <div className="text-xs sm:text-sm text-gray-600 flex-1 text-center">
                    {partner.completedBookings} completed /{" "}
                    {partner.totalBookings} total
                  </div>

                  <div className="flex justify-end flex-1">
                    <Link href={`/partners/${partner.id}`}>
                      <Button size="sm" variant="outline">
                        View Profile
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="flex items-start justify-between mt-1">
                  <div className="flex flex-col flex-1 text-xs sm:text-sm text-gray-600">
                    <div className="flex items-center text-yellow-500">
                      <Star className="w-3.5 h-3.5 mr-1 fill-yellow-400" />
                      <span>{partner.avgRating.toFixed(1)} / 5</span>
                    </div>
                  </div>

                  <div className="flex flex-col flex-1 text-center text-xs sm:text-sm text-gray-600">
                    <span>
                      <strong className="text-gray-800">
                        {formatINR(partner.earnings)}
                      </strong>
                    </span>
                    {partner.pendingPayouts > 0 && (
                      <span className="text-gray-500 text-xs">
                        (Pending: {formatINR(partner.pendingPayouts)})
                      </span>
                    )}
                  </div>

                  <div className="flex-1" />
                </div>
              </div>
            );
          })}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>

            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
