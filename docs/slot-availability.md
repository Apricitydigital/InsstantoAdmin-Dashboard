# Slot Availability Issues

Open `/slot-availability` from the sidebar. Access uses the existing `analytics:view` permission (included for built-in admins and superadmins).

The page reads `slot_unavailability_events` occurrences. These count attempts, not unique customers. It resolves `customer_id` (a reference to `customer/{uid}`), falling back to `customerUid`, and displays the customer name, phone, email, and UID. Customer lookups share the document-path cache. Missing or inaccessible customer records do not prevent events from loading; legacy events without identity remain supported. Profile links use the existing customer-details permission. It performs no event, booking, schedule, partner, payment, or coverage writes.

The default period is the last seven calendar days including today, in the browser's timezone. Firestore queries use `createdAt >= start` and `createdAt < midnight after end`, ordered newest first. Reads use 100-document cursor batches. The entire range is read before showing summaries, so totals never represent an incomplete first page. Details paginate at 100 events per page. Large ranges will require proportionally more reads, time, and browser memory; narrow the range when needed.

City, category, hub, service, source, platform, and reason filters apply locally to the complete range. No composite index is required: the query uses Firestore's default descending single-field index on `createdAt`. Existing `firestore.indexes.json` is intentionally unchanged. Filter options reflect the selected range. Grouping includes the city/category path to avoid merging nested hubs that share an ID.

Display names use an in-memory document-path promise cache scoped to the mounted page and account. Deleted documents fall back to IDs; read failures surface an error and can be retried. Missing diagnostic counters display as “Not recorded” in details; unknown reason codes and diagnostic keys remain visible.

## Deployment

Deploy the dashboard through the project's normal process. The active rules file is root `firestore.rules`, as configured in `firebase.json`; `firebase/firestore.rules` is not used by that configuration.

The root rules add contract-validated creates (optional customer references and UIDs must identify the signed-in customer) for signed-in customer apps, analytics-authorized admin reads, and deny event updates/deletes. The existing broad superadmin write rule excludes this collection so it cannot override the append-only restriction. Deploy the rules using the existing Firebase project selection:

```sh
firebase deploy --only firestore:rules
```

Before rollout, verify in a Firebase test project that signed-in customers can create valid events, cannot read them, and admins with analytics access can read but cannot update/delete them. Confirm invalid creates are rejected, including from superadmins. Live rules deployment is separate from local code changes.

## Validation

```sh
npx tsx --test lib/queries/slot-unavailability.test.ts
npx tsc --noEmit --incremental false
npm run build
```
