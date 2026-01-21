import {
    collection,
    getCountFromServer,
    query,
    where,
    doc,
    getDocs,
    Timestamp
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { PROVIDER_ID_LIST } from "@/lib/queries/partners";


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

    // ✅ Build date filters (local timezone, no UTC offset to avoid extra day)
    const filters: any[] = []
    if (fromDate) {
        const startDate = new Date(fromDate + "T00:00:00")
        filters.push(where("date", ">=", Timestamp.fromDate(startDate)))
    }
    if (toDate) {
        const endDate = new Date(toDate + "T23:59:59")
        filters.push(where("date", "<=", Timestamp.fromDate(endDate)))
    }

    // ✅ Append common filters dynamically
    const qWithFilters = (...clauses: any[]) => query(bookingsCol, ...filters, ...clauses)

    // Queries with date range applied
    const totalBookingsQuery = qWithFilters(where("provider_id", "in", customerRefs))
    const pendingQuery = qWithFilters(where("status", "==", "Pending"))
    const confirmedQuery = qWithFilters(
        where("provider_id", "in", customerRefs),
        where("status", "==", "Accepted")
    )
    const completedQuery = qWithFilters(
        where("provider_id", "in", customerRefs),
        where("status", "==", "Service_Completed")
    )
    const cancelledQuery = qWithFilters(
        where("provider_id", "in", customerRefs),
        where("status", "==", "Cancelled")
    )
    const cancelledByCustomerQuery = qWithFilters(
        where("provider_id", "in", customerRefs),
        where("status", "==", "Cancelled_By_Customer")
    )

    const [
        totalSnapshot,
        pendingSnap,
        confirmedSnap,
        completedSnap,
        cancelledSnap,
        cancelledByCustomerSnap,
    ] = await Promise.all([
        getCountFromServer(totalBookingsQuery),
        getCountFromServer(pendingQuery),
        getCountFromServer(confirmedQuery),
        getCountFromServer(completedQuery),
        getCountFromServer(cancelledQuery),
        getCountFromServer(cancelledByCustomerQuery),
    ])

    const total = Number(totalSnapshot.data().count || 0)
    const pending = Number(pendingSnap.data().count || 0)
    const confirmed = Number(confirmedSnap.data().count || 0)
    const completed = Number(completedSnap.data().count || 0)
    const cancelled = Number(cancelledSnap.data().count || 0)
    const cancelledByCustomer = Number(cancelledByCustomerSnap.data().count || 0)

    // 💰 Calculate revenue
    const completedBookingsSnapshot = await getDocs(completedQuery)
    let totalRevenue = 0
    completedBookingsSnapshot.forEach(d => {
        const data = d.data() as { amount_paid?: number }
        totalRevenue += data.amount_paid || 0
    })

    // ⭐ Fetch real partner ratings (no date filter applied to reviews)
    const reviewsQuery = query(
        reviewsCol,
        where("partnerId", "in", customerRefs)
    )
    const reviewSnap = await getDocs(reviewsQuery)

    let totalRating = 0
    let ratingCount = 0

    reviewSnap.forEach(r => {
        const data = r.data() as { partnerRating?: number }
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