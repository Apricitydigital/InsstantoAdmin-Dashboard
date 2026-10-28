import assert from "node:assert/strict"
import { test } from "node:test"

import { classifyCustomerBookingCohorts } from "./customer-cohorts"

const event = (customerId: string, date: string) => ({
  customerId,
  date: new Date(`${date}T12:00:00+05:30`),
})

test("selected periods classify by whether the first-ever booking precedes the period", () => {
  const result = classifyCustomerBookingCohorts([
    event("first-this-month", "2026-10-03"),
    event("first-this-month", "2026-10-18"),
    event("returning", "2026-09-20"),
    event("returning", "2026-10-10"),
    event("inactive-this-month", "2026-09-25"),
  ], "2026-10-01", "2026-10-31")

  assert.deepEqual(result, { newCustomerCount: 1, repeatCustomerCount: 1, isOverall: false })
})

test("overall periods use one booking versus more than one since April 1 2025", () => {
  const result = classifyCustomerBookingCohorts([
    event("one-booking", "2025-04-02"),
    event("repeat", "2025-05-01"),
    event("repeat", "2026-01-01"),
    event("before-reporting-start", "2025-03-31"),
  ], "2025-04-01", "2026-10-28")

  assert.deepEqual(result, { newCustomerCount: 1, repeatCustomerCount: 1, isOverall: true })
})
