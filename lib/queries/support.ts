import {
  arrayUnion,
  collection,
  doc,
  DocumentData,
  DocumentReference,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore"

import { getFirestoreDb } from "@/lib/firebase"
import type { SupportTicket } from "@/types/support"

// ============================================================
// TYPES
// ============================================================

interface UserData {
  name?: string
  username?: string
  display_name?: string
  customer_name?: string
  partner_name?: string
  [key: string]: unknown
}

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

type FirestoreDateLike = {
  toDate?: () => Date
  seconds?: number
  _seconds?: number
}

// ============================================================
// CONSTANTS AND CACHE
// ============================================================

// Firestore currently allows a maximum of 30 values in an "in" query.
const MAX_IN_QUERY_VALUES = 30

/*
  Cache user document requests.

  When multiple complaints or reviews belong to the same customer/partner,
  Firestore will only be called once for that document during the session.
*/
const userNamePromiseCache = new Map<
  string,
  Promise<string | null>
>()

const userDataPromiseCache = new Map<
  string,
  Promise<UserData | null>
>()

// ============================================================
// COMMON HELPERS
// ============================================================

function toIsoString(
  value: unknown,
  fallback = ""
): string {
  if (!value) {
    return fallback
  }

  const firestoreValue = value as FirestoreDateLike

  try {
    if (typeof firestoreValue.toDate === "function") {
      return firestoreValue.toDate().toISOString()
    }

    const seconds =
      firestoreValue.seconds ?? firestoreValue._seconds

    if (typeof seconds === "number") {
      return new Date(seconds * 1000).toISOString()
    }

    if (value instanceof Date) {
      return value.toISOString()
    }

    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      const parsedDate = new Date(value)

      return Number.isNaN(parsedDate.getTime())
        ? fallback
        : parsedDate.toISOString()
    }
  } catch {
    return fallback
  }

  return fallback
}

function getDateValue(value: string): number {
  const parsedDate = new Date(value).getTime()

  return Number.isNaN(parsedDate)
    ? 0
    : parsedDate
}

function getUserDisplayName(
  data?: UserData
): string | null {
  if (!data) {
    return null
  }

  return (
    data.display_name ||
    data.customer_name ||
    data.partner_name ||
    data.name ||
    data.username ||
    null
  )
}

function getReferenceId(value: unknown): string {
  if (!value) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  const reference = value as Partial<DocumentReference>

  return typeof reference.id === "string"
    ? reference.id
    : ""
}

function getReferencePath(value: unknown): string {
  if (!value || typeof value === "string") {
    return ""
  }

  const reference = value as Partial<DocumentReference>

  return typeof reference.path === "string"
    ? reference.path
    : ""
}

/*
  Fetches a customer or partner name with caching.

  If multiple rows reference the same document, the same Promise is reused
  instead of making multiple Firestore requests.
*/
function resolveUserName(
  reference: DocumentReference,
  fallback: string
): Promise<string> {
  const cacheKey = reference.path

  let cachedPromise =
    userNamePromiseCache.get(cacheKey)

  if (!cachedPromise) {
    cachedPromise = resolveUserData(reference).then(
      (data) => getUserDisplayName(data || undefined)
    )

    userNamePromiseCache.set(
      cacheKey,
      cachedPromise
    )
  }

  return cachedPromise.then(
    (name) => name || fallback
  )
}

function resolveUserData(
  reference: DocumentReference
): Promise<UserData | null> {
  const cacheKey = reference.path
  let cachedPromise = userDataPromiseCache.get(cacheKey)

  if (!cachedPromise) {
    cachedPromise = getDoc(reference)
      .then((snapshot) =>
        snapshot.exists()
          ? (snapshot.data() as UserData)
          : null
      )
      .catch((error) => {
        console.error(`Error fetching user ${cacheKey}:`, error)
        return null
      })

    userDataPromiseCache.set(cacheKey, cachedPromise)
  }

  return cachedPromise
}

function getUserContact(data: UserData | null): string {
  if (!data) return ""

  const contact =
    data.phone_number ||
    data.contact_no ||
    data.customer_phone ||
    data.customer_mobile ||
    data.mobile_number

  return contact == null ? "" : String(contact)
}

function createChunks<T>(
  values: T[],
  size: number
): T[][] {
  const output: T[][] = []

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    output.push(
      values.slice(index, index + size)
    )
  }

  return output
}

// ============================================================
// SUPPORT TICKET MAPPER
// ============================================================

function buildSupportTicket(
  id: string,
  data: DocumentData,
  customerName?: string
): SupportTicket {
  const nowIso = new Date().toISOString()

  const createdAt = toIsoString(
    data.date_of_complaint,
    nowIso
  )

  const updatedAt = toIsoString(
    data.timeslot,
    createdAt
  )

  const mappedStatus = mapComplaintStatus(
    data.complaint_status
  )

  return {
    id,

    customerId:
      data.customer_id || "",

    customerName:
      customerName ||
      data.customer_title ||
      "Unknown Customer",

    contact_no:
      data.contact_no ||
      data.customer_phone ||
      data.customer_mobile ||
      data.phone_number ||
      data.mobile_number ||
      "",

    bookingId:
      data.booking_id || undefined,

    type: mapComplaintType(
      data.customer_complaint
    ),

    priority: determinePriority(
      data.complaint_status,
      data.customer_complaint
    ),

    status: mappedStatus,

    subject:
      data.customer_complaint ||
      "No subject",

    note:
      data.notefrom_Insstanto ||
      "-",

    description: extractDescription(
      data.complaint_history,
      data.customer_complaint
    ),

    assignedTo:
      data.complaint_history?.[0]
        ?.assignedTo || undefined,

    createdAt,

    updatedAt,

    resolvedAt:
      mappedStatus === "resolved"
        ? updatedAt
        : undefined,
  }
}

// ============================================================
// SUPPORT TICKETS
// ============================================================

/*
  Fast initial request.

  This function only fetches the complaint documents, allowing the stats
  and table rows to render immediately.

  Customer names can then be hydrated separately using
  hydrateSupportTicketCustomerNames().
*/
export async function getSupportTickets(): Promise<
  SupportTicket[]
> {
  try {
    const db = getFirestoreDb()

    const complaintsQuery = query(
      collection(
        db,
        "customer_complain"
      ),
      orderBy(
        "date_of_complaint",
        "desc"
      )
    )

    const snapshot =
      await getDocs(complaintsQuery)

    return snapshot.docs.map(
      (documentSnapshot) =>
        buildSupportTicket(
          documentSnapshot.id,
          documentSnapshot.data() as DocumentData
        )
    )
  } catch (error) {
    console.error(
      "Error fetching support tickets:",
      error
    )

    return []
  }
}

/*
  Loads customer names after the support ticket table is already visible.

  Only unique customer IDs are fetched, and all requests run in parallel.
*/
export async function hydrateSupportTicketCustomerNames(
  tickets: SupportTicket[]
): Promise<SupportTicket[]> {
  if (tickets.length === 0) {
    return tickets
  }

  const db = getFirestoreDb()

  const uniqueCustomerIds = [
    ...new Set(
      tickets
        .map(
          (ticket) => ticket.customerId
        )
        .filter(
          (
            customerId
          ): customerId is string =>
            Boolean(customerId)
        )
    ),
  ]

  const customerDetails = new Map<
    string,
    { name: string; contact: string }
  >()

  await Promise.all(
    uniqueCustomerIds.map(
      async (customerId) => {
        const relatedTicket =
          tickets.find(
            (ticket) =>
              ticket.customerId ===
              customerId
          )

        const fallbackName =
          relatedTicket?.customerName ||
          "Unknown Customer"

        const customerReference = doc(db, "customer", customerId)
        const customerData = await resolveUserData(customerReference)

        customerDetails.set(customerId, {
          name: getUserDisplayName(customerData || undefined) || fallbackName,
          contact: getUserContact(customerData),
        })
      }
    )
  )

  return tickets.map((ticket) => {
    const customer = customerDetails.get(ticket.customerId)

    return {
      ...ticket,
      customerName: customer?.name || ticket.customerName,
      contact_no: ticket.contact_no || customer?.contact || "",
    }
  })
}

export async function getTicketById(
  ticketId: string
): Promise<SupportTicket | null> {
  try {
    const db = getFirestoreDb()

    const ticketSnapshot =
      await getDoc(
        doc(
          db,
          "customer_complain",
          ticketId
        )
      )

    if (!ticketSnapshot.exists()) {
      return null
    }

    const data =
      ticketSnapshot.data() as DocumentData

    const fallbackName =
      data.customer_title ||
      "Unknown Customer"

    const customerName =
      data.customer_id
        ? await resolveUserName(
            doc(
              db,
              "customer",
              data.customer_id
            ),
            fallbackName
          )
        : fallbackName

    return buildSupportTicket(
      ticketSnapshot.id,
      data,
      customerName
    )
  } catch (error) {
    console.error(
      "Error fetching ticket:",
      error
    )

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

    const updateData: DocumentData = {
      complaint_status: status,
      timeslot: Timestamp.now(),
    }

    if (note?.trim()) {
      updateData.complaint_history =
        arrayUnion({
          message: note.trim(),
          timestamp: Timestamp.now(),
          status,
        })
    }

    await updateDoc(
      doc(
        db,
        "customer_complain",
        ticketId
      ),
      updateData
    )

    return true
  } catch (error) {
    console.error(
      "Error updating ticket status:",
      error
    )

    return false
  }
}

// ============================================================
// SUPPORT TICKET HELPERS
// ============================================================

function extractDescription(
  complaintHistory: unknown,
  complaintText: string
): string {
  if (
    Array.isArray(complaintHistory) &&
    complaintHistory.length > 0
  ) {
    const firstEntry =
      complaintHistory[0] as {
        message?: string
        description?: string
      }

    return (
      firstEntry.message ||
      firstEntry.description ||
      complaintText ||
      ""
    )
  }

  return complaintText || ""
}

function mapComplaintType(
  complaint: string
):
  | "complaint"
  | "query"
  | "refund"
  | "technical" {
  const lowerComplaint =
    complaint?.toLowerCase() || ""

  if (
    lowerComplaint.includes(
      "refund"
    ) ||
    lowerComplaint.includes(
      "payment"
    ) ||
    lowerComplaint.includes(
      "money"
    )
  ) {
    return "refund"
  }

  if (
    lowerComplaint.includes(
      "query"
    ) ||
    lowerComplaint.includes(
      "question"
    ) ||
    lowerComplaint.includes(
      "inquiry"
    ) ||
    lowerComplaint.includes(
      "how to"
    )
  ) {
    return "query"
  }

  if (
    lowerComplaint.includes(
      "technical"
    ) ||
    lowerComplaint.includes(
      "app"
    ) ||
    lowerComplaint.includes(
      "website"
    ) ||
    lowerComplaint.includes(
      "bug"
    ) ||
    lowerComplaint.includes(
      "error"
    )
  ) {
    return "technical"
  }

  return "complaint"
}

function mapComplaintStatus(
  status: string
):
  | "open"
  | "in_progress"
  | "resolved"
  | "closed" {
  const lowerStatus =
    status?.toLowerCase() || ""

  if (
    lowerStatus.includes(
      "progress"
    ) ||
    lowerStatus.includes(
      "pending"
    ) ||
    lowerStatus.includes(
      "working"
    )
  ) {
    return "in_progress"
  }

  if (
    lowerStatus.includes(
      "resolved"
    ) ||
    lowerStatus.includes(
      "completed"
    ) ||
    lowerStatus.includes(
      "solved"
    )
  ) {
    return "resolved"
  }

  if (
    lowerStatus.includes("closed")
  ) {
    return "closed"
  }

  return "open"
}

function determinePriority(
  status: string,
  complaint: string
):
  | "low"
  | "medium"
  | "high"
  | "urgent" {
  const lowerStatus =
    status?.toLowerCase() || ""

  const lowerComplaint =
    complaint?.toLowerCase() || ""

  if (
    lowerStatus.includes(
      "urgent"
    ) ||
    lowerStatus.includes(
      "critical"
    ) ||
    lowerComplaint.includes(
      "urgent"
    ) ||
    lowerComplaint.includes(
      "immediately"
    ) ||
    lowerComplaint.includes(
      "asap"
    )
  ) {
    return "urgent"
  }

  if (
    lowerStatus.includes(
      "high"
    ) ||
    lowerComplaint.includes(
      "serious"
    ) ||
    lowerComplaint.includes(
      "major"
    ) ||
    lowerComplaint.includes(
      "refund"
    )
  ) {
    return "high"
  }

  if (
    lowerStatus.includes(
      "low"
    ) ||
    lowerComplaint.includes(
      "minor"
    ) ||
    lowerComplaint.includes(
      "question"
    )
  ) {
    return "low"
  }

  return "medium"
}

// ============================================================
// REVIEW MAPPER
// ============================================================

async function buildReviews(
  reviewDocuments: Array<{
    id: string
    data: () => DocumentData
  }>
): Promise<Review[]> {
  /*
    Store only unique customer and partner references.

    For example, if 20 reviews belong to the same partner, that partner
    document will only be fetched once.
  */
  const referencesByPath = new Map<
    string,
    {
      reference: DocumentReference
      fallback: string
    }
  >()

  for (
    const reviewDocument of
    reviewDocuments
  ) {
    const data =
      reviewDocument.data()

    const customerPath =
      getReferencePath(
        data.customerId
      )

    const partnerPath =
      getReferencePath(
        data.partnerId
      )

    if (customerPath) {
      referencesByPath.set(
        customerPath,
        {
          reference:
            data.customerId as DocumentReference,

          fallback:
            "Anonymous",
        }
      )
    }

    if (partnerPath) {
      referencesByPath.set(
        partnerPath,
        {
          reference:
            data.partnerId as DocumentReference,

          fallback:
            "Unknown Partner",
        }
      )
    }
  }

  const namesByPath =
    new Map<string, string>()

  // Fetch every unique name in parallel.
  await Promise.all(
    [
      ...referencesByPath.entries(),
    ].map(
      async ([
        path,
        {
          reference,
          fallback,
        },
      ]) => {
        const name =
          await resolveUserName(
            reference,
            fallback
          )

        namesByPath.set(
          path,
          name
        )
      }
    )
  )

  return reviewDocuments
    .map((reviewDocument) => {
      const data =
        reviewDocument.data()

      const customerPath =
        getReferencePath(
          data.customerId
        )

      const partnerPath =
        getReferencePath(
          data.partnerId
        )

      const partnerRating =
        Number(
          data.partnerRating ||
            data.rating ||
            0
        )

      /*
        Some review documents use createdAt, while older records may use
        timestamp or date. This handles all three.
      */
      const createdAt =
        toIsoString(
          data.createdAt ||
            data.timestamp ||
            data.date,
          "1970-01-01T00:00:00.000Z"
        )

      return {
        id: reviewDocument.id,

        customerId:
          getReferenceId(
            data.customerId
          ),

        customerName:
          namesByPath.get(
            customerPath
          ) || "Anonymous",

        partnerId:
          getReferenceId(
            data.partnerId
          ),

        partnerName:
          namesByPath.get(
            partnerPath
          ) ||
          "Unknown Partner",

        bookingId:
          getReferenceId(
            data.bookingId
          ) ||
          data.bookingId ||
          "",

        serviceId:
          getReferenceId(
            data.serviceId
          ) ||
          data.serviceId ||
          "",

        serviceName:
          data.serviceName ||
          "Service",

        rating:
          partnerRating,

        partnerRating,

        feedback:
          data.feedback ||
          data.comment ||
          "",

        isPublic:
          data.isPublic !== false,

        createdAt,
      } satisfies Review
    })
    .filter(
      (review) =>
        review.partnerRating > 0
    )
    /*
      Newest review first.

      Sorting is done after all date fields are normalized so reviews using
      createdAt, timestamp, or date are correctly ordered together.
    */
    .sort(
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
}

// ============================================================
// ALL REVIEWS
// ============================================================

export async function getReviews(): Promise<
  Review[]
> {
  try {
    const db = getFirestoreDb()

    /*
      We sort after normalizing review dates because some documents may use
      timestamp instead of createdAt.
    */
    const snapshot = await getDocs(
      collection(
        db,
        "reviews"
      )
    )

    return buildReviews(
      snapshot.docs
    )
  } catch (error) {
    console.error(
      "Error fetching reviews:",
      error
    )

    return []
  }
}

// ============================================================
// PARTNER REVIEWS
// ============================================================

export async function getPartnerReviews(
  partnerIds: string[]
): Promise<Review[]> {
  try {
    const uniquePartnerIds = [
      ...new Set(
        partnerIds.filter(Boolean)
      ),
    ]

    if (
      uniquePartnerIds.length === 0
    ) {
      return []
    }

    const db = getFirestoreDb()

    const reviewsCollection =
      collection(
        db,
        "reviews"
      )

    /*
      Firestore's "in" query has a limit, so large provider lists are divided
      into safe batches.
    */
    const partnerIdChunks =
      createChunks(
        uniquePartnerIds,
        MAX_IN_QUERY_VALUES
      )

    /*
      Run every review batch query in parallel.
    */
    const snapshots =
      await Promise.all(
        partnerIdChunks.map(
          (partnerIdChunk) =>
            getDocs(
              query(
                reviewsCollection,
                where(
                  "partnerId",
                  "in",
                  partnerIdChunk.map(
                    (partnerId) =>
                      doc(
                        db,
                        "customer",
                        partnerId
                      )
                  )
                )
              )
            )
        )
      )

    /*
      Deduplicate review documents in case duplicate provider IDs were
      supplied or documents overlap between batches.
    */
    const uniqueDocuments =
      new Map<
        string,
        (typeof snapshots)[number]["docs"][number]
      >()

    for (
      const snapshot of snapshots
    ) {
      for (
        const reviewDocument of
        snapshot.docs
      ) {
        uniqueDocuments.set(
          reviewDocument.id,
          reviewDocument
        )
      }
    }

    return buildReviews([
      ...uniqueDocuments.values(),
    ])
  } catch (error) {
    console.error(
      "Error fetching partner reviews:",
      error
    )

    return []
  }
}
