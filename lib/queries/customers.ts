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
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

export interface CustomerStats {
  totalCustomers: number;
  customersWithOneBooking: number;
  customersWithMultipleBookings: number;
  newCustomersToday: number;
}

export async function fetchCustomerStats(
  fromDate: string,
  toDate: string
): Promise<CustomerStats> {
  const db = getFirestoreDb();

  // 📅 Convert date range
  const startDate = fromDate
    ? new Date(`${fromDate}T00:00:00Z`)
    : new Date(2025, 3, 1);
  const endDate = toDate
    ? new Date(`${toDate}T23:59:59Z`)
    : new Date();

  const fromTimestamp = Timestamp.fromDate(startDate);
  const toTimestamp = Timestamp.fromDate(endDate);

  // ✅ 1. Count customers quickly using Firestore aggregate
  const totalCustomersQuery = query(
    collection(db, "customer"),
    where("userType.customer", "==", true),
    where("created_time", ">=", fromTimestamp),
    where("created_time", "<=", toTimestamp)
  );
  const totalSnapshot = await getCountFromServer(totalCustomersQuery);
  const totalCustomers = totalSnapshot.data().count || 0;

  // ✅ 2. Collect customer IDs for booking analysis
  const customerSnapshot = await getDocs(totalCustomersQuery);
  const customerIds = customerSnapshot.docs.map((docSnap) => docSnap.id);
  if (customerIds.length === 0) {
    // If no customers, return zeroes immediately
    return {
      totalCustomers,
      customersWithOneBooking: 0,
      customersWithMultipleBookings: 0,
      newCustomersToday: 0,
    };
  }

  // ✅ 3. Batch booking queries in parallel (limit 10 IDs per query)
  const bookingCount: Record<string, number> = {};
  const batchQueries: Promise<any>[] = [];
  const batchSize = 10;

  for (let i = 0; i < customerIds.length; i += batchSize) {
    const batch = customerIds.slice(i, i + batchSize);
    const customerRefs = batch.map((id) => doc(db, "customer", id));

    const q = query(
      collection(db, "bookings"),
      where("status", "==", "Service_Completed"),
      where("customer_id", "in", customerRefs)
    );
    batchQueries.push(getDocs(q));
  }

  const batchResults = await Promise.all(batchQueries);

  // ✅ 4. Aggregate booking counts efficiently
  batchResults.forEach((snap) => {
    snap.forEach((docSnap: DocumentData) => {
      const data = docSnap.data();
      const customerRef = data.customer_id;
      if (customerRef?.id) {
        bookingCount[customerRef.id] =
          (bookingCount[customerRef.id] || 0) + 1;
      }
    });
  });

  let customersWithOneBooking = 0;
  let customersWithMultipleBookings = 0;
  Object.values(bookingCount).forEach((count) => {
    if (count === 1) customersWithOneBooking++;
    else if (count > 1) customersWithMultipleBookings++;
  });

  // ✅ 5. Count new customers created today (independent of filters)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todaySnapshot = await getCountFromServer(
    query(
      collection(db, "customer"),
      where("userType.customer", "==", true),
      where("created_time", ">=", Timestamp.fromDate(todayStart)),
      where("created_time", "<=", Timestamp.fromDate(todayEnd))
    )
  );

  const newCustomersToday = todaySnapshot.data().count || 0;

  return {
    totalCustomers,
    customersWithOneBooking,
    customersWithMultipleBookings,
    newCustomersToday,
  };
}