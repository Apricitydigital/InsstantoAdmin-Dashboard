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
  where
} from "firebase/firestore"

import { getFirestoreDb } from "@/lib/firebase"

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
  const [loading, setLoading] = useState(false)

  // ✅ image preview state (only addition)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // ----------------------------------------------------
  // FETCH START-TO-END DATA
  // ----------------------------------------------------
  useEffect(() => {
    if (!booking?.id) return

    const fetchDetails = async () => {
      try {
        setLoading(true)

        const bookingRef = doc(db, "bookings", booking.id)

        const q = query(
          collection(db, "bookingDetails_StartToEnd"),
          where("bookingId", "==", bookingRef)
        )

        const snap = await getDocs(q)

        if (!snap.empty) {
          setDetailData(snap.docs[0].data())
        } else {
          setDetailData(null)
        }

      } catch (err) {
        console.error("Error loading details:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()
  }, [booking, db])

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
            <DetailBlock label="Partner" value={`${provider?.name ?? "—"}\n${provider?.phone ?? ""}`} />
            <DetailBlock label="Services" value={services?.join(", ") || "Unknown"} />
            <DetailBlock label="Address" value={booking.bookingAddress || "—"} />
            <DetailBlock label="otp" value={booking.otp || "—"} />
            <DetailBlock label="Amount Paid" value={`₹${booking.amount_paid?.toLocaleString() || 0}`} />
            <DetailBlock label="Partner Fare" value={`₹${booking.partner_fare?.toLocaleString() || 0}`} />
            <DetailBlock label="Status" value={booking.status?.replace("_", " ")} />

            <DetailBlock
              label="Date"
              value={booking.date?.toDate?.().toLocaleString("en-IN")}
            />

            <DetailBlock
              label="Time Slot"
              value={booking.timeSlot?.toDate?.().toLocaleString("en-IN")}
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
