# Customer slot visit tracking — required customer-app changes

The regular customer slot screen now emits an immediate version-2 availability snapshot after loading. This records all seven searched dates even when only one date, such as today, has no availability. Existing version-1 counters do not contain dates, times, or an exit outcome. Never reconstruct historical availability from current schedules or label an old unavailable event as an abandoned booking.

## Customer screen behavior

- Create one stable `visitId` when entering the slot flow. Track the flow through checkout until confirmed booking or an explicit Back exit, not just disposal of the slot widget.
- Load every date in the displayed search range, including dates with no availability. Render all configured slot times for each date. Mark unavailable times disabled and prevent selection using the existing eligibility checks.
- Capture the actual display model after existing coverage, partner, status, and lead-time checks. A slot is available if at least one eligible partner can fulfill that time. A rejected partner must not disable another partner's valid slot. Preserve unavailable reasons and merge duplicate date/time options.
- Build disabled slots from the real configured times; do not invent times when there are no schedules or configured slots. Retain such dates with an empty `slots` array.
- Refresh the snapshot when visible availability changes and revalidate availability at booking submission. Keep the snapshot that was actually displayed, not a fresh schedule query after departure.
- Handle toolbar Back, system Back, and back gestures through one exit handler. Emit `back_unbooked` only when the flow is explicitly exited without a confirmed booking. Moving forward to checkout/payment is not abandonment. Reconcile any in-flight booking before recording an exit; payment cancellation alone is not proof that no booking exists.
- Emit `booked` only after the existing booking-success signal confirms completion. These are client-observed outcomes, not authoritative financial records.
- Queue the final event without blocking navigation. Retry using the same document ID (`visitId`) and frozen payload; do not create duplicate documents or modify a final event. Treat an existing matching final event as delivered.
- App backgrounding, crashes, or force-close must not be labeled `back_unbooked`. This final-event contract cannot observe those exits; tracking them needs a separate open-session lifecycle and reconciliation.

## Immediate availability snapshot (implemented for regular checkout)

The regular slot screen writes `slot_availability_snapshot` with outcome `viewed` as soon as the seven-day result loads. This is the record used for per-date availability. A stable generated `visitId` is used as the document ID. The separate final Back/booked outcome described below is still a follow-up producer change.

```javascript
{
  eventType: "slot_availability_snapshot",
  eventVersion: 2,
  outcome: "viewed",
  // Remaining identity, service, diagnostic and slotDays fields match below.
}
```

## Final event schema (not yet emitted)

Collection: `slot_unavailability_events` (shared with existing version-1 unavailable events).
For version 2, write one final document per visit using `visitId` as the document ID. Do not also emit version-1 unavailable occurrences for the same visit, or totals will double-count.

```javascript
{
  eventType: "slot_visit_ended",
  eventVersion: 2,
  visitId: "stable-unique-visit-id",
  createdAt: serverTimestamp(), // event finalization; admin date filter uses this
  clientCreatedAt: Timestamp, // client finalization time
  openedAt: Timestamp,
  snapshotAt: Timestamp, // when this display snapshot was captured
  outcome: "back_unbooked", // or "booked"
  timeZone: "Asia/Kolkata", // actual service timezone
  customer_id: DocumentReference("customer/{uid}"),
  customerUid: "uid",
  source: "checkout_regular", // checkout_monthly or reschedule also supported
  subCategoryId: "...",
  serviceCoverageCityId: "...",
  serviceCoverageCategoryId: "...",
  serviceHubId: "...",
  reasonCode: "unknown", // existing reason only if applicable; do not invent a failure when slots exist
  daysSearched: 7,
  platform: "android",
  diagnostics: {}, // retain existing counters
  slotDays: [
    { date: "2026-09-14", slots: [
      { label: "09:00 AM", available: false, reasonCode: "all_slots_inside_lead_time" },
      { label: "02:00 PM", available: true, reasonCode: "" }
    ] },
    { date: "2026-09-15", slots: [] }
    // Include every remaining date, with its actual slots, in the search range.
  ]
}
```

Keep the serialized document below Firestore's document-size limit. Send a compact merged display model, not raw partner/schedule documents. Do not silently truncate days or slots.

Deploy the root `firestore.rules` changes with the customer app rollout. Rules accept legacy v1 events and append-only v2 final visits. Customer identifiers must refer to the authenticated customer. No new composite index is needed.

## Acceptance checks in the customer app

1. Slots available on some/all dates + Back: exactly one `back_unbooked` event; snapshot contains every displayed date and enabled/disabled slot.
2. No availability on any date + Back: the same final event contract, with disabled/empty dates preserved.
3. Confirmed booking: exactly one `booked` event, never a Back event from route disposal.
4. Forward navigation, payment retry/cancel, and return to the selector do not prematurely finalize the visit.
5. Toolbar/system/gesture Back and repeated callbacks do not duplicate events. Offline retries use the same visit document.
6. Verify date boundaries, timezone, mixed-partner availability, and lead-time exclusions against what the customer actually sees.
7. Verify legacy v1 reads and old customer-app creates still work after rules deployment.
