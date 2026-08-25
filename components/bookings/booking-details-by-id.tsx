"use client"

import { useEffect, useState } from "react"
import {
  collection,
  doc,
  DocumentData,
  DocumentReference,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore"

import { DetailsSheet } from "@/components/bookings/booking-component"
import { getFirestoreDb } from "@/lib/firebase"

type PartyInfo = { name?: string; phone?: string }

interface BookingDetailsByIdProps {
  bookingId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function isDocumentReference(
  value: unknown
): value is DocumentReference<DocumentData> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "path" in value &&
      typeof (value as { path?: unknown }).path === "string"
  )
}

async function getParty(
  reference: unknown
): Promise<PartyInfo> {
  if (!isDocumentReference(reference)) return {}

  const snapshot = await getDoc(reference)
  if (!snapshot.exists()) return {}

  const data = snapshot.data()
  return {
    name:
      data.customer_name ||
      data.partner_name ||
      data.display_name ||
      data.name,
    phone:
      data.phone_number ||
      data.contact_no ||
      data.mobile_number,
  }
}

export function BookingDetailsById({
  bookingId,
  open,
  onOpenChange,
}: BookingDetailsByIdProps) {
  const db = getFirestoreDb()
  const [booking, setBooking] = useState<any>(null)
  const [customer, setCustomer] = useState<PartyInfo>({})
  const [provider, setProvider] = useState<PartyInfo>({})
  const [services, setServices] = useState<string[]>([])

  useEffect(() => {
    if (!open || !bookingId) return

    let active = true
    setBooking({ id: bookingId })
    setCustomer({})
    setProvider({})
    setServices([])

    const loadBooking = async () => {
      try {
        let bookingSnapshot = await getDoc(doc(db, "bookings", bookingId))

        if (!bookingSnapshot.exists()) {
          const matchingBookings = await getDocs(
            query(
              collection(db, "bookings"),
              where("bookingId", "==", bookingId),
              limit(1)
            )
          )
          bookingSnapshot = matchingBookings.docs[0]
        }

        if (!bookingSnapshot?.exists() || !active) return

        const data = bookingSnapshot.data()
        const loadedBooking = { id: bookingSnapshot.id, ...data }
        setBooking(loadedBooking)

        const [loadedCustomer, loadedProvider] = await Promise.all([
          getParty(data.customer_id),
          getParty(data.provider_id),
        ])

        const cartReferences = Array.isArray(data.subCategoryCart_id)
          ? data.subCategoryCart_id
          : data.subCategoryCart_id
            ? [data.subCategoryCart_id]
            : []

        const cartSnapshots = await Promise.all(
          cartReferences.map((cartReference: unknown) =>
            getDocs(
              query(
                collection(db, "cart"),
                where("subCategoryCartId", "==", cartReference)
              )
            )
          )
        )

        if (!active) return

        setCustomer(loadedCustomer)
        setProvider(loadedProvider)
        setServices(
          Array.from(
            new Set(
              cartSnapshots.flatMap((snapshot) =>
                snapshot.docs.map((cartDocument) => {
                  const cartData = cartDocument.data()
                  return String(
                    cartData.service_name ||
                      cartData.serviceName ||
                      "Unknown Service"
                  )
                })
              )
            )
          )
        )
      } catch (error) {
        console.error("Unable to load complaint booking details:", error)
      }
    }

    void loadBooking()
    return () => {
      active = false
    }
  }, [bookingId, db, open])

  if (!bookingId || !booking) return null

  return (
    <DetailsSheet
      open={open}
      onOpenChange={onOpenChange}
      booking={booking}
      customer={customer}
      provider={provider}
      services={services}
    />
  )
}
