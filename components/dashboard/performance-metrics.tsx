"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock, Star, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchTopCategories, type TopCategory } from "@/lib/queries/top-services";
import { fetchMostBookedSlots, type TimeSlot } from "@/lib/queries/most-booked-slots";
import { fetchNewVsRepeatCustomers } from "@/lib/queries/customer-insights";

type TimeSlotWithPercentage = TimeSlot & { percentage: number };

const customerMetrics = [
  {
    label: "Customer Satisfaction",
    value: "4.8/5",
    count: "2,156 reviews",
  },
];

const ITEMS_PER_PAGE = 5;

export function PerformanceMetrics({
  fromDate,
  toDate,
}: {
  fromDate: string;
  toDate: string;
}) {
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [peakHours, setPeakHours] = useState<TimeSlotWithPercentage[]>([]);
  const [repeatCustomerCount, setRepeatCustomerCount] = useState<number>(0);
  const [newCustomerCount, setNewCustomerCount] = useState<number>(0);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [peakHoursPage, setPeakHoursPage] = useState(1);

useEffect(() => {
  const loadCategories = async () => {
    const categories = await fetchTopCategories(fromDate, toDate);
    setTopCategories(categories);
  };

    const loadSlots = async () => {
      const slots = await fetchMostBookedSlots(fromDate, toDate);
      const totalBookings = slots.reduce((sum, s) => sum + s.bookings, 0) || 1;
      const slotsWithPercent: TimeSlotWithPercentage[] = slots.map((s) => ({
        ...s,
        percentage: Math.round((s.bookings / totalBookings) * 100),
      }));
      setPeakHours(slotsWithPercent);
    };

    const loadCustomerCounts = async () => {
      try {
        const data = await fetchNewVsRepeatCustomers(fromDate, toDate);
        setRepeatCustomerCount(data.repeatCustomerCount);
        setNewCustomerCount(data.newCustomerCount);
        setAverageRating(data.averageRating);
        setTotalRatings(data.totalRatings);
      } catch (error) {
        console.error("Error fetching customer counts:", error);
      }
    };

    loadCategories();
    loadSlots();
    loadCustomerCounts();
  }, [fromDate, toDate]);

  const totalCategoriesPages = Math.ceil(topCategories.length / ITEMS_PER_PAGE);
  const paginatedCategories = topCategories.slice(
    (categoriesPage - 1) * ITEMS_PER_PAGE,
    categoriesPage * ITEMS_PER_PAGE
  );

  const totalPeakHoursPages = Math.ceil(peakHours.length / ITEMS_PER_PAGE);
  const paginatedPeakHours = peakHours.slice(
    (peakHoursPage - 1) * ITEMS_PER_PAGE,
    peakHoursPage * ITEMS_PER_PAGE
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Peak Hours */}
      <Card className="border-l-4 border-blue-500 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground font-bold">
            <Clock className="h-5 w-5 text-blue-500" /> Slots with Maximum Bookings
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Most active booking time Slots
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {peakHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              <>
             {paginatedPeakHours.map((hour, index) => (
  <div key={index} className="flex flex-col justify-between py-1">
    {/* Row 1: Time + Revenue */}
    <div className="flex items-center justify-between">
   <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
  {hour.time}
  <Badge variant="outline" className="text-xs">
    {hour.bookings}
  </Badge>
</span>

            <div className="flex items-center gap-3">
        <Progress value={hour.percentage} className="w-16 h-2" />
        <span className="text-xs text-muted-foreground w-8">
          {hour.percentage}%
        </span>
      </div>
      <span className="text-sm font-semibold text-green-600">
        ₹{hour.revenue?.toLocaleString("en-IN") || 0}
      </span>
    </div>

    {/* Row 2: Progress + Booking Count */}
    {/* <div className="flex items-center justify-end mt-1">
    </div> */}
  </div>
))}

                {/* Pagination Controls */}
                {totalPeakHoursPages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPeakHoursPage((p) => Math.max(1, p - 1))}
                      disabled={peakHoursPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {peakHoursPage} of {totalPeakHoursPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPeakHoursPage((p) => Math.min(totalPeakHoursPages, p + 1))}
                      disabled={peakHoursPage === totalPeakHoursPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Categories */}
      <Card className="border-l-4 border-purple-500 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground font-bold">
            <Star className="h-5 w-5 text-purple-500" /> Top Categories
          </CardTitle>
          <CardDescription className="text-muted-foreground">By booking volume</CardDescription>
        </CardHeader>
        <CardContent>
          {topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings found</p>
          ) : (
            <div className="space-y-3">
              {paginatedCategories.map((category, index) => (
                <div key={index} className="flex flex-col justify-between py-1">
                  {/* Row 1: Category Name + Revenue */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {category.categoryName}
                    </span>
                    <span className="text-sm font-semibold text-green-600">
                      ₹{category.totalRevenue?.toLocaleString("en-IN") || 0}
                    </span>
                  </div>

                  {/* Row 2: Top Service + Booking Count */}
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {category.topService}   
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {category.totalBookings}
                    </Badge>
                  </div>
                </div>
              ))}


              {/* Pagination Controls */}
              {totalCategoriesPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCategoriesPage((p) => Math.max(1, p - 1))}
                    disabled={categoriesPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {categoriesPage} of {totalCategoriesPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCategoriesPage((p) => Math.min(totalCategoriesPages, p + 1))}
                    disabled={categoriesPage === totalCategoriesPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Insights */}
      <Card className="border-l-4 border-green-500 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground font-bold">
            <TrendingUp className="h-5 w-5 text-green-500" /> Customer Insights
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Customer behavior and satisfaction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/70">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Repeat Customers</p>
                <p className="text-xs text-muted-foreground">{repeatCustomerCount}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">
                  {Math.round(
                    (repeatCustomerCount / (repeatCustomerCount + newCustomerCount || 1)) * 100
                  )}{" "}
                  %
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/70">
              <div>
                <p className="text-sm font-medium text-muted-foreground">New Customers</p>
                <p className="text-xs text-muted-foreground">{newCustomerCount}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">
                  {Math.round(
                    (newCustomerCount / (repeatCustomerCount + newCustomerCount || 1)) * 100
                  )}{" "}
                  %
                </p>
              </div>
            </div>
            {customerMetrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/70">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <p className="text-xs text-muted-foreground">{totalRatings}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{averageRating}/5</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}