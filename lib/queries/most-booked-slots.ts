import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { isActiveBookingStatus } from "@/lib/booking-status";
import { getOnboardedPartnerIdSet } from "@/lib/queries/partners";

const INTERNAL_CUSTOMER_ID = "aZ0kM3TQB1TuDq52bS7AEeVWQ6V2";

export type TimeSlot = {
  time: string;
  bookings: number;
  revenue: number;
};

export async function fetchMostBookedSlots(fromDate: string, toDate: string): Promise<TimeSlot[]> {
  try {
    const db = getFirestoreDb();
    const allowedProviders = await getOnboardedPartnerIdSet(db);

    // Query the range and include every non-cancelled booking in slot revenue.
    const filters: any[] = [];

    if (fromDate && toDate) {
      const start = Timestamp.fromDate(new Date(fromDate + "T00:00:00Z"));
      const end = Timestamp.fromDate(new Date(toDate + "T23:59:59Z"));
      filters.push(where("date", ">=", start));
      filters.push(where("date", "<=", end));
    }

    const q = query(collection(db, "bookings"), ...filters);
    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    // ✅ Initialize slot data map
    const slotData: Record<string, { bookings: number; revenue: number }> = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!isActiveBookingStatus(data.status)) return;
      const providerId = data.provider_id?.id || data.provider_id;
      const customerId = data.customer_id?.id || data.customer_id;
      if (!allowedProviders.has(providerId) || customerId === INTERNAL_CUSTOMER_ID) return;
      const slotDate = data?.timeSlot?.toDate?.() || null;

      if (!slotDate) return;

      const hour = slotDate.getHours() % 12 || 12;
      const amPm = slotDate.getHours() >= 12 ? "PM" : "AM";
      const timeKey = `${hour.toString().padStart(2, "0")}:00 ${amPm}`;

      const amount =
        Number(data.amount_paid || 0) +
        Number(data.walletAmountUsed || 0) +
        Number(data.discount_amount || 0);

      if (!slotData[timeKey]) {
        slotData[timeKey] = { bookings: 0, revenue: 0 };
      }

      slotData[timeKey].bookings += 1;
      slotData[timeKey].revenue += amount;
    });

    // ✅ Convert to array and sort by most bookings
    return Object.entries(slotData)
      .map(([time, stats]) => ({
        time,
        bookings: stats.bookings,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.bookings - a.bookings);
  } catch (error) {
    console.error("Error fetching most booked slots:", error);
    return [];
  }
}
