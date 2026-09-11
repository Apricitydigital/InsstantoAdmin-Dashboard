import assert from "node:assert/strict"
import { test } from "node:test"
import { initializeApp } from "firebase/app"
import { doc, getFirestore, Timestamp } from "firebase/firestore"
import { categoryPath, filterEvents, groupEvents, hubPath, parseEvent } from "./slot-unavailability"

test("telemetry parsing tolerates missing and malformed fields without inventing identities", () => {
  const event = parseEvent("event", { createdAt: Timestamp.fromMillis(1234), clientCreatedAt: "bad", diagnostics: { schedulesFetched: 3.9, leadTimeExcluded: "6", invalid: Infinity }, customerId: "ignored" })
  assert.equal(event.createdAt?.getTime(), 1234)
  assert.equal(event.clientCreatedAt, null)
  assert.equal(event.reasonCode, "unknown")
  assert.deepEqual(event.diagnostics, { schedulesFetched: 3, leadTimeExcluded: 0, invalid: 0 })
  assert.equal("customerId" in event, false)
  assert.deepEqual(parseEvent("empty", {}).diagnostics, {})
})

test("all dimension filters combine and nested hub IDs stay scoped to their city/category", () => {
  const a = parseEvent("a", { serviceCoverageCityId: "city-a", serviceCoverageCategoryId: "category", serviceHubId: "hub", subCategoryId: "service", reasonCode: "no_schedules_found", source: "reschedule", platform: "android" })
  const b = { ...a, id: "b", serviceCoverageCityId: "city-b" }
  const filters = { serviceCoverageCityId: "city-a", categoryPath: categoryPath(a), hubPath: hubPath(a), subCategoryId: "service", reasonCode: "no_schedules_found", source: "reschedule", platform: "android" }
  assert.deepEqual(filterEvents([a, b], filters).map(e => e.id), ["a"])
  assert.equal(filterEvents([a, b], { ...filters, platform: "ios" }).length, 0)
  assert.equal(filterEvents([a, b], {}).length, 2)
})

test("group summaries count occurrences, sum diagnostics, and retain the latest timestamp", () => {
  const a = parseEvent("a", { serviceCoverageCityId: "city-a", serviceCoverageCategoryId: "category", serviceHubId: "hub", subCategoryId: "service", reasonCode: "no_schedules_found", createdAt: Timestamp.fromMillis(2000), diagnostics: { schedulesFetched: 2, hubMismatchExcluded: 3, leadTimeExcluded: 4 } })
  const b = { ...a, id: "b", createdAt: new Date(1000) }
  const c = { ...a, id: "c", serviceCoverageCityId: "city-b" }
  const groups = groupEvents([c, a, b])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].count, 2)
  assert.equal(groups[0].schedules, 4)
  assert.equal(groups[0].mismatches, 6)
  assert.equal(groups[0].leadTime, 8)
  assert.equal(groups[0].last?.getTime(), 2000)
  assert.deepEqual(groups[0].reasons, { no_schedules_found: 2 })
})


test("customer references resolve to customer documents, with UID fallback for older writers", () => {
  const db = getFirestore(initializeApp({ projectId: "slot-availability-test" }, "slot-availability-test"))
  const ref = doc(db, "customer", "customer-123")
  assert.equal(parseEvent("reference", { customer_id: ref }).customerUid, "customer-123")
  assert.equal(parseEvent("reference", { customer_id: ref }).customerPath, "customer/customer-123")
  assert.equal(parseEvent("uid", { customerUid: "uid-only" }).customerPath, "customer/uid-only")
  assert.equal(parseEvent("both", { customer_id: ref, customerUid: "different" }).customerUid, "customer-123")
  assert.equal(parseEvent("wrong-collection", { customer_id: doc(db, "users", "admin") }).customerPath, "")
  assert.equal(parseEvent("invalid", { customerUid: "bad/path" }).customerPath, "")
  assert.equal(parseEvent("legacy", {}).customerUid, "")
})
