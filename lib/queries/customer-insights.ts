"use client";

import {
  collection,
  getDocs,
  query,
  where,
  DocumentData,
  doc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { PROVIDER_ID_LIST } from "@/lib/queries/partners";

export interface CustomerStats {
  totalCustomers: number;
  newCustomerCount: number;
  repeatCustomerCount: number;
  averageRating: number;
  totalRatings: number;
}

/* -------------------------------------------------------------------------- */
/*              Fetch New vs Repeat Customers + Rating (Date Range)           */
/* -------------------------------------------------------------------------- */
export async function fetchNewVsRepeatCustomers(
  fromDate?: string,
  toDate?: string
): Promise<CustomerStats> {
  const db = getFirestoreDb();

  /* ----------------------- 1️⃣ Fetch all active customers ----------------------- */
  const customerSnapshot = await getDocs(
    query(collection(db, "customer"), where("userType.customer", "==", true))
  );
  const totalCustomers = customerSnapshot.size;

  /* ----------------------- 2️⃣ Fetch completed bookings ----------------------- */
  let bookingQuery = query(
    collection(db, "bookings"),
    where("status", "==", "Service_Completed")
  );

  // ✅ Apply date range filter if provided
  if (fromDate && toDate) {
    bookingQuery = query(
      collection(db, "bookings"),
      where("status", "==", "Service_Completed"),
      where("createdAt", ">=", new Date(fromDate)),
      where("createdAt", "<=", new Date(toDate))
    );
  }

  const bookingSnapshot = await getDocs(bookingQuery);
  const bookingCount: Record<string, number> = {};

  bookingSnapshot.forEach((docSnap) => {
    const data = docSnap.data() as DocumentData;
    const customerRef = data.customer_id;
    if (customerRef && customerRef.id) {
      bookingCount[customerRef.id] = (bookingCount[customerRef.id] || 0) + 1;
    }
  });

  /* ----------------------- 3️⃣ Calculate new/repeat customers ----------------------- */
  let newCustomerCount = 0;
  let repeatCustomerCount = 0;

  Object.values(bookingCount).forEach((count) => {
    if (count === 1) newCustomerCount++;
    else if (count > 1) repeatCustomerCount++;
  });

  /* ----------------------- 4️⃣ Fetch partner reviews ----------------------- */
  const partnerIds = PROVIDER_ID_LIST;

  const reviewsCol = collection(db, "reviews");
  const customerRefs = partnerIds.map((id) => doc(db, "customer", id));

  let reviewsQuery = query(reviewsCol, where("partnerId", "in", customerRefs));

  // ✅ Filter reviews by date if available
  if (fromDate && toDate) {
    reviewsQuery = query(
      reviewsCol,
      where("partnerId", "in", customerRefs),
      where("createdAt", ">=", new Date(fromDate)),
      where("createdAt", "<=", new Date(toDate))
    );
  }

  const reviewSnap = await getDocs(reviewsQuery);

  let totalRating = 0;
  let ratingCount = 0;

  reviewSnap.forEach((r) => {
    const data = r.data() as { partnerRating?: number };
    if (data.partnerRating && data.partnerRating > 0) {
      totalRating += data.partnerRating;
      ratingCount++;
    }
  });

  const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

  /* ----------------------- 5️⃣ Return final structured data ----------------------- */
  return {
    totalCustomers,
    newCustomerCount,
    repeatCustomerCount,
    averageRating: Number(averageRating.toFixed(2)),
    totalRatings: ratingCount,
  };
}
