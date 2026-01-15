import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

/* ------------------------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------------------------ */

export type BookingInfo = {
  customer: string;
  service: string;
  amount: number;
};

export type DailyOverview = {
  date: string;
  dailyAverageExpense: number;
  totalBookings: number;
  totalBookingAmount: number;
  bookings: BookingInfo[];
  services: { name: string; count: number; amount: number }[];
};

/* ------------------------------------------------------------------ */
/* GOOGLE SHEET (UNCHANGED) */
/* ------------------------------------------------------------------ */

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv";

async function fetchAverageExpenseFromSheet(): Promise<number> {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();

    const rows = text.trim().split("\n").map((r) => r.split(","));
    const header = rows[0];
    const monthIndex = header.findIndex((c) =>
      c.toLowerCase().includes("month")
    );
    const totalIndex = header.findIndex((c) =>
      c.toLowerCase().includes("total")
    );

    const dataRows = rows.slice(1).filter(
      (r) => r[monthIndex] && r[totalIndex]
    );
    if (dataRows.length === 0) return 0;

    const lastRow = dataRows[dataRows.length - 1];
    const totalExpense = parseFloat(lastRow[totalIndex]) || 0;

    const currentMonth = new Date().getMonth();
    const daysInMonth = new Date(
      new Date().getFullYear(),
      currentMonth + 1,
      0
    ).getDate();

    return totalExpense / daysInMonth;
  } catch (err) {
    console.error("Error fetching expense sheet:", err);
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/* MAIN FUNCTION */
/* ------------------------------------------------------------------ */

export async function fetchDailyOverviewSummary(): Promise<DailyOverview> {
  const db = getFirestoreDb();
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0
  );
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59
  );

  // 1️⃣ Daily average expense
  const dailyAverageExpense = await fetchAverageExpenseFromSheet();

  // 2️⃣ Fetch partners present today
  let totalPresent = 0;
  const services: { name: string; count: number; amount: number }[] = [];

  try {
    const attendanceSnap = await getDocs(
      query(
        collection(db, "partner_attendence"),
        where("status", "==", "Present")
      )
    );

    for (const docSnap of attendanceSnap.docs) {
      const d = docSnap.data();

      const dateField = d.startTime || d.date;
      const recordDate = dateField?.toDate ? dateField.toDate() : null;
      if (!recordDate) continue;

      if (recordDate >= startOfDay && recordDate <= endOfDay) {
        totalPresent++;

        let partnerName = "Unknown Partner";
        let serviceOptName = "N/A";

        const partnerRef = d.partnerid;

        if (partnerRef?.path) {
          try {
            const partnerDoc = await getDoc(partnerRef);
            if (partnerDoc.exists()) {
              const pdata = partnerDoc.data() as Record<string, any>;

              partnerName =
                pdata.display_name ||
                pdata.customer_name ||
                pdata.name ||
                "Unknown Partner";

              // 🔹 Fetch service opt name
              if (pdata.partner_serviceOpt) {
                try {
                  const serviceDoc = await getDoc(
                    doc(db, "service_subcategories", pdata.partner_serviceOpt)
                  );
                  if (serviceDoc.exists()) {
                    serviceOptName =
                      serviceDoc.data().name || "N/A";
                  }
                } catch (err) {
                  console.warn("Error fetching service opt:", err);
                }
              }
            }
          } catch (err) {
            console.warn("Error fetching partner:", err);
          }
        }

        services.push({
          name: `${partnerName} — ${serviceOptName}`, // 👈 KEY CHANGE
          count: 0,
          amount: 0,
        });
      }
    }
  } catch (e) {
    console.error("Error fetching today's attendance:", e);
  }

  return {
    date: today.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    dailyAverageExpense,
    totalBookings: totalPresent,
    totalBookingAmount: 0,
    bookings: [],
    services,
  };
}
