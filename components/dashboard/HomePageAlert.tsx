"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  limit,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { getFirestoreDb } from "@/lib/firebase";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Calendar,
  MessageSquareWarning,
  Star,
  AlertTriangle,
  ArrowRight,
  Clock,
} from "lucide-react";

type AlertItem = {
  id: string;
  title: string;
  subtitle: string;
  createdAt?: Date | null;
};

function formatTimeAgo(date?: Date | null) {
  if (!date) return "Time not available";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

function getTimestampDate(value: any): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value?.toDate) return value.toDate();
  return null;
}

export default function HomePageAlert() {
  const db = getFirestoreDb();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [bookings, setBookings] = useState(0);
  const [complaints, setComplaints] = useState(0);
  const [reviews, setReviews] = useState(0);

  const [latestBookings, setLatestBookings] = useState<AlertItem[]>([]);
  const [latestComplaints, setLatestComplaints] = useState<AlertItem[]>([]);
  const [latestReviews, setLatestReviews] = useState<AlertItem[]>([]);

  useEffect(() => {
    let bookingCount = 0;
    let complaintCount = 0;
    let reviewCount = 0;

    const openIfNeeded = () => {
      if (bookingCount > 0 || complaintCount > 0 || reviewCount > 0) {
        setOpen(true);
      }
    };

    const bookingQuery = query(
      collection(db, "bookings"),
      where("bookingStatus", "==", "Pending"),
      limit(10)
    );

    const complaintQuery = query(
      collection(db, "customer_complain"),
      where("complaint_status", "in", ["pending", "Open"]),
      limit(10)
    );

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const reviewQuery = query(
      collection(db, "reviews"),
      where("createdAt", ">=", Timestamp.fromDate(startOfToday)),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubBookings = onSnapshot(bookingQuery, (snap) => {
      bookingCount = snap.size;
      setBookings(bookingCount);

      const items = snap.docs.slice(0, 5).map((doc) => {
        const data = doc.data() as any;

        const createdAt =
          getTimestampDate(data.createdAt) ||
          getTimestampDate(data.created_time) ||
          getTimestampDate(data.date);

        return {
          id: doc.id,
          title:
            data.bookingId ||
            data.booking_id ||
            data.serviceName ||
            "Pending booking",
          subtitle:
            data.customerName ||
            data.customer_name ||
            data.customerPhone ||
            data.phone_number ||
            "Customer details not available",
          createdAt,
        };
      });

      setLatestBookings(items);
      openIfNeeded();
    });

    const unsubComplaints = onSnapshot(complaintQuery, (snap) => {
      complaintCount = snap.size;
      setComplaints(complaintCount);

      const items = snap.docs.slice(0, 5).map((doc) => {
        const data = doc.data() as any;

        const createdAt =
          getTimestampDate(data.createdAt) ||
          getTimestampDate(data.created_time);

        return {
          id: doc.id,
          title:
            data.complaintTitle ||
            data.subject ||
            data.reason ||
            "Open complaint",
          subtitle:
            data.customerName ||
            data.customer_name ||
            data.phone_number ||
            data.description ||
            "Complaint details not available",
          createdAt,
        };
      });

      setLatestComplaints(items);
      openIfNeeded();
    });

    const unsubReviews = onSnapshot(reviewQuery, (snap) => {
      reviewCount = snap.size;
      setReviews(reviewCount);

      const items = snap.docs.slice(0, 5).map((doc) => {
        const data = doc.data() as any;

        const createdAt = getTimestampDate(data.createdAt);

        return {
          id: doc.id,
          title:
            data.rating !== undefined
              ? `${data.rating} star review`
              : "New review",
          subtitle:
            data.review ||
            data.comment ||
            data.feedback ||
            data.customerName ||
            "Review details not available",
          createdAt,
        };
      });

      setLatestReviews(items);
      openIfNeeded();
    });

    return () => {
      unsubBookings();
      unsubComplaints();
      unsubReviews();
    };
  }, [db]);

  const totalAlerts = bookings + complaints + reviews;

  const highestPriority = useMemo(() => {
    if (complaints > 0) {
      return {
        label: "High priority",
        message: `${complaints} complaint${complaints > 1 ? "s" : ""} need attention.`,
        color: "destructive" as const,
      };
    }

    if (bookings > 0) {
      return {
        label: "Action required",
        message: `${bookings} pending booking${bookings > 1 ? "s" : ""} need confirmation.`,
        color: "default" as const,
      };
    }

    if (reviews > 0) {
      return {
        label: "New activity",
        message: `${reviews} new review${reviews > 1 ? "s" : ""} received today.`,
        color: "secondary" as const,
      };
    }

    return null;
  }, [bookings, complaints, reviews]);

  if (totalAlerts === 0) {
    return null;
  }

  const alertCards = [
    {
      key: "bookings",
      title: "Pending Bookings",
      count: bookings,
      icon: Calendar,
      iconClass: "text-blue-600",
      bgClass: "bg-blue-50",
      borderClass: "border-blue-200",
      items: latestBookings,
      actionLabel: "View bookings",
      path: "/bookings",
    },
    {
      key: "complaints",
      title: "Pending Complaints",
      count: complaints,
      icon: MessageSquareWarning,
      iconClass: "text-red-600",
      bgClass: "bg-red-50",
      borderClass: "border-red-200",
      items: latestComplaints,
      actionLabel: "View complaints",
      path: "/complaints",
    },
    {
      key: "reviews",
      title: "New Reviews Today",
      count: reviews,
      icon: Star,
      iconClass: "text-yellow-600",
      bgClass: "bg-yellow-50",
      borderClass: "border-yellow-200",
      items: latestReviews,
      actionLabel: "View reviews",
      path: "/reviews",
    },
  ].filter((item) => item.count > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Dashboard Notifications
              </DialogTitle>

              <DialogDescription className="mt-1">
                You have {totalAlerts} active dashboard notification
                {totalAlerts > 1 ? "s" : ""} that may need attention.
              </DialogDescription>
            </div>

            {highestPriority && (
              <Badge variant={highestPriority.color}>
                {highestPriority.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {highestPriority && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            <div className="font-semibold">Recommended focus</div>
            <div className="mt-1">{highestPriority.message}</div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-muted-foreground">Pending Bookings</div>
            <div className="mt-1 text-2xl font-bold">{bookings}</div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-muted-foreground">
              Pending Complaints
            </div>
            <div className="mt-1 text-2xl font-bold text-red-600">
              {complaints}
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-muted-foreground">
              New Reviews Today
            </div>
            <div className="mt-1 text-2xl font-bold">{reviews}</div>
          </div>
        </div>

        <div className="space-y-4">
          {alertCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.key}
                className={`rounded-xl border ${card.borderClass} ${card.bgClass} p-4`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-white p-2 shadow-sm">
                      <Icon className={`h-5 w-5 ${card.iconClass}`} />
                    </div>

                    <div>
                      <div className="font-semibold">{card.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Latest {Math.min(card.items.length, 5)} records shown
                      </div>
                    </div>
                  </div>

                  <div className="text-2xl font-bold">{card.count}</div>
                </div>

                {card.items.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {card.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border bg-white/80 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {item.title}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {item.subtitle}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(item.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      router.push(card.path);
                    }}
                  >
                    {card.actionLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}