import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  Timestamp,
  arrayUnion,
  DocumentData,
  DocumentReference,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import type { SupportTicket } from "@/types/support"

// Common interface for Firestore user docs
interface UserData {
  name?: string
  username?: string
  display_name?: string
  customer_name?: string
  [key: string]: any
}

// Extended Review type
export interface Review {
  id: string
  customerId: string
  customerName: string
  partnerId: string
  partnerName: string
  bookingId?: string
  serviceId?: string
  serviceName?: string
  rating: number
  partnerRating: number
  feedback: string
  isPublic?: boolean
  createdAt: string
}

// ------------------- SUPPORT TICKETS -------------------
export async function getSupportTickets(): Promise<SupportTicket[]> {
  try {
    const db = getFirestoreDb()
    const complaintsCol = collection(db, "customer_complain")
    const complaintsQuery = query(
      complaintsCol,
      orderBy("date_of_complaint", "desc")
    )

    const snapshot = await getDocs(complaintsQuery)
    const tickets: SupportTicket[] = []

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as DocumentData

      // Fetch customer name if customer_id exists
      let customerName = data.customer_title || "Unknown Customer"
      if (data.customer_id) {
        try {
          const customerRef = doc(db, "customer", data.customer_id)
          const customerSnap = await getDoc(customerRef)
          if (customerSnap.exists()) {
            const customerData = customerSnap.data() as UserData | undefined
            if (customerData) {
              customerName =
                customerData.display_name ||
                customerData.customer_name ||
                customerData.name ||
                customerData.username ||
                data.customer_title
            }
          }
        } catch (error) {
          console.error("Error fetching customer:", error)
        }
      }

      tickets.push({
        id: docSnap.id,
        customerId: data.customer_id || "",
        customerName,
        bookingId: data.booking_id || undefined,
        type: mapComplaintType(data.customer_complaint),
        priority: determinePriority(
          data.complaint_status,
          data.customer_complaint
        ),
        status: mapComplaintStatus(data.complaint_status),
        subject: data.customer_complaint || "No subject",
        note: data.notefrom_Insstanto || "-",
        description: extractDescription(
          data.complaint_history,
          data.customer_complaint
        ),
        assignedTo: data.complaint_history?.[0]?.assignedTo || undefined,
        createdAt:
          data.date_of_complaint?.toDate?.()?.toISOString() ||
          new Date().toISOString(),
        updatedAt:
          data.timeslot?.toDate?.()?.toISOString() || new Date().toISOString(),
        resolvedAt:
          data.complaint_status === "resolved"
            ? data.timeslot?.toDate?.()?.toISOString()
            : undefined,
      })
    }

    return tickets
  } catch (error) {
    console.error("Error fetching support tickets:", error)
    return []
  }
}

export async function getTicketById(
  ticketId: string
): Promise<SupportTicket | null> {
  try {
    const db = getFirestoreDb()
    const docRef = doc(db, "customer_complain", ticketId)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    const data = docSnap.data() as DocumentData

    // Fetch customer name
    let customerName = data.customer_title || "Unknown Customer"
    if (data.customer_id) {
      try {
        const customerRef = doc(db, "customer", data.customer_id)
        const customerSnap = await getDoc(customerRef)
        if (customerSnap.exists()) {
          const customerData = customerSnap.data() as UserData | undefined
          if (customerData) {
            customerName =
              customerData.display_name ||
              customerData.customer_name ||
              customerData.name ||
              customerData.username ||
              data.customer_title
          }
        }
      } catch (error) {
        console.error("Error fetching customer:", error)
      }
    }

    return {
      id: docSnap.id,
      customerId: data.customer_id || "",
      customerName,
      bookingId: data.booking_id || undefined,
      type: mapComplaintType(data.customer_complaint),
      priority: determinePriority(
        data.complaint_status,
        data.customer_complaint
      ),
      status: mapComplaintStatus(data.complaint_status),
      subject: data.customer_complaint || "No subject",
      note: data.notefrom_Insstanto || "-",
      description: extractDescription(
        data.complaint_history,
        data.customer_complaint
      ),
      assignedTo: data.complaint_history?.[0]?.assignedTo || undefined,
      createdAt:
        data.date_of_complaint?.toDate?.()?.toISOString() ||
        new Date().toISOString(),
      updatedAt:
        data.timeslot?.toDate?.()?.toISOString() || new Date().toISOString(),
      resolvedAt:
        data.complaint_status === "resolved"
          ? data.timeslot?.toDate?.()?.toISOString()
          : undefined,
    }
  } catch (error) {
    console.error("Error fetching ticket:", error)
    return null
  }
}

export async function updateTicketStatus(
  ticketId: string,
  status: string,
  note?: string
): Promise<boolean> {
  try {
    const db = getFirestoreDb()
    const docRef = doc(db, "customer_complain", ticketId)

    const updateData: any = {
      complaint_status: status,
    }

    if (note) {
      updateData.complaint_history = arrayUnion({
        message: note,
        timestamp: Timestamp.now(),
        status: status,
      })
    }

    await updateDoc(docRef, updateData)
    return true
  } catch (error) {
    console.error("Error updating ticket status:", error)
    return false
  }
}

// ------------------- HELPERS -------------------
function extractDescription(
  complaintHistory: any[],
  complaintText: string
): string {
  if (complaintHistory && complaintHistory.length > 0) {
    const firstEntry = complaintHistory[0]
    return (
      firstEntry.message || firstEntry.description || complaintText || ""
    )
  }
  return complaintText || ""
}

function mapComplaintType(
  complaint: string
): "complaint" | "query" | "refund" | "technical" {
  const lowerComplaint = complaint?.toLowerCase() || ""

  if (
    lowerComplaint.includes("refund") ||
    lowerComplaint.includes("payment") ||
    lowerComplaint.includes("money")
  ) {
    return "refund"
  }
  if (
    lowerComplaint.includes("query") ||
    lowerComplaint.includes("question") ||
    lowerComplaint.includes("inquiry") ||
    lowerComplaint.includes("how to")
  ) {
    return "query"
  }
  if (
    lowerComplaint.includes("technical") ||
    lowerComplaint.includes("app") ||
    lowerComplaint.includes("website") ||
    lowerComplaint.includes("bug") ||
    lowerComplaint.includes("error")
  ) {
    return "technical"
  }

  return "complaint"
}

function mapComplaintStatus(
  status: string
): "open" | "in_progress" | "resolved" | "closed" {
  const lowerStatus = status?.toLowerCase() || ""

  if (
    lowerStatus.includes("progress") ||
    lowerStatus.includes("pending") ||
    lowerStatus.includes("working")
  ) {
    return "in_progress"
  }
  if (
    lowerStatus.includes("resolved") ||
    lowerStatus.includes("completed") ||
    lowerStatus.includes("solved")
  ) {
    return "resolved"
  }
  if (lowerStatus.includes("closed")) {
    return "closed"
  }

  return "open"
}

function determinePriority(
  status: string,
  complaint: string
): "low" | "medium" | "high" | "urgent" {
  const lowerStatus = status?.toLowerCase() || ""
  const lowerComplaint = complaint?.toLowerCase() || ""

  if (
    lowerStatus.includes("urgent") ||
    lowerStatus.includes("critical") ||
    lowerComplaint.includes("urgent") ||
    lowerComplaint.includes("immediately") ||
    lowerComplaint.includes("asap")
  ) {
    return "urgent"
  }

  if (
    lowerStatus.includes("high") ||
    lowerComplaint.includes("serious") ||
    lowerComplaint.includes("major") ||
    lowerComplaint.includes("refund")
  ) {
    return "high"
  }

  if (
    lowerStatus.includes("low") ||
    lowerComplaint.includes("minor") ||
    lowerComplaint.includes("question")
  ) {
    return "low"
  }

  return "medium"
}

// ------------------- REVIEWS -------------------
export async function getReviews(): Promise<Review[]> {
  try {
    const db = getFirestoreDb()
    const reviewsCol = collection(db, "reviews")
    const reviewsQuery = query(reviewsCol, orderBy("createdAt", "desc"))

    const snapshot = await getDocs(reviewsQuery)

    const reviews: Review[] = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as DocumentData

        // customer
        let customerName = "Anonymous"
        if (data.customerId) {
          try {
            const customerSnap = await getDoc(data.customerId as DocumentReference)
            if (customerSnap.exists()) {
              const cData = customerSnap.data() as any
              customerName = cData.display_name || cData.customer_name || "Anonymous"
            }
          } catch {}
        }

        // partner
        let partnerName = "Unknown Partner"
        if (data.partnerId) {
          try {
            const partnerSnap = await getDoc(data.partnerId as DocumentReference)
            if (partnerSnap.exists()) {
              const pData = partnerSnap.data() as any
              partnerName = pData.display_name || pData.customer_name || "Unknown Partner"
            }
          } catch {}
        }

        return {
          id: docSnap.id,
          customerId: data.customerId?.id || "",
          customerName,
          partnerId: data.partnerId?.id || "",
          partnerName,
          bookingId: data.bookingId || "",
          serviceId: data.serviceId || "",
          serviceName: data.serviceName || "Service",
          rating: data.partnerRating || data.rating || 0,
          partnerRating: data.partnerRating || 0,
          feedback: data.feedback || data.comment || "",
          isPublic: data.isPublic !== false,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        }
      })
    )

    return reviews.filter(r => r.partnerRating > 0)
  } catch (error) {
    console.error("Error fetching reviews:", error)
    return []
  }
}

export async function getPartnerReviews(partnerIds: string[]): Promise<Review[]> {
  try {
    const db = getFirestoreDb()
    const reviewsCol = collection(db, "reviews")

    const reviewsQuery = query(
      reviewsCol,
      where("partnerId", "in", partnerIds.map(id => doc(db, "customer", id)))
    )

    const snapshot = await getDocs(reviewsQuery)

    const reviews: Review[] = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as DocumentData

        // customer
        let customerName = "Anonymous"
        if (data.customerId) {
          try {
            const customerSnap = await getDoc(data.customerId as DocumentReference)
            if (customerSnap.exists()) {
              const cData = customerSnap.data() as any
              customerName = cData.display_name || cData.customer_name || "Anonymous"
            }
          } catch {}
        }

        // partner
        let partnerName = "Unknown Partner"
        if (data.partnerId) {
          try {
            const partnerSnap = await getDoc(data.partnerId as DocumentReference)
            if (partnerSnap.exists()) {
              const pData = partnerSnap.data() as any
              partnerName = pData.display_name || pData.customer_name || "Unknown Partner"
            }
          } catch {}
        }

        return {
          id: docSnap.id,
          customerId: data.customerId?.id || "",
          customerName,
          partnerId: data.partnerId?.id || "",
          partnerName,
          bookingId: data.bookingId || "",
          serviceId: data.serviceId || "",
          serviceName: data.serviceName || "Service",
          rating: data.partnerRating || data.rating || 0,
          partnerRating: data.partnerRating || 0,
          feedback: data.feedback || "",
          isPublic: data.isPublic !== false,
          createdAt: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
        }
      })
    )

    return reviews.filter(r => r.partnerRating > 0)
  } catch (error) {
    console.error("Error fetching partner reviews:", error)
    return []
  }
}
