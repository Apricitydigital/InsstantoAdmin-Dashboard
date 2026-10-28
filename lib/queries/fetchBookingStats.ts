import {
    collection,
    query,
    where,
    doc,
    getDocs,
    Timestamp
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { isRealBookingRecord } from "@/lib/booking-scope"
import {
    isAcceptedBookingStatus,
    isActiveBookingStatus,
    isCancelledBookingStatus,
    isCompletedBookingStatus,
    isPendingBookingStatus,
    isRevenueEligibleBookingStatus,
} from "@/lib/booking-status"
import { getOnboardedPartnerIds } from "@/lib/queries/partners"

export type BookingStats = {
    totalBookings: number
    pendingBookings: number
    confirmedBookings: number
    completedBookings: number
    cancelledBookings: number
    totalRevenue: number
    averageRating: number
    totalRatingsCount: number
    completionRate: number
}

export async function fetchBookingStats(fromDate?: string, toDate?: string): Promise<BookingStats> {
    const db = getFirestoreDb()
    const onboardedPartnerIds = await getOnboardedPartnerIds(db)
    const onboardedPartnerIdSet = new Set(onboardedPartnerIds)
    const bookingsCol = collection(db, "bookings")
    const reviewsCol = collection(db, "reviews")

    const filters: any[] = []
    if (fromDate) {
        const startDate = new Date(fromDate + "T00:00:00")
        filters.push(where("date", ">=", Timestamp.fromDate(startDate)))
    }
    if (toDate) {
        const endDate = new Date(toDate + "T23:59:59.999")
        filters.push(where("date", "<=", Timestamp.fromDate(endDate)))
    }

    // Match the booking table's default "Real Booking" filter exactly.
    const bookingSnapshot = await getDocs(query(bookingsCol, ...filters))
    const realBookings = bookingSnapshot.docs
        .map(bookingDoc => bookingDoc.data() as {
            provider_id?: { id?: string } | string | null
            customer_id?: { id?: string } | string | null
            status?: string
            amount_paid?: number | string
            walletAmountUsed?: number | string
            discount_amount?: number | string
        })
        .filter(booking => isRealBookingRecord(booking, onboardedPartnerIdSet))

    const total = realBookings.filter(booking => isActiveBookingStatus(booking.status)).length
    const pending = realBookings.filter(booking => isPendingBookingStatus(booking.status)).length
    const confirmed = realBookings.filter(booking => isAcceptedBookingStatus(booking.status)).length
    const completedBookings = realBookings.filter(
        booking => isCompletedBookingStatus(booking.status)
    )
    const completed = completedBookings.length
    const cancelled = realBookings.filter(booking => isCancelledBookingStatus(booking.status)).length
    const revenueBookings = realBookings.filter(booking => isRevenueEligibleBookingStatus(booking.status))
    const toNumber = (value: unknown) => {
        const number = Number(value)
        return Number.isFinite(number) ? number : 0
    }
    const totalRevenue = revenueBookings.reduce(
        (sum, booking) => sum
            + toNumber(booking.amount_paid)
            + toNumber(booking.walletAmountUsed)
            + toNumber(booking.discount_amount),
        0
    )

    // Apply the selected range to ratings as well. Older review records may use
    // `timestamp` or `date` instead of `createdAt`, so filter them client-side.
    const reviewSnapshots = await Promise.all(
        Array.from(
            { length: Math.ceil(onboardedPartnerIds.length / 30) },
            (_, index) => onboardedPartnerIds.slice(index * 30, (index + 1) * 30)
        ).map(ids => getDocs(query(reviewsCol, where(
                "partnerId",
                "in",
                ids.map(id => doc(db, "customer", id))
            ))))
    )

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
    reviewSnapshots.forEach(snapshot => snapshot.forEach(review => {
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
    }))

    const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0
    const completionRate = total > 0 ? (completed / total) * 100 : 0

    return {
        totalBookings: total,
        pendingBookings: pending,
        confirmedBookings: confirmed,
        completedBookings: completed,
        cancelledBookings: cancelled,
        totalRevenue,
        averageRating: Number(averageRating.toFixed(2)),
        totalRatingsCount: ratingCount,
        completionRate: Number(completionRate.toFixed(1)),
    }
}
