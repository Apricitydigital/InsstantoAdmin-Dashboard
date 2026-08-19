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
      className="fixed top-0 right-0 left-0 z-40 flex h-14 min-h-14 items-center gap-2 border-b bg-background/95 px-3 pl-16 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:gap-3 sm:px-4 sm:pl-16 lg:left-[var(--admin-sidebar-width,256px)] lg:h-[60px] lg:min-h-[60px] lg:px-6"
    >
      {/* Title */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold sm:text-lg md:text-xl xl:text-2xl">{title}</h1>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* 🔔 Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative size-9 bg-transparent p-0"
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

          <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1rem))] p-0">
            <div className="border-b px-4 py-2 font-semibold">
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
                    className="px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition"
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
