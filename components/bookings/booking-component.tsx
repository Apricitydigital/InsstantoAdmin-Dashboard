"use client"

import { useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  collection,
  doc,
  getDocs,
  query,
  onSnapshot,
  where
} from "firebase/firestore"

import { getFirestoreDb } from "@/lib/firebase"
import { Star } from "lucide-react"

// ----------------------------------------------------
// TYPES
// ----------------------------------------------------
interface DetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  customer: any;
  provider: any;
  services: string[];
}

type BookingReview = {
  id: string
  rating: number
  feedback: string
  reasons: string[]
  createdAt: Date | null
}

// ----------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------
export function DetailsSheet({
  open,
  onOpenChange,
  booking,
  customer,
  provider,
  services,
}: DetailsSheetProps) {

  const db = getFirestoreDb()

  const [detailData, setDetailData] = useState<any>(null)
  const [bookingDocument, setBookingDocument] = useState<any>(null)
  const [review, setReview] = useState<BookingReview | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  const [loading, setLoading] = useState(false)

  // ✅ image preview state (only addition)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // ----------------------------------------------------
  // FETCH START-TO-END DATA
  // ----------------------------------------------------
  useEffect(() => {
    if (!booking?.id || !open) return

    const bookingRef = doc(db, "bookings", booking.id)
    const unsub = onSnapshot(
      bookingRef,
      (snapshot) => {
        setBookingDocument(snapshot.exists() ? snapshot.data() : null)
      },
      (error) => {
        console.error("Realtime booking document error:", error)
        setBookingDocument(null)
      }
    )

    return () => unsub()
  }, [booking?.id, db, open])

  useEffect(() => {
    if (!booking?.id || !open) return

    setLoading(true)

    const bookingRef = doc(db, "bookings", booking.id)

    const q = query(
      collection(db, "bookingDetails_StartToEnd"),
      where("bookingId", "==", bookingRef)
    )

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          setDetailData(snapshot.docs[0].data())
        } else {
          setDetailData(null)
        }

        setLoading(false)
      },
      (error) => {
        console.error("Realtime details error:", error)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [booking?.id, db, open])

  useEffect(() => {
    if (!booking?.id || !open) return

    let active = true
    setReviewLoading(true)
    setReview(null)

    const bookingRef = doc(db, "bookings", booking.id)
    const reviews = collection(db, "reviews")

    Promise.all([
      getDocs(query(reviews, where("bookingId", "==", bookingRef))),
      getDocs(query(reviews, where("bookingId", "==", booking.id))),
    ])
      .then((snapshots) => {
        if (!active) return

        const reviewDocs = new Map(
          snapshots.flatMap((snapshot) => snapshot.docs).map((reviewDoc) => [reviewDoc.id, reviewDoc])
        )

        const linkedReviews = Array.from(reviewDocs.values())
          .map((reviewDoc): BookingReview => {
            const data = reviewDoc.data()
            const rawDate = data.createdAt ?? data.timestamp ?? data.date
            const createdAt = rawDate?.toDate?.() ??
              (rawDate ? new Date(rawDate) : null)

            return {
              id: reviewDoc.id,
              rating: Number(data.partnerRating ?? data.rating ?? 0),
              feedback: String(data.feedback ?? data.comment ?? ""),
              reasons: Array.isArray(data.partner_reasonOptions)
                ? data.partner_reasonOptions.map(String)
                : [],
              createdAt: createdAt instanceof Date && !Number.isNaN(createdAt.getTime())
                ? createdAt
                : null,
            }
          })
          .filter((item) => item.rating > 0 || item.feedback || item.reasons.length > 0)
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))

        setReview(linkedReviews[0] ?? null)
      })
      .catch((error) => {
        console.error("Booking review error:", error)
        if (active) setReview(null)
      })
      .finally(() => {
        if (active) setReviewLoading(false)
      })

    return () => {
      active = false
    }
  }, [booking?.id, db, open])



  // ----------------------------------------------------
  // RENDER
  // ----------------------------------------------------
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="
            max-w-xl 
            w-[92%] 
            rounded-xl 
            bg-white 
            shadow-2xl 
            p-6 
            max-h-[90vh] 
            overflow-y-auto
            animate-in fade-in-50 zoom-in-50
          "
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              Booking Details
            </DialogTitle>
            <DialogDescription>
              Full overview of this booking
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5 text-sm">

            {/* BASIC TEXT FIELDS */}
            <DetailBlock label="Booking ID" value={booking.id} />
            <DetailBlock label="Customer" value={`${customer?.name ?? "—"}\n${customer?.phone ?? ""}`} />
            {/* MAIN PARTNER */}
            <DetailBlock
              label="Partner"
              value={`${provider?.name ?? "—"}\n${provider?.phone ?? ""}`}
            />

            {/* PARTNERS WHO WENT ON SERVICE */}
            {booking?.ChoosePartner?.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Partners Went On Service
                </div>

                <div className="mt-2 space-y-2">
                  {booking.ChoosePartner.map((partnerName: string, index: number) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="font-medium">
                        {partnerName}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DetailBlock label="Services" value={services?.join(", ") || "Unknown"} />
            <DetailBlock label="Address" value={booking.bookingAddress || "—"} />
            <DetailBlock label="otp" value={booking.otp || "—"} />
            <DetailBlock label="Amount Paid" value={`₹${booking.amount_paid?.toLocaleString() || 0}`} />
            <DetailBlock
              label="Wallet Amount Used"
              value={`₹${booking.walletAmountUsed?.toLocaleString() || 0}`}
            />
            <DetailBlock label="Partner Fare" value={`₹${booking.partner_fare?.toLocaleString() || 0}`} />
            <DetailBlock label="Status" value={booking.status?.replace("_", " ")} />
            <DetailBlock
              label="Cancellation Reason"
              value={bookingDocument?.cancelReason ?? booking.cancelReason}
            />

            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Rating &amp; Review
              </div>
              {reviewLoading ? (
                <p className="mt-2 text-muted-foreground">Loading review...</p>
              ) : review ? (
                <div className="mt-2 rounded-lg border bg-amber-50/60 p-4">
                  <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={`size-5 ${
                          index < Math.round(review.rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                    <span className="ml-2 font-semibold text-gray-800">{review.rating.toFixed(1)}/5</span>
                  </div>
                  {review.feedback && (
                    <p className="mt-3 whitespace-pre-line text-gray-800">{review.feedback}</p>
                  )}
                  {review.reasons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {review.reasons.map((reason) => (
                        <span key={reason} className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 shadow-sm">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                  {review.createdAt && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Reviewed {review.createdAt.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-muted-foreground">No rating or review for this booking.</p>
              )}
            </div>



<DetailBlock
  label="Date"
  value={booking.date?.toDate?.().toLocaleString("en-IN")}
/>

<DetailBlock
  label="Time Slot"
  value={booking.timeSlot?.toDate?.().toLocaleString("en-IN")}
/>

<DetailBlock
  label="Start Time"
  value={booking.startTime?.toDate?.().toLocaleString("en-IN")}
/>

<DetailBlock
  label="End Time"
  value={booking.endTime?.toDate?.().toLocaleString("en-IN")}
/>
            <hr className="my-3 opacity-40" />

            {/* LOADING STATE */}
            {loading && (
              <p className="text-center text-muted-foreground">Loading service images...</p>
            )}

            {/* IF DATA EXISTS */}
            {!loading && detailData && (
              <div className="space-y-6">

                {/* PARTNER SELFIE */}
                {detailData.partnerSelfie && (
                  <div>
                    <h3 className="font-semibold">Partner Selfie</h3>
                    <img
                      src={detailData.partnerSelfie}
                      alt="partner selfie"
                      onClick={() => setPreviewImage(detailData.partnerSelfie)}
                      className="w-32 h-32 object-cover rounded-xl mt-2 border shadow-sm cursor-pointer hover:opacity-90"
                    />
                  </div>
                )}

                {/* SERVICE IMAGES */}
                {detailData.serviceImages?.length > 0 && (
                  <div className="space-y-6">

                    {/* BEFORE IMAGES */}
                    <div>
                      <h3 className="font-semibold mb-2">Before Service Images</h3>

                      {detailData.serviceImages.slice(0, 3).length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {detailData.serviceImages.slice(0, 3).map((img: string, i: number) => (
                            <img
                              key={i}
                              src={img}
                              alt={`before-${i}`}
                              onClick={() => setPreviewImage(img)}
                              className="w-full h-32 object-cover rounded-lg border shadow-sm cursor-pointer hover:opacity-90"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No before images available.</p>
                      )}
                    </div>

                    {/* AFTER IMAGE */}
                    <div>
                      <h3 className="font-semibold mb-2">After Service Image</h3>

                      {detailData.serviceImages.length > 3 ? (
                        <img
                          src={detailData.serviceImages[detailData.serviceImages.length - 1]}
                          alt="after"
                          onClick={() =>
                            setPreviewImage(
                              detailData.serviceImages[detailData.serviceImages.length - 1]
                            )
                          }
                          className="w-full h-40 object-cover rounded-lg border shadow-sm cursor-pointer hover:opacity-90"
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm">No after image available.</p>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* IF NO DATA */}
            {!loading && !detailData && (
              <p className="text-center text-muted-foreground">
                No start-to-end service records found for this booking.
              </p>
            )}

          </div>
        </DialogContent>
      </Dialog>

      {/* IMAGE PREVIEW DIALOG */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black border-none">
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="w-full max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ----------------------------------------------------
// SMALL DISPLAY BLOCK
// ----------------------------------------------------
function DetailBlock({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </div>

      <div className="mt-1 whitespace-pre-line text-gray-800">
        {value || "—"}
      </div>
    </div>
  )
}
