"use client";

import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  QueryConstraint,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { fetchCustomerBookingCohorts } from "@/lib/queries/customer-cohorts";
import { getOnboardedPartnerIds } from "@/lib/queries/partners";

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
  const cohorts = await fetchCustomerBookingCohorts(fromDate || "", toDate || "");

  /* -------------------------------------------------------------------------- */
  /*                          2. Fetch partner ratings                           */
  /* -------------------------------------------------------------------------- */

  const reviewsCol = collection(db, "reviews");

  let totalRating = 0;
  let ratingCount = 0;

  const partnerIdChunks = chunkArray(await getOnboardedPartnerIds(db), 30);

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
    newCustomerCount: cohorts.newCustomerCount,
    repeatCustomerCount: cohorts.repeatCustomerCount,
    averageRating: Number(averageRating.toFixed(2)),
    totalRatings: ratingCount,
  };
}
