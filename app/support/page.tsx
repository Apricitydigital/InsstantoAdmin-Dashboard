"use client"

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { AdminSidebar } from "@/components/admin-sidebar"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react"

import {
  getPartnerReviews,
  getSupportTickets,
  hydrateSupportTicketCustomerNames,
  updateTicketStatus,
  type Review,
} from "@/lib/queries/support"

import type { SupportTicket } from "@/types/support"
import { PROVIDER_ID_LIST } from "@/lib/queries/partners"
import { useAuth } from "@/lib/auth"

// ============================================================
// CONSTANTS
// ============================================================

const TICKETS_PER_PAGE = 8
const REVIEWS_PER_PAGE = 8

const PRIORITY_CLASS: Record<string, string> = {
  urgent:
    "border-red-200 bg-red-100 text-red-800",
  high:
    "border-orange-200 bg-orange-100 text-orange-800",
  medium:
    "border-yellow-200 bg-yellow-100 text-yellow-800",
  low:
    "border-green-200 bg-green-100 text-green-800",
}

const STATUS_CLASS: Record<string, string> = {
  open:
    "border-blue-200 bg-blue-100 text-blue-800",
  in_progress:
    "border-yellow-200 bg-yellow-100 text-yellow-800",
  resolved:
    "border-green-200 bg-green-100 text-green-800",
  closed:
    "border-gray-200 bg-gray-100 text-gray-800",
}

const FALLBACK_BADGE_CLASS =
  "border-gray-200 bg-gray-100 text-gray-800"

// ============================================================
// TYPES
// ============================================================

type TicketWithSearch = SupportTicket & {
  searchText: string
}

type TicketStats = {
  total: number
  open: number
  inProgress: number
  resolved: number
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(
  value?: string | Date
): string {
  if (!value) {
    return "-"
  }

  const parsedDate = new Date(value)

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "-"
  }

  return parsedDate.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  )
}

function formatDateTime(
  value?: string | Date
): string {
  if (!value) {
    return "-"
  }

  const parsedDate = new Date(value)

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "-"
  }

  return parsedDate.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  )
}

function getDateValue(
  value?: string
): number {
  if (!value) {
    return 0
  }

  const dateValue =
    new Date(value).getTime()

  return Number.isNaN(dateValue)
    ? 0
    : dateValue
}

function getStatusLabel(
  status: string
): string {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    )
}

// ============================================================
// COMPONENT
// ============================================================

export default function SupportPage() {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission("complaints:write")
  // ----------------------------------------------------------
  // FILTER STATES
  // ----------------------------------------------------------

  const [searchTerm, setSearchTerm] =
    useState("")

  const deferredSearchTerm =
    useDeferredValue(searchTerm)

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all")

  const [fromDate, setFromDate] =
    useState("")

  const [toDate, setToDate] =
    useState("")

  const [activeTab, setActiveTab] =
    useState("tickets")

  // ----------------------------------------------------------
  // DATA STATES
  // ----------------------------------------------------------

  const [tickets, setTickets] =
    useState<SupportTicket[]>([])

  const [reviews, setReviews] =
    useState<Review[]>([])

  // ----------------------------------------------------------
  // LOADING STATES
  // ----------------------------------------------------------

  const [
    ticketsLoading,
    setTicketsLoading,
  ] = useState(true)

  const [
    customerNamesLoading,
    setCustomerNamesLoading,
  ] = useState(false)

  const [
    reviewsLoading,
    setReviewsLoading,
  ] = useState(false)

  const [
    reviewsLoaded,
    setReviewsLoaded,
  ] = useState(false)

  // ----------------------------------------------------------
  // MODAL STATES
  // ----------------------------------------------------------

  const [
    selectedTicket,
    setSelectedTicket,
  ] =
    useState<SupportTicket | null>(
      null
    )

  const [
    resolutionTicket,
    setResolutionTicket,
  ] = useState<SupportTicket | null>(
    null
  )

  const [
    completionNote,
    setCompletionNote,
  ] = useState("")

  const [
    updatingTicket,
    setUpdatingTicket,
  ] = useState(false)

  // ----------------------------------------------------------
  // PAGINATION STATES
  // ----------------------------------------------------------

  const [
    currentPageTickets,
    setCurrentPageTickets,
  ] = useState(1)

  const [
    currentPageReviews,
    setCurrentPageReviews,
  ] = useState(1)

  // ----------------------------------------------------------
  // REQUEST CONTROL
  // ----------------------------------------------------------

  /*
    Prevent a slower, older request from replacing the result of a
    newer refresh request.
  */
  const ticketsRequestId =
    useRef(0)

  const reviewsRequestId =
    useRef(0)

  const mountedRef =
    useRef(true)

  // ==========================================================
  // LOAD SUPPORT TICKETS
  // ==========================================================

  const loadTickets =
    useCallback(async () => {
      const requestId =
        ++ticketsRequestId.current

      setTicketsLoading(true)

      try {
        /*
          This first request only loads the complaint documents.

          Statistics and table rows are displayed immediately without
          waiting for individual customer document requests.
        */
        const ticketData =
          await getSupportTickets()

        if (
          !mountedRef.current ||
          requestId !==
            ticketsRequestId.current
        ) {
          return
        }

        setTickets(ticketData)
        setTicketsLoading(false)

        /*
          Customer names are loaded afterward.

          The user can already see the stats and tickets while these names
          are being enriched in the background.
        */
        if (
          ticketData.length > 0
        ) {
          setCustomerNamesLoading(
            true
          )

          try {
            const hydratedTickets =
              await hydrateSupportTicketCustomerNames(
                ticketData
              )

            if (
              mountedRef.current &&
              requestId ===
                ticketsRequestId.current
            ) {
              setTickets(
                hydratedTickets
              )
            }
          } catch (error) {
            console.error(
              "Error loading customer names:",
              error
            )
          } finally {
            if (
              mountedRef.current &&
              requestId ===
                ticketsRequestId.current
            ) {
              setCustomerNamesLoading(
                false
              )
            }
          }
        }
      } catch (error) {
        console.error(
          "Error loading support tickets:",
          error
        )

        if (
          mountedRef.current &&
          requestId ===
            ticketsRequestId.current
        ) {
          setTickets([])
        }
      } finally {
        if (
          mountedRef.current &&
          requestId ===
            ticketsRequestId.current
        ) {
          setTicketsLoading(false)
        }
      }
    }, [])

  // ==========================================================
  // LOAD REVIEWS
  // ==========================================================

  const loadReviews =
    useCallback(
      async (
        forceRefresh = false
      ) => {
        if (
          reviewsLoading ||
          (
            reviewsLoaded &&
            !forceRefresh
          )
        ) {
          return
        }

        const requestId =
          ++reviewsRequestId.current

        setReviewsLoading(true)

        try {
          const reviewData =
            await getPartnerReviews(
              PROVIDER_ID_LIST
            )

          if (
            !mountedRef.current ||
            requestId !==
              reviewsRequestId.current
          ) {
            return
          }

          /*
            The support query already sorts reviews, but this client-side
            sort guarantees descending date order even if older records
            use a different Firestore date field.
          */
          const sortedReviews = [
            ...reviewData,
          ].sort(
            (
              firstReview,
              secondReview
            ) =>
              getDateValue(
                secondReview.createdAt
              ) -
              getDateValue(
                firstReview.createdAt
              )
          )

          setReviews(
            sortedReviews
          )

          setReviewsLoaded(true)
        } catch (error) {
          console.error(
            "Error loading reviews:",
            error
          )

          if (
            mountedRef.current &&
            requestId ===
              reviewsRequestId.current
          ) {
            setReviews([])
          }
        } finally {
          if (
            mountedRef.current &&
            requestId ===
              reviewsRequestId.current
          ) {
            setReviewsLoading(
              false
            )
          }
        }
      },
      [
        reviewsLoaded,
        reviewsLoading,
      ]
    )

  // ==========================================================
  // INITIAL DATA LOADING
  // ==========================================================

  useEffect(() => {
    mountedRef.current = true

    void loadTickets()

    return () => {
      mountedRef.current = false
    }
  }, [loadTickets])

  /*
    Prefetch reviews shortly after the ticket table becomes visible.

    This keeps the first screen fast while making the reviews tab load
    quickly when the user opens it.
  */
  useEffect(() => {
    if (
      ticketsLoading ||
      reviewsLoaded ||
      reviewsLoading
    ) {
      return
    }

    const timeoutId =
      window.setTimeout(() => {
        void loadReviews()
      }, 400)

    return () => {
      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    ticketsLoading,
    reviewsLoaded,
    reviewsLoading,
    loadReviews,
  ])

  // ==========================================================
  // SEARCHABLE TICKETS
  // ==========================================================

  const ticketsWithSearchText =
    useMemo<
      TicketWithSearch[]
    >(() => {
      return tickets.map(
        (ticket) => ({
          ...ticket,

          searchText: [
            ticket.id,
            ticket.subject,
            ticket.customerName,
            ticket.contact_no,
            ticket.type,
            ticket.priority,
            ticket.status,
            ticket.bookingId,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        })
      )
    }, [tickets])

  // ==========================================================
  // FILTERED TICKETS
  // ==========================================================

  const filteredTickets =
    useMemo(() => {
      const normalizedTerm =
        deferredSearchTerm
          .trim()
          .toLowerCase()

      if (
        !normalizedTerm &&
        statusFilter === "all" &&
        !fromDate &&
        !toDate
      ) {
        return ticketsWithSearchText
      }

      return ticketsWithSearchText.filter(
        (ticket) => {
          const matchesSearch =
            !normalizedTerm ||
            ticket.searchText.includes(
              normalizedTerm
            )

          const matchesStatus =
            statusFilter === "all" ||
            ticket.status ===
              statusFilter

          const createdAt =
            getDateValue(ticket.createdAt)

          const fromTime = fromDate
            ? new Date(
                `${fromDate}T00:00:00`
              ).getTime()
            : 0

          const toTime = toDate
            ? new Date(
                `${toDate}T23:59:59.999`
              ).getTime()
            : Number.POSITIVE_INFINITY

          const matchesDateRange =
            createdAt >= fromTime &&
            createdAt <= toTime

          return (
            matchesSearch &&
            matchesStatus &&
            matchesDateRange
          )
        }
      )
    }, [
      ticketsWithSearchText,
      deferredSearchTerm,
      statusFilter,
      fromDate,
      toDate,
    ])

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPagesTickets =
    Math.max(
      1,
      Math.ceil(
        filteredTickets.length /
          TICKETS_PER_PAGE
      )
    )

  const paginatedTickets =
    useMemo(() => {
      const startIndex =
        (
          currentPageTickets - 1
        ) * TICKETS_PER_PAGE

      return filteredTickets.slice(
        startIndex,
        startIndex +
          TICKETS_PER_PAGE
      )
    }, [
      filteredTickets,
      currentPageTickets,
    ])

  const sortedReviews =
    useMemo(() => {
      return [...reviews].sort(
        (
          firstReview,
          secondReview
        ) =>
          getDateValue(
            secondReview.createdAt
          ) -
          getDateValue(
            firstReview.createdAt
          )
      )
    }, [reviews])

  const totalPagesReviews =
    Math.max(
      1,
      Math.ceil(
        sortedReviews.length /
          REVIEWS_PER_PAGE
      )
    )

  const paginatedReviews =
    useMemo(() => {
      const startIndex =
        (
          currentPageReviews - 1
        ) * REVIEWS_PER_PAGE

      return sortedReviews.slice(
        startIndex,
        startIndex +
          REVIEWS_PER_PAGE
      )
    }, [
      sortedReviews,
      currentPageReviews,
    ])

  // ==========================================================
  // TICKET STATS
  // ==========================================================

  const ticketStats =
    useMemo<TicketStats>(
      () => {
        return tickets.reduce<TicketStats>(
          (
            statistics,
            ticket
          ) => {
            statistics.total += 1

            switch (
              ticket.status
            ) {
              case "open":
                statistics.open += 1
                break

              case "in_progress":
                statistics.inProgress +=
                  1
                break

              case "resolved":
                statistics.resolved +=
                  1
                break
            }

            return statistics
          },
          {
            total: 0,
            open: 0,
            inProgress: 0,
            resolved: 0,
          }
        )
      },
      [tickets]
    )

  // ==========================================================
  // PAGE CORRECTION
  // ==========================================================

  useEffect(() => {
    if (
      currentPageTickets >
      totalPagesTickets
    ) {
      setCurrentPageTickets(
        totalPagesTickets
      )
    }
  }, [
    currentPageTickets,
    totalPagesTickets,
  ])

  useEffect(() => {
    if (
      currentPageReviews >
      totalPagesReviews
    ) {
      setCurrentPageReviews(
        totalPagesReviews
      )
    }
  }, [
    currentPageReviews,
    totalPagesReviews,
  ])

  // ==========================================================
  // COMPLETE COMPLAINT
  // ==========================================================

  const handleCompleteComplaint =
    useCallback(async () => {
      if (!canEdit || !selectedTicket) {
        return
      }

      setUpdatingTicket(true)

      try {
        const success =
          await updateTicketStatus(
            selectedTicket.id,
            "resolved",
            completionNote
          )

        if (!success) {
          return
        }

        const resolvedAt =
          new Date().toISOString()

        /*
          Update the ticket locally rather than downloading all complaint
          documents again.
        */
        setTickets(
          (
            previousTickets
          ) =>
            previousTickets.map(
              (ticket) =>
                ticket.id ===
                selectedTicket.id
                  ? {
                      ...ticket,
                      status:
                        "resolved",
                      updatedAt:
                        resolvedAt,
                      resolvedAt,
                      note:
                        completionNote.trim() ||
                        ticket.note,
                      resolutionNote:
                        completionNote.trim() ||
                        undefined,
                    }
                  : ticket
            )
        )

        setSelectedTicket(null)
        setCompletionNote("")
      } catch (error) {
        console.error(
          "Error completing complaint:",
          error
        )
      } finally {
        setUpdatingTicket(false)
      }
    }, [
      canEdit,
      completionNote,
      selectedTicket,
    ])

  // ==========================================================
  // RESET FILTERS
  // ==========================================================

  const clearTicketFilters =
    useCallback(() => {
      setSearchTerm("")
      setStatusFilter("all")
      setFromDate("")
      setToDate("")
      setCurrentPageTickets(1)
    }, [])

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    statusFilter !== "all" ||
    Boolean(fromDate) ||
    Boolean(toDate)

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
          {/* ==================================================
              PAGE HEADER
          ================================================== */}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Complaints & Support
              </h1>

              <p className="mt-1 text-sm text-gray-600 sm:text-base">
                Manage customer complaints,
                queries and reviews
              </p>
            </div>

            <div className="flex items-center gap-3">
              {customerNamesLoading && (
                <div className="hidden items-center gap-2 text-sm text-gray-500 sm:flex">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating customer
                  names
                </div>
              )}

              <Button
                variant="outline"
                disabled={
                  ticketsLoading
                }
                onClick={() =>
                  void loadTickets()
                }
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    ticketsLoading
                      ? "animate-spin"
                      : ""
                  }`}
                />

                {ticketsLoading
                  ? "Refreshing..."
                  : "Refresh"}
              </Button>
            </div>
          </div>

          {/* ==================================================
              STAT CARDS
          ================================================== */}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <MessageSquare className="h-6 w-6 text-blue-600" />
                  </div>

                  <Badge
                    variant="secondary"
                    className="bg-white"
                  >
                    {ticketStats.total}
                  </Badge>
                </div>

                <CardTitle className="mt-3 text-3xl font-bold text-blue-900">
                  {ticketsLoading &&
                  tickets.length === 0
                    ? "-"
                    : ticketStats.total}
                </CardTitle>

                <CardDescription className="text-blue-700">
                  Total Tickets
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>

                  <Badge
                    variant="secondary"
                    className="bg-white"
                  >
                    {ticketStats.open}
                  </Badge>
                </div>

                <CardTitle className="mt-3 text-3xl font-bold text-red-900">
                  {ticketsLoading &&
                  tickets.length === 0
                    ? "-"
                    : ticketStats.open}
                </CardTitle>

                <CardDescription className="text-red-700">
                  Open Tickets
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>

                  <Badge
                    variant="secondary"
                    className="bg-white"
                  >
                    {
                      ticketStats.inProgress
                    }
                  </Badge>
                </div>

                <CardTitle className="mt-3 text-3xl font-bold text-yellow-900">
                  {ticketsLoading &&
                  tickets.length === 0
                    ? "-"
                    : ticketStats.inProgress}
                </CardTitle>

                <CardDescription className="text-yellow-700">
                  In Progress
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>

                  <Badge
                    variant="secondary"
                    className="bg-white"
                  >
                    {
                      ticketStats.resolved
                    }
                  </Badge>
                </div>

                <CardTitle className="mt-3 text-3xl font-bold text-green-900">
                  {ticketsLoading &&
                  tickets.length === 0
                    ? "-"
                    : ticketStats.resolved}
                </CardTitle>

                <CardDescription className="text-green-700">
                  Resolved Tickets
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* ==================================================
              TABS
          ================================================== */}

          <Tabs
            value={activeTab}
            onValueChange={(
              value
            ) => {
              setActiveTab(value)

              if (
                value === "reviews"
              ) {
                void loadReviews()
              }
            }}
            className="space-y-5"
          >
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-gray-100 p-1">
              <TabsTrigger
                value="tickets"
                className="rounded-lg py-2.5"
              >
                Support Tickets
              </TabsTrigger>

              <TabsTrigger
                value="reviews"
                className="rounded-lg py-2.5"
              >
                Reviews Management
              </TabsTrigger>
            </TabsList>

            {/* ================================================
                SUPPORT TICKETS TAB
            ================================================ */}

            <TabsContent
              value="tickets"
              className="space-y-4"
            >
              <Card className="overflow-hidden">
                <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                    <Input
                      placeholder="Search by customer, subject, contact, ticket ID..."
                      value={searchTerm}
                      onChange={(
                        event
                      ) => {
                        setSearchTerm(
                          event.target
                            .value
                        )

                        setCurrentPageTickets(
                          1
                        )
                      }}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="text-xs font-medium text-gray-600">
                      From
                      <Input
                        type="date"
                        value={fromDate}
                        max={toDate || undefined}
                        onChange={(event) => {
                          setFromDate(event.target.value)
                          setCurrentPageTickets(1)
                        }}
                        className="mt-1 w-full sm:w-40"
                        aria-label="Complaint date from"
                      />
                    </label>

                    <label className="text-xs font-medium text-gray-600">
                      To
                      <Input
                        type="date"
                        value={toDate}
                        min={fromDate || undefined}
                        onChange={(event) => {
                          setToDate(event.target.value)
                          setCurrentPageTickets(1)
                        }}
                        className="mt-1 w-full sm:w-40"
                        aria-label="Complaint date to"
                      />
                    </label>

                    <Select
                      value={
                        statusFilter
                      }
                      onValueChange={(
                        value
                      ) => {
                        setStatusFilter(
                          value
                        )

                        setCurrentPageTickets(
                          1
                        )
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="all">
                          All Status
                        </SelectItem>

                        <SelectItem value="open">
                          Open
                        </SelectItem>

                        <SelectItem value="in_progress">
                          In Progress
                        </SelectItem>

                        <SelectItem value="resolved">
                          Resolved
                        </SelectItem>

                        <SelectItem value="closed">
                          Closed
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {hasActiveFilters && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={
                          clearTicketFilters
                        }
                      >
                        <X className="mr-1 h-4 w-4" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">
                          Ticket ID
                        </TableHead>

                        <TableHead>
                          Customer
                        </TableHead>

                        <TableHead>
                          Subject
                        </TableHead>

                        <TableHead>
                          Type
                        </TableHead>

                        <TableHead>
                          Priority
                        </TableHead>

                        <TableHead>
                          Status
                        </TableHead>

                        <TableHead className="whitespace-nowrap">
                          Created
                        </TableHead>

                        <TableHead className="text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {ticketsLoading &&
                      tickets.length ===
                        0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="h-40 text-center"
                          >
                            <div className="flex items-center justify-center gap-2 text-gray-500">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              Loading
                              tickets...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : paginatedTickets.length ===
                        0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="h-40 text-center text-gray-500"
                          >
                            No tickets
                            found
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTickets.map(
                          (
                            ticket
                          ) => (
                            <TableRow
                              key={
                                ticket.id
                              }
                            >
                              <TableCell className="whitespace-nowrap font-mono text-xs">
                                #
                                {ticket.id.substring(
                                  0,
                                  8
                                )}
                              </TableCell>

                              <TableCell className="min-w-[180px]">
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900">
                                    {
                                      ticket.customerName
                                    }
                                  </span>

                                  <span className="text-xs text-gray-500">
                                    {ticket.contact_no ||
                                      "No contact"}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="min-w-[320px] max-w-lg align-top">
                                <div
                                  className="whitespace-normal break-words leading-relaxed"
                                  title={
                                    ticket.subject
                                  }
                                >
                                  {
                                    ticket.subject
                                  }
                                </div>
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="capitalize"
                                >
                                  {
                                    ticket.type
                                  }
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <Badge
                                  className={
                                    PRIORITY_CLASS[
                                      ticket
                                        .priority
                                    ] ??
                                    FALLBACK_BADGE_CLASS
                                  }
                                >
                                  {
                                    ticket.priority
                                  }
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <Badge
                                  className={
                                    STATUS_CLASS[
                                      ticket
                                        .status
                                    ] ??
                                    FALLBACK_BADGE_CLASS
                                  }
                                >
                                  {getStatusLabel(
                                    ticket.status
                                  )}
                                </Badge>
                              </TableCell>

                              <TableCell className="whitespace-nowrap">
                                {formatDate(
                                  ticket.createdAt
                                )}
                              </TableCell>

                              <TableCell className="text-right">
                                {ticket.status !== "resolved" ? (
                                  canEdit ? (
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() =>
                                      setSelectedTicket(
                                        ticket
                                      )
                                    }
                                  >
                                    Complete
                                  </Button>
                                  ) : (
                                    <span className="text-sm text-gray-400">View only</span>
                                  )
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setResolutionTicket(ticket)
                                    }
                                    className="border-green-200 text-green-700 hover:bg-green-50"
                                  >
                                    View Resolution
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-gray-600">
                    Showing{" "}
                    {filteredTickets.length ===
                    0
                      ? 0
                      : (
                          currentPageTickets -
                          1
                        ) *
                          TICKETS_PER_PAGE +
                        1}{" "}
                    to{" "}
                    {Math.min(
                      currentPageTickets *
                        TICKETS_PER_PAGE,
                      filteredTickets.length
                    )}{" "}
                    of{" "}
                    {
                      filteredTickets.length
                    }{" "}
                    tickets
                  </span>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        currentPageTickets ===
                        1
                      }
                      onClick={() =>
                        setCurrentPageTickets(
                          (page) =>
                            Math.max(
                              1,
                              page - 1
                            )
                        )
                      }
                    >
                      Previous
                    </Button>

                    <span className="whitespace-nowrap text-sm text-gray-600">
                      Page{" "}
                      {
                        currentPageTickets
                      }{" "}
                      of{" "}
                      {
                        totalPagesTickets
                      }
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        currentPageTickets ===
                        totalPagesTickets
                      }
                      onClick={() =>
                        setCurrentPageTickets(
                          (page) =>
                            Math.min(
                              totalPagesTickets,
                              page + 1
                            )
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* ================================================
                REVIEWS TAB
            ================================================ */}

            <TabsContent
              value="reviews"
              className="space-y-4"
            >
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>
                      Customer Reviews
                    </CardTitle>

                    <CardDescription className="mt-1">
                      Reviews are
                      arranged from newest
                      to oldest
                    </CardDescription>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      reviewsLoading
                    }
                    onClick={() =>
                      void loadReviews(
                        true
                      )
                    }
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${
                        reviewsLoading
                          ? "animate-spin"
                          : ""
                      }`}
                    />

                    {reviewsLoading
                      ? "Refreshing..."
                      : "Refresh Reviews"}
                  </Button>
                </CardHeader>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">
                          Date
                        </TableHead>

                        <TableHead>
                          Customer
                        </TableHead>

                        <TableHead>
                          Partner
                        </TableHead>

                        <TableHead>
                          Rating
                        </TableHead>

                        <TableHead>
                          Feedback
                        </TableHead>

                        <TableHead className="text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {reviewsLoading &&
                      reviews.length ===
                        0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="h-40 text-center"
                          >
                            <div className="flex items-center justify-center gap-2 text-gray-500">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              Loading
                              reviews...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : paginatedReviews.length ===
                        0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="h-40 text-center text-gray-500"
                          >
                            No reviews
                            found
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedReviews.map(
                          (
                            review
                          ) => (
                            <TableRow
                              key={
                                review.id
                              }
                            >
                              <TableCell className="min-w-[160px] whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {formatDate(
                                      review.createdAt
                                    )}
                                  </span>

                                  <span className="text-xs text-gray-500">
                                    {formatDateTime(
                                      review.createdAt
                                    )}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="min-w-[160px] font-medium">
                                {
                                  review.customerName
                                }
                              </TableCell>

                              <TableCell className="min-w-[160px]">
                                {
                                  review.partnerName
                                }
                              </TableCell>

                              <TableCell>
                                <Badge className="border-yellow-200 bg-yellow-100 text-yellow-800">
                                  <Star className="mr-1 h-3.5 w-3.5 fill-current" />

                                  {
                                    review.partnerRating
                                  }
                                </Badge>
                              </TableCell>

                              <TableCell className="min-w-[250px]">
                                <div
                                  className="max-w-md whitespace-normal break-words text-sm text-gray-700"
                                  title={
                                    review.feedback ||
                                    "-"
                                  }
                                >
                                  {review.feedback ||
                                    "-"}
                                </div>
                              </TableCell>

                              <TableCell className="text-right">
                                {canEdit && (
                                  <Button variant="outline" size="sm">
                                    Moderate
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-gray-600">
                    Showing{" "}
                    {sortedReviews.length ===
                    0
                      ? 0
                      : (
                          currentPageReviews -
                          1
                        ) *
                          REVIEWS_PER_PAGE +
                        1}{" "}
                    to{" "}
                    {Math.min(
                      currentPageReviews *
                        REVIEWS_PER_PAGE,
                      sortedReviews.length
                    )}{" "}
                    of{" "}
                    {
                      sortedReviews.length
                    }{" "}
                    reviews
                  </span>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        currentPageReviews ===
                        1
                      }
                      onClick={() =>
                        setCurrentPageReviews(
                          (page) =>
                            Math.max(
                              1,
                              page - 1
                            )
                        )
                      }
                    >
                      Previous
                    </Button>

                    <span className="whitespace-nowrap text-sm text-gray-600">
                      Page{" "}
                      {
                        currentPageReviews
                      }{" "}
                      of{" "}
                      {
                        totalPagesReviews
                      }
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        currentPageReviews ===
                        totalPagesReviews
                      }
                      onClick={() =>
                        setCurrentPageReviews(
                          (page) =>
                            Math.min(
                              totalPagesReviews,
                              page + 1
                            )
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* ====================================================
          COMPLETE COMPLAINT MODAL
      ==================================================== */}

      {canEdit && selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !updatingTicket
            ) {
              setSelectedTicket(
                null
              )

              setCompletionNote("")
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Complete Complaint
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  Add a customer care
                  note before marking
                  this complaint as
                  resolved.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={
                  updatingTicket
                }
                onClick={() => {
                  setSelectedTicket(
                    null
                  )

                  setCompletionNote(
                    ""
                  )
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-4 rounded-xl border bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Complaint
              </p>

              <p className="mt-1 text-sm font-medium text-gray-900">
                {
                  selectedTicket.subject
                }
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Customer:{" "}
                {
                  selectedTicket.customerName
                }
              </p>
            </div>

            <textarea
              value={completionNote}
              onChange={(
                event
              ) =>
                setCompletionNote(
                  event.target.value
                )
              }
              placeholder="Write customer care note..."
              className="mt-4 min-h-32 w-full resize-y rounded-xl border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={
                  updatingTicket
                }
                onClick={() => {
                  setSelectedTicket(
                    null
                  )

                  setCompletionNote(
                    ""
                  )
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={
                  updatingTicket
                }
                onClick={() =>
                  void handleCompleteComplaint()
                }
                className="bg-green-600 hover:bg-green-700"
              >
                {updatingTicket && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}

                {updatingTicket
                  ? "Completing..."
                  : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {resolutionTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setResolutionTicket(null)
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Complaint Resolution
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Resolution marked by the admin
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setResolutionTicket(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-4 rounded-xl border bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">
                {resolutionTicket.subject}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {resolutionTicket.resolutionNote ||
                  "No resolution note was added."}
              </p>
              {resolutionTicket.resolvedAt && (
                <p className="mt-4 text-xs text-gray-500">
                  Resolved {formatDateTime(resolutionTicket.resolvedAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
