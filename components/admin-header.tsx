"use client"

import { useEffect, useState } from "react"
import { Bell, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/lib/auth"
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
  const { user, logout } = useAuth()
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

  const handleLogout = () => {
    logout()
    window.location.href = "/login"
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 lg:h-[60px] lg:px-6">
      {/* Title */}
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-2xl">{title}</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* 🔔 Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative bg-transparent"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />

              {notifications.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 text-xs bg-red-500 text-white">
                  {notifications.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-80 p-0">
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

        {/* 👤 User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.name}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
                <Badge variant="secondary" className="w-fit text-xs capitalize">
                  {user?.role}
                </Badge>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
