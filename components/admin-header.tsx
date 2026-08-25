"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

interface AdminHeaderProps {
  title?: string
}

type NotificationItem = {
  id: string
  type: "booking" | "complaint"
  title: string
  subtitle: string
}

export function AdminHeader({ title = "Dashboard" }: AdminHeaderProps) {
  const db = getFirestoreDb()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  // 🔔 Real-time notifications (read-only)
  useEffect(() => {
    let bookings: NotificationItem[] = []
    let complaints: NotificationItem[] = []

    const bookingQuery = query(
      collection(db, "bookings"),
      where("bookingStatus", "==", "Pending")
    )

    const complaintQuery = query(
      collection(db, "customer_complain"),
      where("complaint_status", "==", "pending")
    )

    const unsubBookings = onSnapshot(bookingQuery, (snapshot) => {
      bookings = snapshot.docs.map((doc) => ({
        id: doc.id,
        type: "booking",
        title: "New Booking",
        subtitle: `Booking ID: ${doc.id.slice(0, 8)}`,
      }))
      setNotifications([...bookings, ...complaints])
    })

    const unsubComplaints = onSnapshot(complaintQuery, (snapshot) => {
      complaints = snapshot.docs.map((doc) => ({
        id: doc.id,
        type: "complaint",
        title: "New Complaint",
        subtitle: `Complaint ID: ${doc.id.slice(0, 8)}`,
      }))
      setNotifications([...bookings, ...complaints])
    })

    return () => {
      unsubBookings()
      unsubComplaints()
    }
  }, [db])

  return (
    <header
      data-admin-header
      className="fixed left-0 right-0 top-0 z-40 flex h-14 min-h-14 items-center gap-2 border-b border-slate-800 bg-slate-950/95 px-3 pl-16 text-white shadow-md shadow-slate-950/10 backdrop-blur supports-[backdrop-filter]:bg-slate-950/90 sm:gap-3 sm:px-4 sm:pl-16 lg:left-[var(--admin-sidebar-width,272px)] lg:h-[60px] lg:min-h-[60px] lg:px-6"
    >
      {/* Title */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="hidden h-8 w-1 rounded-full bg-indigo-500 sm:block" />
        <div className="min-w-0">
          <p className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">Admin workspace</p>
          <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg md:text-xl">{title}</h1>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* 🔔 Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative size-9 border-white/10 bg-white/[0.06] p-0 text-slate-200 shadow-none hover:border-indigo-400/30 hover:bg-indigo-500/15 hover:text-white"
              title="Notifications"
            >
              <Bell className="size-4" />

              {notifications.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 text-xs bg-red-500 text-white">
                  {notifications.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-xl border-slate-200 p-0 shadow-xl">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 font-semibold text-slate-900">
              Notifications
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                No new notifications
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-indigo-50/60"
                  >
                    <div className="text-sm font-medium">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.subtitle}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

      </div>
    </header>
  )
}
