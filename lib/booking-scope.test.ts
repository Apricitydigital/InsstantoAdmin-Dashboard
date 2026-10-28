import assert from "node:assert/strict"
import { test } from "node:test"

import { INTERNAL_CUSTOMER_ID, isRealBookingRecord } from "./booking-scope"

const onboarded = new Set(["partner-1"])

test("real-booking scope includes unassigned pending records and onboarded partners", () => {
  assert.equal(isRealBookingRecord({ customer_id: { id: "customer-1" } }, onboarded), true)
  assert.equal(isRealBookingRecord({ customer_id: "customer/customer-1", provider_id: "customer/partner-1" }, onboarded), true)
})

test("real-booking scope excludes the internal customer and non-onboarded providers", () => {
  assert.equal(isRealBookingRecord({ customer_id: { id: INTERNAL_CUSTOMER_ID } }, onboarded), false)
  assert.equal(isRealBookingRecord({ customer_id: { id: "customer-1" }, provider_id: { id: "former-partner" } }, onboarded), false)
})
