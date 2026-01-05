"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import {
  Calendar,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TimeslotData = {
  date?: Timestamp
  timelist?: string[]
  status?: string[]
}

type AttendanceDoc = {
  id: string
  providerId?: any
  partnerid?: any
  startTime?: Timestamp
  tmeslot?: TimeslotData
  status?: string
}

interface PartnerAvailabilitySectionProps {
  partnerId: string
}

const PAGE_SIZE = 10

export function PartnerAvailabilitySection({ partnerId }: PartnerAvailabilitySectionProps) {
  const db = getFirestoreDb()
  const [attendance, setAttendance] = useState<AttendanceDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [debugInfo, setDebugInfo] = useState("")
  const [showAbsentDates, setShowAbsentDates] = useState(false)

  // Slot dialog states
  const [selectedSlots, setSelectedSlots] = useState<{ time: string; status: string }[]>([])
  const [slotDialogOpen, setSlotDialogOpen] = useState(false)

  // KPI Summary
  const [summary, setSummary] = useState<{
    present: number
    absent: number
    total: number
    absentDates: string[]
    from?: Date
    to?: Date
  }>({
    present: 0,
    absent: 0,
    total: 0,
    absentDates: [],
  })

  // ✅ Fetch partner attendance
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!partnerId) return

      try {
        setLoading(true)
        const partnerRef = doc(db, "customer", partnerId)
        let found: AttendanceDoc[] = []

        // Fetch Present attendance records
        const queryPresent = query(
          collection(db, "partner_attendence"),
          where("partnerid", "==", partnerRef),
          where("status", "==", "Present")
        )
        const snapshot = await getDocs(queryPresent)
        found = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as AttendanceDoc[]

        // Sort ascending by date
        found.sort((a, b) => {
          const dateA = a.startTime?.toDate?.() || new Date(0)
          const dateB = b.startTime?.toDate?.() || new Date(0)
          return dateA.getTime() - dateB.getTime()
        })

        setAttendance(found)
        setDebugInfo(`Found ${found.length} Present records for partner ${partnerId}`)

// ✅ Calculate summary
if (found.length > 0) {
  const firstPresentDate = found[0].startTime?.toDate?.()
  const lastPresentDate = found[found.length - 1].startTime?.toDate?.()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Always start from 1st of current month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const rangeStart = startOfMonth
  const rangeEnd =
    lastPresentDate && lastPresentDate < today ? lastPresentDate : today

  // Generate all dates from 1st of month till today
  const allDates: string[] = []
  const current = new Date(rangeStart)
  while (current <= rangeEnd) {
    allDates.push(current.toDateString())
    current.setDate(current.getDate() + 1)
  }

  // Get present dates
  const presentDates = found
    .map(a => a.startTime?.toDate?.()?.toDateString())
    .filter(Boolean) as string[]

  // Absent = all days except present ones
  const absentDates = allDates.filter(d => !presentDates.includes(d))

  setSummary({
    present: presentDates.length,
    absent: absentDates.length,
    total: allDates.length,
    absentDates,
    from: rangeStart,
    to: rangeEnd,
  })
}

        
      } catch (err) {
        console.error("Failed to load partner attendance:", err)
        setDebugInfo(`Error: ${err}`)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [partnerId, db])

  // ✅ Formatters
  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp?.toDate) return "—"
    return timestamp.toDate().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  // ✅ Handle View Slots
  const handleViewSlots = (record: AttendanceDoc) => {
    const timelist = record?.tmeslot?.timelist || []
    const statusList = record?.tmeslot?.status || []
    const combined = timelist.map((time, i) => ({
      time,
      status: statusList[i] || "Available",
    }))
    setSelectedSlots(combined)
    setSlotDialogOpen(true)
  }

  // ✅ Filter + Pagination
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return attendance.filter(record => {
      if (!term) return true
      const startDate = record.startTime ? formatDate(record.startTime).toLowerCase() : ""
      const id = record.id.toLowerCase()
      return startDate.includes(term) || id.includes(term)
    })
  }, [attendance, searchTerm])

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filtered.slice(start, end)
  }, [filtered, currentPage])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading partner attendance...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ✅ KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm border">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Total Days</p>
            <p className="text-2xl font-bold text-blue-600">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Present Days</p>
            <p className="text-2xl font-bold text-green-600">{summary.present}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Absent Days</p>
            <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ Attendance Period + Collapsible Absent Dates */}
      {summary.from && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div>
              <CardTitle className="text-base font-semibold text-gray-800">
                Attendance Period
              </CardTitle>
              <p className="text-sm text-gray-500">
                {summary.from.toLocaleDateString("en-IN")} →{" "}
                {summary.to?.toLocaleDateString("en-IN")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 sm:mt-0 flex items-center gap-2"
              onClick={() => setShowAbsentDates(!showAbsentDates)}
            >
              {showAbsentDates ? (
                <>
                  <ChevronUp className="w-4 h-4" /> Hide Absent Dates
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" /> View Absent Dates
                </>
              )}
            </Button>
          </CardHeader>

          {showAbsentDates && (
            <CardContent className="border-t pt-3 max-h-[250px] overflow-y-auto">
              {summary.absentDates.length > 0 ? (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-gray-700">
                  {summary.absentDates.map((date, idx) => (
                    <li
                      key={idx}
                      className="p-2 border rounded-md bg-red-50 text-red-700 text-center"
                    >
                      {new Date(date).toLocaleDateString("en-IN")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-500 text-sm">No absent days found.</p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ✅ Attendance Records Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Partner Attendance ({filtered.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by date or ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">
                {attendance.length === 0
                  ? "No attendance records found for this partner."
                  : "No records match your search criteria."}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Slots</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map(record => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-xs">{record.id}</TableCell>
                        <TableCell>{formatDate(record.startTime)}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">Present</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-1"
                            onClick={() => handleViewSlots(record)}
                          >
                            <Eye className="w-4 h-4" />
                            View Slots
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages || 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p - 1)}
                    disabled={!hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={!hasNext}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ✅ Slot Dialog */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className="w-[90%] max-w-md md:max-w-lg lg:max-w-xl max-h-[85vh] rounded-xl flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg font-semibold">Available Slots</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Time slots and statuses for this partner on the selected date.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-2 pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {selectedSlots.length > 0 ? (
              <ul className="space-y-2 pb-3">
                {selectedSlots.map((slot, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between border rounded-md p-2 text-sm bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <span className="truncate">{slot.time}</span>
                    <Badge
                      variant="outline"
                      className={
                        slot.status.toLowerCase() === "present"
                          ? "text-green-700 border-green-300"
                          : slot.status.toLowerCase() === "booked"
                          ? "text-blue-700 border-blue-300"
                          : slot.status.toLowerCase() === "absent"
                          ? "text-red-700 border-red-300"
                          : "text-gray-700 border-gray-300"
                      }
                    >
                      {slot.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground mt-3 text-center">
                No time slots available for this schedule.
              </p>
            )}
          </div>

          <div className="flex-shrink-0 border-t mt-3 pt-3 text-right bg-white">
            <Button onClick={() => setSlotDialogOpen(false)} className="px-6 py-2 text-sm font-medium">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}