"use client";

import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
  Timestamp,
  DocumentData,
  doc,
  QueryConstraint,
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

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

export async function fetchNewVsRepeatCustomers(
  fromDate?: string,
  toDate?: string
): Promise<CustomerStats> {
  const db = getFirestoreDb();

  const startDate = fromDate
    ? new Date(`${fromDate}T00:00:00Z`)
    : new Date(2025, 3, 1);

  const endDate = toDate
    ? new Date(`${toDate}T23:59:59Z`)
    : new Date();

  const fromTimestamp = Timestamp.fromDate(startDate);
  const toTimestamp = Timestamp.fromDate(endDate);

  /* -------------------------------------------------------------------------- */
  /*                  1. Fetch customers created in selected range               */
  /* -------------------------------------------------------------------------- */

  const customersQuery = query(
    collection(db, "customer"),
    where("userType.customer", "==", true),
    where("created_time", ">=", fromTimestamp),
    where("created_time", "<=", toTimestamp)
  );

  const totalCustomersSnapshot = await getCountFromServer(customersQuery);
  const totalCustomers = totalCustomersSnapshot.data().count || 0;

  const customerSnapshot = await getDocs(customersQuery);

  const customerIds = customerSnapshot.docs.map((docSnap) => docSnap.id);

  if (customerIds.length === 0) {
    return {
      totalCustomers,
      newCustomerCount: 0,
      repeatCustomerCount: 0,
      averageRating: 0,
      totalRatings: 0,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*              2. Fetch completed bookings of selected customers              */
  /* -------------------------------------------------------------------------- */

  const bookingCount: Record<string, number> = {};
  const batchSize = 10;

  const bookingQueries = [];

  for (let i = 0; i < customerIds.length; i += batchSize) {
    const batch = customerIds.slice(i, i + batchSize);
    const customerRefs = batch.map((id) => doc(db, "customer", id));

    const bookingQuery = query(
      collection(db, "bookings"),
      where("status", "==", "Service_Completed"),
      where("customer_id", "in", customerRefs)
    );

    bookingQueries.push(getDocs(bookingQuery));
  }

  const bookingResults = await Promise.all(bookingQueries);

  bookingResults.forEach((snap) => {
    snap.forEach((docSnap: DocumentData) => {
      const data = docSnap.data();
      const customerRef = data.customer_id;

      if (customerRef?.id) {
        bookingCount[customerRef.id] = (bookingCount[customerRef.id] || 0) + 1;
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                  3. One booking = New, Multiple = Repeat                    */
  /* -------------------------------------------------------------------------- */

  let newCustomerCount = 0;
  let repeatCustomerCount = 0;

  Object.values(bookingCount).forEach((count) => {
    if (count === 1) {
      newCustomerCount++;
    } else if (count > 1) {
      repeatCustomerCount++;
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                          4. Fetch partner ratings                           */
  /* -------------------------------------------------------------------------- */

  const reviewsCol = collection(db, "reviews");

  let totalRating = 0;
  let ratingCount = 0;

  const partnerIdChunks = chunkArray(PROVIDER_ID_LIST, 10);

  for (const chunk of partnerIdChunks) {
    const partnerRefs = chunk.map((id) => doc(db, "customer", id));

    const reviewConstraints: QueryConstraint[] = [
      where("partnerId", "in", partnerRefs),
      where("createdAt", ">=", startDate),
      where("createdAt", "<=", endDate),
    ];

    const reviewsQuery = query(reviewsCol, ...reviewConstraints);
    const reviewSnap = await getDocs(reviewsQuery);

    reviewSnap.forEach((reviewDoc) => {
      const data = reviewDoc.data() as {
        partnerRating?: number;
      };

      if (typeof data.partnerRating === "number" && data.partnerRating > 0) {
        totalRating += data.partnerRating;
        ratingCount++;
      }
    });
  }

  const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

  return {
    totalCustomers,
    newCustomerCount,
    repeatCustomerCount,
    averageRating: Number(averageRating.toFixed(2)),
    totalRatings: ratingCount,
  };
}