"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { CalendarRange, Database, FileSpreadsheet, RotateCcw, ShoppingCart } from "lucide-react"

import { AdminHeader } from "@/components/admin-header"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const LoadingPanel = () => <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
const BookingStats = dynamic(() => import("@/components/bookings/booking-stats"), { loading: LoadingPanel })
const BookingTable = dynamic(() => import("@/components/bookings/booking-table").then((module) => module.BookingTable), { loading: LoadingPanel })
const SheetBookingStats = dynamic(() => import("@/components/bookings/sheet-booking-stats"), { loading: LoadingPanel })
const SheetBookingTable = dynamic(() => import("@/components/bookings/sheet-booking-table").then((module) => module.SheetBookingTable), { loading: LoadingPanel })
const CartStats = dynamic(() => import("@/components/cart/cart-stats"), { loading: LoadingPanel })
const CartTable = dynamic(() => import("@/components/cart/cart-table").then((module) => module.CartTable), { loading: LoadingPanel })

function formatDateInput(date: Date) {
  return date.toLocaleDateString("en-CA")
}

export default function BookingsPage() {
  const today = new Date()
  const defaultStart = new Date(2025, 3, 1)
  const [fromDate, setFromDate] = useState(formatDateInput(defaultStart))
  const [toDate, setToDate] = useState(formatDateInput(today))
  const [activeTab, setActiveTab] = useState("backend")

  const resetDates = () => {
    setFromDate(formatDateInput(defaultStart))
    setToDate(formatDateInput(new Date()))
  }

  return (
    <ProtectedRoute requiredPermission="bookings:view">
      <div className="flex min-h-screen w-full flex-col bg-slate-50/80">
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <AdminHeader title="Booking & Scheduling" />
          <main className="mx-auto w-full max-w-[1800px] flex-1 space-y-5 p-3 sm:p-5 lg:p-6">
            <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-100/70 blur-3xl" />
              <div className="relative grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <div className="max-w-2xl">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CalendarRange className="h-5 w-5" /></div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Bookings workspace</h1>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">Monitor bookings, service fulfilment, revenue, sheet records, and pending cart activity.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Booking date</p>
                  <div className="grid gap-3 sm:grid-cols-[minmax(145px,1fr)_auto_minmax(145px,1fr)_auto] sm:items-end">
                    <div className="space-y-1.5"><Label htmlFor="booking-from-date" className="text-xs text-slate-600">From</Label><Input id="booking-from-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} max={formatDateInput(today)} className="bg-white" /></div>
                    <span className="hidden pb-2 text-xs text-slate-400 sm:block">to</span>
                    <div className="space-y-1.5"><Label htmlFor="booking-to-date" className="text-xs text-slate-600">To</Label><Input id="booking-to-date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} max={formatDateInput(today)} className="bg-white" /></div>
                    <Button variant="outline" onClick={resetDates} className="bg-white"><RotateCcw className="mr-2 h-4 w-4" />Reset</Button>
                  </div>
                </div>
              </div>
            </section>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-fit">
                <TabsTrigger value="backend" className="min-w-fit gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white"><Database className="h-4 w-4" />Backend bookings</TabsTrigger>
                <TabsTrigger value="sheet" className="min-w-fit gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white"><FileSpreadsheet className="h-4 w-4" />Sheet bookings</TabsTrigger>
                <TabsTrigger value="cart" className="min-w-fit gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white"><ShoppingCart className="h-4 w-4" />Cart services</TabsTrigger>
              </TabsList>
              <TabsContent value="backend" className="mt-4 space-y-4 focus-visible:outline-none"><BookingStats fromDate={fromDate} toDate={toDate} /><BookingTable fromDate={fromDate} toDate={toDate} /></TabsContent>
              <TabsContent value="sheet" className="mt-4 space-y-4 focus-visible:outline-none"><SheetBookingStats fromDate={fromDate} toDate={toDate} /><SheetBookingTable fromDate={fromDate} toDate={toDate} /></TabsContent>
              <TabsContent value="cart" className="mt-4 space-y-4 focus-visible:outline-none"><CartStats fromDate={fromDate} toDate={toDate} /><CartTable fromDate={fromDate} toDate={toDate} /></TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
