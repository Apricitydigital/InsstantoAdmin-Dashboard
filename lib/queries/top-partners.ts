import { collection, getDocs, query, where, doc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

import { getProviderRefs } from "@/lib/queries/partners";




export type TopPartner = {
  id: string;
  name: string;
  totalBookings: number;
  completedBookings: number;
  earnings: number;
  pendingPayouts: number;
  avgRating: number;
};

const ALLOWED_IDS = getProviderRefs();

export async function fetchTopPartners(): Promise<TopPartner[]> {
  const db = getFirestoreDb();

  try {
    // Step 1: Fetch the 3 specific partner docs
    const partnerDocs = await Promise.all(
      ALLOWED_IDS.map((id) =>
        getDocs(query(collection(db, "customer"), where("__name__", "==", id)))
      )
    );
    const allPartners = partnerDocs.flatMap((snap) => snap.docs);
    const partnerIds = allPartners.map((d) => d.id);

    // Step 2: Fetch Wallet Data (earnings + pending payout)
    const walletSnaps = await getDocs(
      query(
        collection(db, "Wallet_Overall"),
        where(
          "service_partner_id",
          "in",
          partnerIds.map((id) => doc(db, "customer", id))
        )
      )
    );

    const walletMap: Record<string, { earnings: number; pending: number }> = {};
    walletSnaps.forEach((w: any) => {
      const data = w.data();
      const pid = data?.service_partner_id?.id;
      if (!pid) return;
      walletMap[pid] = {
        earnings: data.TotalAmountComeIn_Wallet || 0,
        pending: data.total_balance || 0,
      };
    });

    // Step 3: Fetch Bookings (using provider_id reference)
    const bookingSnaps = await getDocs(collection(db, "bookings"));
    const bookingMap: Record<string, { total: number; completed: number }> = {};

    bookingSnaps.forEach((b: any) => {
      const d = b.data();
      const pid = d.provider_id?.id || d.provider_id;
      if (!pid || !ALLOWED_IDS.includes(pid)) return;

      if (!bookingMap[pid]) bookingMap[pid] = { total: 0, completed: 0 };

      bookingMap[pid].total += 1;

      if (d.status?.toLowerCase() === "service_completed") {
        bookingMap[pid].completed += 1;
      }
    });

    // Step 4: Fetch Ratings (average from reviews)
    const reviewSnaps = await getDocs(
      query(
        collection(db, "reviews"),
        where(
          "partnerId",
          "in",
          partnerIds.map((id) => doc(db, "customer", id))
        )
      )
    );

    const ratingMap: Record<string, { sum: number; count: number }> = {};
    reviewSnaps.forEach((r: any) => {
      const d = r.data();
      const pid = d.partnerId?.id;
      if (!pid) return;
      if (!ratingMap[pid]) ratingMap[pid] = { sum: 0, count: 0 };
      const rating = Number(d.partnerRating ?? 0);
      if (rating > 0) {
        ratingMap[pid].sum += rating;
        ratingMap[pid].count += 1;
      }
    });

    // Step 5: Merge all data
    const partners: TopPartner[] = allPartners.map((p) => {
      const d = p.data();
      const id = p.id;
      const wallet = walletMap[id] || { earnings: 0, pending: 0 };
      const book = bookingMap[id] || { total: 0, completed: 0 };
      const rate = ratingMap[id] || { sum: 0, count: 0 };
      const avg =
        rate.count > 0 ? rate.sum / rate.count : 0;

      return {
        id,
        name: d.display_name || "Unknown",
        totalBookings: book.total,
        completedBookings: book.completed,
        earnings: wallet.earnings,
        pendingPayouts: wallet.pending,
        avgRating: avg,
      };
    });

    return partners.sort((a, b) => b.earnings - a.earnings);
  } catch (err) {
    console.error("Error fetching top partners:", err);
    return [];
  }
}