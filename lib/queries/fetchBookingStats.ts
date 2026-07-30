import {
    collection,
    query,
    where,
    doc,
    getDocs,
    Timestamp
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { PROVIDER_ID_LIST } from "@/lib/queries/partners"

const INTERNAL_CUSTOMER_ID = "aZ0kM3TQB1TuDq52bS7AEeVWQ6V2"

export type BookingStats = {
    totalBookings: number
    pendingBookings: number
    confirmedBookings: number
    completedBookings: number
    cancelledBookings: number
    cancelledByCustomer: number
    totalRevenue: number
    averageRating: number
    totalRatingsCount: number
    completionRate: number
}

export async function fetchBookingStats(fromDate?: string, toDate?: string): Promise<BookingStats> {
    const db = getFirestoreDb()
    const customerRefs = PROVIDER_ID_LIST.map(id => doc(db, "customer", id))
    const bookingsCol = collection(db, "bookings")
    const reviewsCol = collection(db, "reviews")

    const filters: any[] = []
    if (fromDate) {
        const startDate = new Date(fromDate + "T00:00:00")
        filters.push(where("date", ">=", Timestamp.fromDate(startDate)))
    }
    if (toDate) {
        const endDate = new Date(toDate + "T23:59:59")
        filters.push(where("date", "<=", Timestamp.fromDate(endDate)))
    }

    // Match the booking table's default "Real Booking" filter exactly.
    const bookingSnapshot = await getDocs(query(bookingsCol, ...filters))
    const realBookings = bookingSnapshot.docs
        .map(bookingDoc => bookingDoc.data() as {
            provider_id?: { id?: string } | null
            customer_id?: { id?: string } | null
            status?: string
            amount_paid?: number
        })
        .filter(booking => {
            const providerId = booking.provider_id?.id
            const customerId = booking.customer_id?.id

            return !!providerId &&
                PROVIDER_ID_LIST.includes(providerId as any) &&
                customerId !== INTERNAL_CUSTOMER_ID
        })

    const total = realBookings.length
    const pending = realBookings.filter(booking => booking.status === "Pending").length
    const confirmed = realBookings.filter(booking => booking.status === "Accepted").length
    const completedBookings = realBookings.filter(
        booking => booking.status === "Service_Completed"
    )
    const completed = completedBookings.length
    const cancelled = realBookings.filter(booking => booking.status === "Cancelled").length
    const cancelledByCustomer = cancelled
    const totalRevenue = completedBookings.reduce(
        (sum, booking) => sum + (booking.amount_paid || 0),
        0
    )

    // Apply the selected range to ratings as well. Older review records may use
    // `timestamp` or `date` instead of `createdAt`, so filter them client-side.
    const reviewsQuery = query(reviewsCol, where("partnerId", "in", customerRefs))
    const reviewSnap = await getDocs(reviewsQuery)

    const ratingStart = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const ratingEnd = toDate ? new Date(`${toDate}T23:59:59.999`) : null

    const toReviewDate = (value: unknown): Date | null => {
        if (value instanceof Date) return value
        if (value instanceof Timestamp) return value.toDate()
        if (value && typeof value === "object" && "toDate" in value) {
            const toDate = (value as { toDate?: unknown }).toDate
            if (typeof toDate === "function") {
                const converted = toDate.call(value)
                return converted instanceof Date ? converted : null
            }
        }
        if (typeof value === "string" || typeof value === "number") {
            const converted = new Date(value)
            return Number.isNaN(converted.getTime()) ? null : converted
        }
        return null
    }

    let totalRating = 0
    let ratingCount = 0
    reviewSnap.forEach(review => {
        const data = review.data() as {
            partnerRating?: number
            createdAt?: unknown
            timestamp?: unknown
            date?: unknown
        }
        const reviewDate = toReviewDate(data.createdAt ?? data.timestamp ?? data.date)
        if ((ratingStart || ratingEnd) && !reviewDate) return
        if (ratingStart && reviewDate && reviewDate < ratingStart) return
        if (ratingEnd && reviewDate && reviewDate > ratingEnd) return

        if (data.partnerRating && data.partnerRating > 0) {
            totalRating += data.partnerRating
            ratingCount++
        }
    })

    const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0
    const completionRate = total > 0 ? (completed / total) * 100 : 0

    return {
        totalBookings: total,
        pendingBookings: pending,
        confirmedBookings: confirmed,
        completedBookings: completed,
        cancelledBookings: cancelled,
        cancelledByCustomer,
        totalRevenue,
        averageRating: Number(averageRating.toFixed(2)),
        totalRatingsCount: ratingCount,
        completionRate: Number(completionRate.toFixed(1)),
    }
}
