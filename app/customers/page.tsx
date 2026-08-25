"use client"

import { useState } from "react"
import { CalendarRange, RotateCcw, Star, Users } from "lucide-react"

import { AdminHeader } from "@/components/admin-header"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { CustomerStats } from "@/components/customers/customer-stats"
import { CustomerTable } from "@/components/customers/customer-table"
import { SubscriptionTable } from "@/components/customers/subscription-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function formatDateInput(date: Date) {
  return date.toLocaleDateString("en-CA")
}

export default function CustomersPage() {
  const today = new Date()
  const defaultStart = new Date(2025, 3, 1)
  const [activeTab, setActiveTab] = useState("all")
  const [fromDate, setFromDate] = useState(formatDateInput(defaultStart))
  const [toDate, setToDate] = useState(formatDateInput(today))

  const clearFilter = () => {
    setFromDate(formatDateInput(defaultStart))
    setToDate(formatDateInput(new Date()))
  }

  return (
    <ProtectedRoute requiredPermission="customers:view_limited">
      <div className="flex min-h-screen w-full flex-col bg-slate-50/80">
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <AdminHeader title="Customer Management" />
          <main className="mx-auto w-full max-w-[1800px] flex-1 space-y-5 p-3 sm:p-5 lg:p-6">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <div className="max-w-2xl">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Customer overview</h1>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    Review customer activity, booking behaviour, subscriptions, and account details in one place.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <CalendarRange className="h-4 w-4" /> Reporting period
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(145px,1fr)_auto_minmax(145px,1fr)_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor="customer-from-date" className="text-xs text-slate-600">From</Label>
                      <Input id="customer-from-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} max={formatDateInput(today)} className="bg-white" />
                    </div>
                    <span className="hidden pb-2 text-xs text-slate-400 sm:block">to</span>
                    <div className="space-y-1.5">
                      <Label htmlFor="customer-to-date" className="text-xs text-slate-600">To</Label>
                      <Input id="customer-to-date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} max={formatDateInput(today)} className="bg-white" />
                    </div>
                    <Button variant="outline" onClick={clearFilter} className="w-full bg-white sm:w-auto">
                      <RotateCcw className="mr-2 h-4 w-4" /> Reset
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <CustomerStats fromDate={fromDate} toDate={toDate} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-fit">
                <TabsTrigger value="all" className="min-w-fit gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                  <Users className="h-4 w-4" /> All customers
                </TabsTrigger>
                <TabsTrigger value="subscribed" className="min-w-fit gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                  <Star className="h-4 w-4" /> Subscribed
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4 focus-visible:outline-none">
                <CustomerTable fromDate={fromDate} toDate={toDate} />
              </TabsContent>
              <TabsContent value="subscribed" className="mt-4 focus-visible:outline-none">
                <SubscriptionTable />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
