import { NextRequest, NextResponse } from "next/server"
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore, FieldValue, Timestamp, DocumentReference } from "firebase-admin/firestore"

export const runtime = "nodejs"

// Requires server-only FIREBASE_PROJECT_ID / GOOGLE_APPLICATION_CREDENTIALS
// (or another Firebase Admin credential initialization in your existing app).
function adminDb() {
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID })
  return getFirestore()
}

const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status })
const amount = (value: unknown) => {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid monetary amount")
  return n
}
const millis = (value: unknown) => {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Booking slot/date is missing")
  return n
}

interface RazorpayPayment {
  id: string
  order_id: string
  status: string
  amount: number
  currency: string
}

async function verifiedCapturedPayment(orderId: string, expectedPaise: number): Promise<RazorpayPayment> {
  const key = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!key || !secret) throw new Error("Razorpay server credentials are missing")
  const auth = Buffer.from(`${key}:${secret}`).toString("base64")
  const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: { Authorization: `Basic ${auth}` }, cache: "no-store",
  })
  if (!res.ok) throw new Error(`Razorpay verification failed (${res.status})`)
  const body = await res.json() as { items?: RazorpayPayment[] }
  const eligible = (body.items || []).filter((p) =>
    p.order_id === orderId && p.status === "captured" &&
    p.currency === "INR" && p.amount === expectedPaise,
  )
  if (eligible.length !== 1) throw new Error("Exactly one matching captured INR payment was not found. Check Razorpay before recovery.")
  return eligible[0]
}

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get("authorization") || ""
    if (!header.startsWith("Bearer ")) return jsonError("Admin login required", 401)
    const db = adminDb()
    const user = await getAuth().verifyIdToken(header.slice(7), true)
    // IMPORTANT: Only server-controlled Firebase custom claims grant recovery permission.
    // Adapt this to your existing admin-role system before deployment if claims differ.
    if (user.admin !== true && user.role !== "admin" && user.role !== "super_admin") {
      return jsonError("Not authorized to recover bookings", 403)
    }
    const input = await request.json() as { collectionName?: string; pendingId?: string }
    const source = input.collectionName
    const id = input.pendingId
    if (source !== "pending_bookings" && source !== "web_pending_bookings") return jsonError("Invalid booking source", 400)
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(id)) return jsonError("Invalid booking ID", 400)

    const pendingRef = db.collection(source).doc(id)
    const bookingRef = db.collection("bookings").doc(id)
    const serviceRef = db.collection("service_request").doc(id)
    const spendRef = db.collection("credits_spend_record").doc(id)
    const pendingSnap = await pendingRef.get()
    if (!pendingSnap.exists) return jsonError("Pending booking not found", 404)
    const pending = pendingSnap.data() || {}
    const b = pending.bookingData || {}
    const customerUid = pending.customerUid
    const orderId = pending.razorpayOrderId
    if (typeof customerUid !== "string" || !customerUid) return jsonError("Customer UID missing", 422)
    if (typeof orderId !== "string" || !orderId) return jsonError("Razorpay order ID missing", 422)
    if (typeof b.subCategoryCartId !== "string" || !b.subCategoryCartId.startsWith("sub_categoryCart/")) {
      return jsonError("Invalid subCategoryCartId; check actual collection path", 422)
    }
    // Pending booking can exist with ORDER_CREATED but without a successful payment.
    // Always verify Razorpay server-to-server, never trust browser-supplied payment status.
    const expectedPaise = Number(pending.expectedAmountPaise ?? Math.round(amount(pending.expectedOnlineAmount ?? b.amount) * 100))
    if (!Number.isSafeInteger(expectedPaise) || expectedPaise <= 0) return jsonError("Invalid expected payment amount", 422)
    const payment = await verifiedCapturedPayment(orderId, expectedPaise)
    const customerRef = db.collection("customer").doc(customerUid)
    const subCartRef = db.doc(b.subCategoryCartId)
    const bookingDate = millis(b.bookingDateMillis)
    const slotDate = millis(b.slotDateTimeMillis)
    const walletUsed = amount(b.walletAmount)
    const cartQuery = db.collection("cart")
      .where("cartStatus", "==", "Unpaid")
      .where("customer_id", "==", customerRef)
      .where("subCategoryCartId", "==", subCartRef)

    // Resolve optional wallet before transaction; re-read inside transaction.
    let walletRef: DocumentReference | null = null
    if (walletUsed > 0) {
      const wallets = await db.collection("partner_overall_credits")
        .where("service_partner_id", "==", customerRef)
        .where("user_type.customer", "==", true)
        .limit(1).get()
      if (wallets.empty) return jsonError("Customer wallet not found", 422)
      walletRef = wallets.docs[0].ref
    }

    const result = await db.runTransaction(async (tx) => {
      // Firestore transaction: all reads before any write.
      const pendingNow = await tx.get(pendingRef)
      const existingBooking = await tx.get(bookingRef)
      const existingRequest = await tx.get(serviceRef)
      const existingSpend = await tx.get(spendRef)
      const subCart = await tx.get(subCartRef)
      const customer = await tx.get(customerRef)
      const cartItems = await tx.get(cartQuery)
      const wallet = walletRef ? await tx.get(walletRef) : null
      if (!pendingNow.exists || !customer.exists) throw new Error("Pending booking or customer no longer exists")
      const latest = pendingNow.data() || {}
      if (latest.razorpayOrderId !== orderId || JSON.stringify(latest.bookingData) !== JSON.stringify(b)) {
        throw new Error("Pending booking changed during verification; refresh and retry")
      }
      if (existingBooking.exists) return { alreadyExists: true, bookingId: id }
      if (latest.status === "BOOKING_CREATED" || existingRequest.exists || existingSpend.exists) {
        throw new Error("Partial booking records already exist. Manual reconciliation required; refusing duplicate writes")
      }
      if (!subCart.exists || subCart.get("cartStatus") !== "Unpaid") throw new Error("Subcategory cart unavailable or already paid")
      if (cartItems.empty) throw new Error("No matching unpaid cart items; inspect original booking before recovery")
      if (walletRef && (!wallet?.exists || amount(wallet.get("credit_balance")) < walletUsed)) {
        throw new Error("Customer wallet balance insufficient or missing")
      }
      // Field mapping based on supplied createBookingFromPending(), preserving its schema.
      tx.create(bookingRef, {
        customer_id: customerRef, status: "Pending",
        payment_id: payment.id, razorpay_order_id: payment.order_id,
        payment_type: "Razorpay", payment_status: payment.status,
        amount_paid: amount(b.amount), finalPaidAmount: amount(b.finalPaidAmount),
        taxAmount: amount(b.taxAmt), walletAmountUsed: walletUsed,
        credits: amount(b.credits), tipAdded: amount(b.tip),
        service_id: b.serviceId || null, subCategoryId: b.subCategoryId || "",
        subCategoryCart_id: subCartRef, service_credits: amount(b.serviceCredits),
        totalservice_price: amount(b.totalservicePrice), partner_fare: amount(b.partnerFare),
        totalchemicalUsedInML: amount(b.chemicals1),
        booking_date: Timestamp.fromMillis(bookingDate), date: FieldValue.serverTimestamp(),
        booking_time: b.time || "", timeSlot: Timestamp.fromMillis(slotDate),
        bookingAddress: b.address || "", city: b.city || "Indore",
        bookingLat: b.bookingLat ?? null, bookingLng: b.bookingLng ?? null,
        bookingGeoSaved: b.bookingLat != null && b.bookingLng != null,
        bookingGeoAddress: b.address || "", coupon_used: b.couponUsed || "",
        discount_amount: amount(b.discountAmount),
        ...(b.carType ? { cartype: b.carType } : {}),
        // Do not hardcode an unrelated hub. Keep only an existing verified value.
        ...(typeof b.nearestHub_customer === "string" ? { nearestHub_customer: b.nearestHub_customer } : {}),
        createdAt: FieldValue.serverTimestamp(),
      })
      tx.create(serviceRef, {
        bookingId: bookingRef, bookingId_ref: bookingRef, bookingIdString: id,
        customerId: customerRef, bookingAddress: b.address || "", city: b.city || "Indore",
        service_credits: amount(b.serviceCredits),
        bookingLat: b.bookingLat ?? null, bookingLng: b.bookingLng ?? null,
        bookingGeoSaved: b.bookingLat != null && b.bookingLng != null,
        createdAt: FieldValue.serverTimestamp(),
      })
      for (const item of cartItems.docs) tx.update(item.ref, { cartStatus: "Paid", bookingCreationDate: FieldValue.serverTimestamp() })
      tx.update(subCartRef, { cartStatus: "Paid", paidAt: FieldValue.serverTimestamp() })
      if (walletRef && wallet) {
        tx.update(walletRef, { credit_balance: amount(wallet.get("credit_balance")) - walletUsed, updatedAt: FieldValue.serverTimestamp() })
        tx.create(spendRef, { partnerId: customerRef, credits_spent: walletUsed, spend_date: FieldValue.serverTimestamp(), user_type: { customer: true }, bookingId: bookingRef })
      }
      tx.update(pendingRef, {
        status: "BOOKING_CREATED", paymentStatus: "captured", razorpayPaymentId: payment.id,
        bookingId: bookingRef, bookingCreatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        recoverySource: "ADMIN", recoveredBy: user.uid, recoveredAt: FieldValue.serverTimestamp(),
      })
      return { alreadyExists: false, bookingId: id }
    })
    return NextResponse.json({ ...result, message: result.alreadyExists ? "Booking already exists; no duplicate was created." : "Payment verified; booking recovered successfully." })
  } catch (error) {
    console.error("Admin recovery error", error)
    return jsonError(error instanceof Error ? error.message : "Recovery failed", 422)
  }
}
