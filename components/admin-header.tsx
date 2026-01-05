"use client"

import { useState } from "react"
import { Search, Bell, User, Calendar, Filter, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { useAuth } from "@/lib/auth"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"

interface AdminHeaderProps {
  title?: string
}

export function AdminHeader({ title = "Dashboard" }: AdminHeaderProps) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2024, 0, 20),
    to: new Date(2024, 1, 9),
  })

  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    window.location.href = "/login"
  }

  return (
      <header
      className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:h-[60px] lg:px-6"
      >
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-2xl text-balance">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Global Search */}
        {/* <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search bookings, customers, partners..." className="w-[300px] pl-8" />
        </div> */}

        {/* Date Range Picker */}
        {/* <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Calendar className="h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd")} - {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover> */}

        {/* Quick Filters */}
        {/* <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Quick Filters</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>All Cities</DropdownMenuItem>
            <DropdownMenuItem>Mumbai</DropdownMenuItem>
            <DropdownMenuItem>Delhi</DropdownMenuItem>
            <DropdownMenuItem>Bangalore</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>All Categories</DropdownMenuItem>
            <DropdownMenuItem>Home Cleaning</DropdownMenuItem>
            <DropdownMenuItem>Pest Control</DropdownMenuItem>
            <DropdownMenuItem>Appliance Repair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> */}

        {/* Notifications */}
        {/* <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative bg-transparent">
              <Bell className="h-4 w-4" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs bg-secondary">3</Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
              <div className="font-medium">New booking received</div>
              <div className="text-sm text-muted-foreground">Home cleaning service in Mumbai - ₹1,200</div>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
              <div className="font-medium">Partner verification pending</div>
              <div className="text-sm text-muted-foreground">2 partners awaiting document approval</div>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
              <div className="font-medium">Low stock alert</div>
              <div className="text-sm text-muted-foreground">Cleaning supplies running low in Delhi warehouse</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> */}

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                <Badge variant="secondary" className="w-fit text-xs capitalize">
                  {user?.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
            {/* <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator /> */}
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}