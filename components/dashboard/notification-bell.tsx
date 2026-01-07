"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const db = getFirestoreDb();
  const router = useRouter();

  useEffect(() => {
    let bookingCount = 0;
    let complaintCount = 0;

    // 🔔 New bookings
    const bookingQuery = query(
      collection(db, "bookings"),
      where("bookingStatus", "==", "Pending")
    );

    // 🔔 New complaints
    const complaintQuery = query(
      collection(db, "customer_complain"),
      where("complaint_status", "==", "pending")
    );

    const unsubscribeBookings = onSnapshot(bookingQuery, (snapshot) => {
      bookingCount = snapshot.size;
      setCount(bookingCount + complaintCount);
    });

    const unsubscribeComplaints = onSnapshot(complaintQuery, (snapshot) => {
      complaintCount = snapshot.size;
      setCount(bookingCount + complaintCount);
    });

    return () => {
      unsubscribeBookings();
      unsubscribeComplaints();
    };
  }, []);

  return (
    <div
      className="relative cursor-pointer"
      title="Pending bookings or complaints"
      onClick={() => router.push("/admin/bookings")}
    >
      <Bell className="h-6 w-6 text-muted-foreground hover:text-primary transition" />

      {count > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
          {count}
        </Badge>
      )}
    </div>
  );
}
