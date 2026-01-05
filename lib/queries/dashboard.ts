import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { fetchCustomerStats } from "@/lib/queries/customers";

export type BookingStats = {
  totalBookings: number;
  totalBookingsChange: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  completedBookingsChange: number;
  cancelledBookings: number;
  totalRevenue: number;
  totalRevenueChange: number;
  netRevenue: number;
  netRevenueChange: number;
  perOrderValue: number;
  perOrderValueChange: number;
  totalCustomers: number;
  totalCustomersChange: number;
  averageRating: number;
  totalRatingsCount: number;
  completionRate: number;
  totalOfferAmount: number;
  cac: number;
  cacChange: number;
  netPnL: number;
};

/* ------------------------------
   % CHANGE HELPER
------------------------------ */
function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/* ------------------------------
   PRORATED EXPENSE HELPER
------------------------------ */
function proratedExpense(
  monthlyExpenses: { month: string; total: number }[],
  from: Date,
  to: Date,
  year: number
) {
  const daysInMonth = (y: number, m: number) =>
    new Date(y, m + 1, 0).getDate();

  let total = 0;

  monthlyExpenses.forEach(({ month, total: monthTotal }) => {
    const monthIdx = new Date(`${month} 1, ${year}`).getMonth();
    if (isNaN(monthIdx)) return;

    const start = new Date(year, monthIdx, 1);
    const end = new Date(year, monthIdx + 1, 0);

    const dailyExpense = monthTotal / daysInMonth(year, monthIdx);

    const overlapStart = from > start ? from : start;
    const overlapEnd = to < end ? to : end;

    if (overlapStart <= overlapEnd) {
      const overlapDays =
        (overlapEnd.getTime() - overlapStart.getTime()) /
          (1000 * 60 * 60 * 24) +
        1;

      total += overlapDays * dailyExpense;
    }
  });

  return total;
}

/* ------------------------------
   MAIN FUNCTION
------------------------------ */
export async function fetchBookingStats(
  fromDate?: string,
  toDate?: string
): Promise<BookingStats> {
  const db = getFirestoreDb();
  const now = new Date();
  const year = now.getFullYear();

  /* ------------------------------
     DATE RANGE (with fallback)
  ------------------------------ */
  const defaultFrom = new Date(year, now.getMonth(), 1);
  const defaultTo = new Date(year, now.getMonth() + 1, 0);

  const from = fromDate
    ? new Date(fromDate + "T00:00:00")
    : defaultFrom;

  const to = toDate
    ? new Date(toDate + "T23:59:59")
    : defaultTo;

  const fromTS = Timestamp.fromDate(from);
  const toTS = Timestamp.fromDate(to);

  /* ------------------------------
     PROVIDER FILTERS
  ------------------------------ */
  const providerIds = [
    "mwBcGMWLwDULHIS9hXx7JLuRfCi1",
    "Dmoo33tCx0OU1HMtapISBc9Oeeq2",
    "VxxapfO7l8YM5f6xmFqpThc17eD3",
    "Q0kKYbdOKVbeZsdiLGsJoM5BWQl1",
    "7KlujhUyJbeCTPG6Pty8exlxXuM2",
    "fGLJCCFDEneQZ7ciz71Q29WBgGQ2",
    "MstGdrDCHkZ1KKf0xtZctauIovf2",
  ];
  const providerRefs = providerIds.map((id) =>
    doc(db, "customer", id)
  );

  const bookingsCol = collection(db, "bookings");
  const customersCol = collection(db, "customer");

  /* ------------------------------
     BOOKINGS — TOTAL
  ------------------------------ */
  const bookingSnap = await getDocs(
    query(
      bookingsCol,
      where("provider_id", "in", providerRefs),
      where("date", ">=", fromTS),
      where("date", "<=", toTS)
    )
  );

  const totalBookings = bookingSnap.size;

  /* ------------------------------
     BOOKINGS — STATUS
  ------------------------------ */
  async function countStatus(status: string) {
    return await getDocs(
      query(
        bookingsCol,
        where("provider_id", "in", providerRefs),
        where("status", "==", status),
        where("date", ">=", fromTS),
        where("date", "<=", toTS)
      )
    );
  }

  const pendingSnap = await countStatus("Pending");
  const confirmedSnap = await countStatus("Accepted");
  const completedSnap = await countStatus("Service_Completed");
  const cancelledSnap = await countStatus("Booking_Cancelled");

  const pendingBookings = pendingSnap.size;
  const confirmedBookings = confirmedSnap.size;
  const completedBookings = completedSnap.size;
  const cancelledBookings = cancelledSnap.size;

  /* ------------------------------
     REVENUE CALCULATION
  ------------------------------ */
  let totalRevenue = 0;
  let walletUsed = 0;
  let discounts = 0;
  let totalOfferAmount = 0;

  completedSnap.forEach((doc) => {
    const d = doc.data();
    totalRevenue += d.amount_paid || 0;
    walletUsed += d.walletAmountUsed || 0;
    discounts += d.discount_amount || 0;
    totalOfferAmount += (d.walletAmountUsed || 0) + (d.discount_amount || 0);
  });

  const netRevenue = totalRevenue - walletUsed - discounts;

  const perOrderValue =
    completedBookings > 0
      ? totalRevenue / completedBookings
      : 0;

  /* ------------------------------
     NEW CUSTOMERS CREATED IN RANGE
  ------------------------------ */
  const customersSnap = await getDocs(
    query(
      customersCol,
      where("userType.customer", "==", true),
      where("created_time", ">=", fromTS),
      where("created_time", "<=", toTS)
    )
  );

  const totalCustomers = customersSnap.size;

  /* ------------------------------
     CAC — CUSTOMERS WITH FIRST BOOKING
  ------------------------------ */
  const safeFrom = fromDate ?? "";
  const safeTo = toDate ?? "";

  const {
    customersWithOneBooking,
  } = await fetchCustomerStats(safeFrom, safeTo);

  /* ------------------------------
     MARKETING EXPENSE — GOOGLE SHEET
  ------------------------------ */
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv";

  const sheetRes = await fetch(sheetUrl);
  const sheetData = await sheetRes.text();

  const rows = sheetData.split("\n").map((r) => r.split(","));
  const header = rows[0];

  const monthIdx = header.findIndex((h) =>
    h.toLowerCase().includes("month")
  );
  const totalIdx = header.findIndex((h) =>
    h.toLowerCase().includes("total")
  );

  const monthlyExpenses = rows
    .slice(1)
    .map((r) => ({
      month: r[monthIdx],
      total: parseFloat(r[totalIdx]) || 0,
    }))
    .filter((m) => m.total > 0);

  /* ------------------------------
     CAC — PRORATED MARKETING EXPENSE
  ------------------------------ */
  const cacExpense = proratedExpense(
    monthlyExpenses,
    from,
    to,
    year
  );

  const cac =
    customersWithOneBooking > 0
      ? cacExpense / customersWithOneBooking
      : 0;

  /* ------------------------------
     CAC CHANGE (PREVIOUS RANGE)
  ------------------------------ */
  const diff = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - diff);
  const prevTo = new Date(to.getTime() - diff);

  const prevCACExpense = proratedExpense(
    monthlyExpenses,
    prevFrom,
    prevTo,
    year
  );

  const prevDateFromStr = prevFrom.toISOString().slice(0, 10);
  const prevDateToStr = prevTo.toISOString().slice(0, 10);

  const {
    customersWithOneBooking: prevNewCustomers,
  } = await fetchCustomerStats(prevDateFromStr, prevDateToStr);

  const prevCAC =
    prevNewCustomers > 0
      ? prevCACExpense / prevNewCustomers
      : 0;

  const cacChange = percentChange(cac, prevCAC);

  /* ------------------------------
     NET PNL (DAILY PRORATED)
  ------------------------------ */
  const totalExpensePNL = proratedExpense(
    monthlyExpenses,
    from,
    to,
    year
  );

  const netPnL = netRevenue - totalExpensePNL;

  /* ------------------------------
     FINAL RETURN OBJECT
  ------------------------------ */
  return {
    totalBookings,
    totalBookingsChange: 0,
    pendingBookings,
    confirmedBookings,
    completedBookings,
    completedBookingsChange: 0,
    cancelledBookings,
    totalRevenue,
    totalRevenueChange: 0,
    netRevenue,
    netRevenueChange: 0,
    perOrderValue,
    perOrderValueChange: 0,
    totalCustomers,
    totalCustomersChange: 0,
    averageRating: 5,
    totalRatingsCount: 0,
    completionRate:
      totalBookings > 0
        ? Number(((completedBookings / totalBookings) * 100).toFixed(1))
        : 0,
    totalOfferAmount,
    cac: Number(cac.toFixed(2)),
    cacChange: Number(cacChange.toFixed(1)),
    netPnL: Number(netPnL.toFixed(2)),
  };
}
