"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminHeader } from "@/components/admin-header";
import { CustomerStats } from "@/components/customers/customer-stats";
import { CustomerTable } from "@/components/customers/customer-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { Star, Users } from "lucide-react";
import { SubscriptionTable } from "@/components/customers/subscription-table";

function formatDateInput(d: Date) {
  return d.toLocaleDateString("en-CA"); // ✅ Formats as YYYY-MM-DD
}

export default function CustomersPage() {
  // ✅ Default range: From April 1, 2025 to today's date
  const today = new Date();
  const defaultStart = new Date(2025, 3, 1); // Month is 0-indexed → 3 = April
  const defaultEnd = today;
   const [activeTab, setActiveTab] = useState("all")
  
  const [fromDate, setFromDate] = useState<string>(formatDateInput(defaultStart));
  const [toDate, setToDate] = useState<string>(formatDateInput(defaultEnd));

  // ✅ Reset button now resets to April 1, 2025 → today
  const clearFilter = () => {
    setFromDate(formatDateInput(defaultStart));
    setToDate(formatDateInput(defaultEnd));
  };

  return (
    <ProtectedRoute requiredPermission="customers:view_limited">
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AdminSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <AdminHeader title="Customer Management" />
          <main className="flex-1 space-y-6 p-4 md:p-6">
            {/* ---- Date Range Filter ---- */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-lg font-semibold"> Track Customer details here </p>
              </div>
              <div className="flex gap-2 items-center">
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={(e) => setFromDate(e.target.value)} 
                  className="border rounded px-3 py-2 text-sm"
                  max={formatDateInput(today)}  // Disable future dates
                />
                <span className="text-sm text-muted-foreground">to</span>
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={(e) => setToDate(e.target.value)} 
                  className="border rounded px-3 py-2 text-sm"
                  max={formatDateInput(today)}  // Disable future dates
                />
                <button 
                  onClick={clearFilter} 
                  className="bg-gray-200 hover:bg-gray-300 text-sm px-3 py-2 rounded whitespace-nowrap"
                >
                  Show All Time
                </button>
              </div>
            </div>

            <CustomerStats fromDate={fromDate} toDate={toDate} />
           
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>All Customers</span>
                </TabsTrigger>
                <TabsTrigger value="subscribed" className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  <span>Subscribed</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                 <CustomerTable fromDate={fromDate} toDate={toDate} />
              </TabsContent>

              <TabsContent value="subscribed" className="mt-4">
                <SubscriptionTable />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}