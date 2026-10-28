import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isActiveBookingStatus,
  isAcceptedBookingStatus,
  isCancelledBookingStatus,
  isCompletedBookingStatus,
  isPendingBookingStatus,
  isRevenueEligibleBookingStatus,
  normalizeBookingStatus,
} from "./booking-status"

test("normalizes booking status separators and casing", () => {
  assert.equal(normalizeBookingStatus(" PendingOTP Created "), "pendingotp_created")
  assert.equal(normalizeBookingStatus("In-Progress"), "in_progress")
})

test("revenue includes every populated non-cancelled booking status", () => {
  for (const status of ["Pending", "PendingOTP_Created", "Accepted", "In_Progress", "Service_Completed"]) {
    assert.equal(isActiveBookingStatus(status), true, status)
    assert.equal(isRevenueEligibleBookingStatus(status), true, status)
  }
})

test("revenue excludes all cancellation variants and missing statuses", () => {
  for (const status of ["Cancelled", "Canceled", "Booking_Cancelled", "Cancelled_By_Partner", "partner-canceled"]) {
    assert.equal(isCancelledBookingStatus(status), true, status)
    assert.equal(isActiveBookingStatus(status), false, status)
    assert.equal(isRevenueEligibleBookingStatus(status), false, status)
  }
  assert.equal(isRevenueEligibleBookingStatus(""), false)
  assert.equal(isRevenueEligibleBookingStatus(undefined), false)
})

test("booking stat groups normalize casing and separators", () => {
  assert.equal(isPendingBookingStatus(" pending "), true)
  assert.equal(isAcceptedBookingStatus("ACCEPTED"), true)
  assert.equal(isAcceptedBookingStatus("Confirmed"), true)
  assert.equal(isCompletedBookingStatus("Service-Completed"), true)
  assert.equal(isCompletedBookingStatus("completed"), true)
  assert.equal(isPendingBookingStatus("OTP_Created"), false)
})
