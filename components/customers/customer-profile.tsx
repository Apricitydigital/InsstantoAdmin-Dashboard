"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { User, Phone, Mail, MapPin, Calendar, DollarSign, Star, Edit, Ban, Gift, MessageSquare } from "lucide-react"
import type { Customer, CustomerBooking } from "@/types/customer"
import { mockCustomers, mockCustomerBookings } from "@/lib/queries/customers"

interface CustomerProfileProps {
  customerId: string
}

export function CustomerProfile({ customerId }: CustomerProfileProps) {
  const customer = mockCustomers.find((c) => c.id === customerId)
  const bookings = mockCustomerBookings[customerId] || []
  const [notes, setNotes] = useState(customer?.notes || "")

  if (!customer) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold">Customer Not Found</h2>
        <p className="text-muted-foreground">The requested customer could not be found.</p>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: Customer["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>
      case "blocked":
        return <Badge variant="destructive">Blocked</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getBookingStatusBadge = (status: CustomerBooking["status"]) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>
      case "confirmed":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Confirmed</Badge>
      case "in-progress":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In Progress</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Customer Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold">
                {customer.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <CardTitle className="text-2xl">{customer.name}</CardTitle>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {customer.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {customer.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {customer.city}
                  </span>
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(customer.status)}
              {customer.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Customer Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customer.totalBookings}</div>
            <p className="text-xs text-muted-foreground">Since {formatDate(customer.signupDate)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customer.totalSpent)}</div>
            <p className="text-xs text-muted-foreground">Lifetime Value: {formatCurrency(customer.lifetimeValue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {customer.averageRating}
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-xs text-muted-foreground">Based on {customer.totalBookings} bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Booking</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customer.lastBookingDate ? formatDate(customer.lastBookingDate) : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">Member since {formatDate(customer.signupDate)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Details Tabs */}
      <Tabs defaultValue="bookings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bookings">Booking History</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          <TabsTrigger value="notes">Notes & Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Booking History</CardTitle>
              <CardDescription>All bookings made by this customer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.serviceName}</TableCell>
                        <TableCell>{booking.partnerName}</TableCell>
                        <TableCell>{formatDate(booking.date)}</TableCell>
                        <TableCell>{formatCurrency(booking.amount)}</TableCell>
                        <TableCell>{getBookingStatusBadge(booking.status)}</TableCell>
                        <TableCell>
                          {booking.rating ? (
                            <div className="flex items-center gap-1">
                              <span>{booking.rating}</span>
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Communication History</CardTitle>
              <CardDescription>SMS, Email, and Push notifications sent to this customer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Communication history will be implemented</p>
                <p className="text-sm">with messaging system integration</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
                <CardDescription>Add notes about this customer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Add notes about this customer..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
                <Button>Save Notes</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Perform actions on this customer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Customer Details
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Gift className="mr-2 h-4 w-4" />
                  Send Coupon
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send Message
                </Button>
                <Button variant="destructive" className="w-full justify-start">
                  <Ban className="mr-2 h-4 w-4" />
                  Block Customer
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
