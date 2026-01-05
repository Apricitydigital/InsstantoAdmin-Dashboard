"use client"

import { useState, useEffect } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, MessageSquare, AlertTriangle, Clock, CheckCircle, Loader2, Star } from "lucide-react"

import { getSupportTickets, getPartnerReviews } from "@/lib/queries/support"
import type { SupportTicket } from "@/types/support"

// partnerIds used everywhere
const partnerIds = [
  "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
  "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
  "VxxapfO7l8YM5f6xmFqpThc17eD3"
]

export default function SupportPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // pagination for tickets
  const [currentPageTickets, setCurrentPageTickets] = useState(1)
  const ticketsPerPage = 8

  // pagination for reviews
  const [currentPageReviews, setCurrentPageReviews] = useState(1)
  const reviewsPerPage = 8

  useEffect(() => {
    loadTickets()
    loadReviews()
  }, [])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const data = await getSupportTickets()
      setTickets(data)
    } catch (error) {
      console.error("Error loading tickets:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadReviews = async () => {
    try {
      const data = await getPartnerReviews(partnerIds)
      setReviews(data)
    } catch (error) {
      console.error("Error loading reviews:", error)
    }
  }

  // Filter tickets
  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Paginate tickets
  const totalPagesTickets = Math.ceil(filteredTickets.length / ticketsPerPage)
  const paginatedTickets = filteredTickets.slice(
    (currentPageTickets - 1) * ticketsPerPage,
    currentPageTickets * ticketsPerPage
  )

  // Paginate reviews
  const totalPagesReviews = Math.ceil(reviews.length / reviewsPerPage)
  const paginatedReviews = reviews.slice(
    (currentPageReviews - 1) * reviewsPerPage,
    currentPageReviews * reviewsPerPage
  )

  const ticketStats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "resolved":
        return "bg-green-100 text-green-800 border-green-200"
      case "closed":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading support tickets...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Complaints & Support</h1>
            <p className="text-gray-600">Manage customer complaints, queries, and reviews</p>
          </div>
          <Button onClick={loadTickets} variant="outline">
            Refresh
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <MessageSquare className="w-8 h-8 text-blue-600" />
                <Badge variant="secondary">{ticketStats.total}</Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-blue-900">{ticketStats.total}</CardTitle>
              <CardDescription className="text-blue-700">Total Tickets</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <Badge variant="secondary">{ticketStats.open}</Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-red-900">{ticketStats.open}</CardTitle>
              <CardDescription className="text-red-700">Open Tickets</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Clock className="w-8 h-8 text-yellow-600" />
                <Badge variant="secondary">{ticketStats.inProgress}</Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-yellow-900">{ticketStats.inProgress}</CardTitle>
              <CardDescription className="text-yellow-700">In Progress</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <Badge variant="secondary">{ticketStats.resolved}</Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-green-900">{ticketStats.resolved}</CardTitle>
              <CardDescription className="text-green-700">Resolved</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="tickets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
            <TabsTrigger value="reviews">Reviews Management</TabsTrigger>
          </TabsList>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPageTickets(1)
                  }}
                  className="pl-10"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val)
                  setCurrentPageTickets(1)
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No tickets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono">#{ticket.id.substring(0, 8)}</TableCell>
                        <TableCell className="font-medium">{ticket.customerName}</TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate">{ticket.subject}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {ticket.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(ticket.status)}>{ticket.status.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                          <div className="max-w-xs truncate">{ticket.note}</div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Ticket Pagination */}
              {totalPagesTickets > 1 && (
                <div className="flex justify-between items-center px-4 py-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPageTickets === 1}
                    onClick={() => setCurrentPageTickets((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPageTickets} of {totalPagesTickets}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPageTickets === totalPagesTickets}
                    onClick={() => setCurrentPageTickets((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer Reviews</CardTitle>
                <CardDescription>Manage and moderate reviews for selected partners</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Feedback</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedReviews.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No reviews found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedReviews.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell>{new Date(review.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>{review.customerName}</TableCell>
                          <TableCell>{review.partnerName}</TableCell>
                          <TableCell>
                            <Badge className="bg-yellow-100 text-yellow-800">
                              {review.partnerRating} ★
                            </Badge>
                          </TableCell>
                          <TableCell>{review.feedback || "—"}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">Moderate</Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPagesReviews > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPageReviews === 1}
                      onClick={() => setCurrentPageReviews((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPageReviews} of {totalPagesReviews}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPageReviews === totalPagesReviews}
                      onClick={() => setCurrentPageReviews((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}
