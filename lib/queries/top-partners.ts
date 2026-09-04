import {
  collection,
  doc,
  DocumentData,
  DocumentReference,
  getDocs,
  query,
  where,
} from "firebase/firestore"

import { getFirestoreDb } from "@/lib/firebase"
import {
  getOnboardedPartnerIds,
  ONBOARDED_PARTNER_STATUS,
} from "@/lib/queries/partners"

export type TopPartner = {
  id: string
  name: string
  totalBookings: number
  completedBookings: number
  earnings: number
  pendingPayouts: number
  avgRating: number
}

const chunkArray = <T,>(values: T[], size = 30) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  )

async function fetchByPartnerRefs(
  collectionName: string,
  field: string,
  refs: DocumentReference<DocumentData>[]
) {
  const db = getFirestoreDb()
  return Promise.all(
    chunkArray(refs).map((chunk) =>
      getDocs(query(collection(db, collectionName), where(field, "in", chunk)))
    )
  )
}

export async function fetchTopPartners(): Promise<TopPartner[]> {
  const db = getFirestoreDb()

  try {
    const partnerIds = await getOnboardedPartnerIds(db)
    const partnerIdSet = new Set(partnerIds)
    const partnerRefs = partnerIds.map((id) => doc(db, "customer", id))

    const [partnerSnapshot, walletSnapshots, bookingSnapshot, reviewSnapshots] =
      await Promise.all([
        getDocs(query(
          collection(db, "customer"),
          where("partner_status", "==", ONBOARDED_PARTNER_STATUS)
        )),
        fetchByPartnerRefs("Wallet_Overall", "service_partner_id", partnerRefs),
        getDocs(collection(db, "bookings")),
        fetchByPartnerRefs("reviews", "partnerId", partnerRefs),
      ])

    const walletMap: Record<string, { earnings: number; pending: number }> = {}
    walletSnapshots.forEach((snapshot) => snapshot.forEach((walletDocument) => {
      const data = walletDocument.data()
      const partnerId = data.service_partner_id?.id
      if (!partnerId) return
      walletMap[partnerId] = {
        earnings: data.TotalAmountComeIn_Wallet || 0,
        pending: data.total_balance || 0,
      }
    }))

    const bookingMap: Record<string, { total: number; completed: number }> = {}
    bookingSnapshot.forEach((bookingDocument) => {
      const data = bookingDocument.data()
      const partnerId = data.provider_id?.id || data.provider_id
      if (!partnerIdSet.has(partnerId)) return
      bookingMap[partnerId] ||= { total: 0, completed: 0 }
      bookingMap[partnerId].total += 1
      if (data.status?.toLowerCase() === "service_completed") {
        bookingMap[partnerId].completed += 1
      }
    })

    const ratingMap: Record<string, { sum: number; count: number }> = {}
    reviewSnapshots.forEach((snapshot) => snapshot.forEach((reviewDocument) => {
      const data = reviewDocument.data()
      const partnerId = data.partnerId?.id
      const rating = Number(data.partnerRating || 0)
      if (!partnerId || rating <= 0) return
      ratingMap[partnerId] ||= { sum: 0, count: 0 }
      ratingMap[partnerId].sum += rating
      ratingMap[partnerId].count += 1
    }))

    return partnerSnapshot.docs
      .map((partnerDocument) => {
        const data = partnerDocument.data()
        const id = partnerDocument.id
        const wallet = walletMap[id] || { earnings: 0, pending: 0 }
        const bookings = bookingMap[id] || { total: 0, completed: 0 }
        const ratings = ratingMap[id] || { sum: 0, count: 0 }

        return {
          id,
          name: data.display_name || "Unknown",
          totalBookings: bookings.total,
          completedBookings: bookings.completed,
          earnings: wallet.earnings,
          pendingPayouts: wallet.pending,
          avgRating: ratings.count > 0 ? ratings.sum / ratings.count : 0,
        }
      })
      .sort((first, second) => second.earnings - first.earnings)
  } catch (error) {
    console.error("Error fetching top partners:", error)
    return []
  }
}
