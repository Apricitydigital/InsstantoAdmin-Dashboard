import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

export type TimeSlot = {
  time: string;
  bookings: number;
  revenue: number;
};

export async function fetchMostBookedSlots(fromDate: string, toDate: string): Promise<TimeSlot[]> {
  try {
    const db = getFirestoreDb();

    // ✅ Query completed bookings within selected date range
    const filters: any[] = [where("status", "==", "Service_Completed")];

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
      const slotDate = data?.timeSlot?.toDate?.() || null;

      if (!slotDate) return;

      const hour = slotDate.getHours() % 12 || 12;
      const amPm = slotDate.getHours() >= 12 ? "PM" : "AM";
      const timeKey = `${hour.toString().padStart(2, "0")}:00 ${amPm}`;

      const amount = Number(data.amount_paid || 0); // ✅ use amount_paid for revenue

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