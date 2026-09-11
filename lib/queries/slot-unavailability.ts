import { collection, DocumentReference, doc, getDoc, getDocs, limit, orderBy, query, startAfter, Timestamp, where, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"

export const REASONS: Record<string, string> = {
  no_schedules_found: "No schedules found",
  no_partner_for_selected_hub: "No partner in selected hub",
  all_schedules_unavailable: "All schedules unavailable",
  no_available_time_entries: "No available time entries",
  all_slots_inside_lead_time: "Lead-time restrictions",
  service_slots_disabled: "Monthly slots disabled",
  coverage_unavailable: "Coverage unavailable",
  no_slots_after_filters: "No slots after filters",
  unknown: "Unknown",
}
export const SOURCES: Record<string, string> = { checkout_regular: "Regular checkout", checkout_monthly: "Monthly / yearly checkout", reschedule: "Rescheduling" }
export const DIAGNOSTICS: Record<string, string> = {
  schedulesFetched: "Schedules fetched", scheduleStatusExcluded: "Unavailable schedules excluded",
  hubMismatchExcluded: "Hub mismatches excluded", hubEligibleSchedules: "Hub-eligible schedules",
  legacyGlobalSchedules: "Legacy global schedules", missingTimeslotExcluded: "Missing timeslots excluded",
  unavailableTimeEntries: "Unavailable time entries", availableTimeEntries: "Available time entries",
  leadTimeExcluded: "Entries removed by lead time", displayedSlotCandidates: "Displayed slot candidates",
  showSlotsDisabled: "Slots administratively disabled",
}
export interface SlotUnavailabilityEvent {
  customerUid: string; customerPath: string; customerName: string; customerPhone: string; customerEmail: string; customerStatus: string
  id: string; eventType: string; eventVersion: number; createdAt: Date | null; clientCreatedAt: Date | null
  source: string; subCategoryId: string; serviceCoverageCityId: string; serviceCoverageCategoryId: string
  serviceHubId: string; reasonCode: string; platform: string; daysSearched: number; diagnostics: Record<string, number>
  cityName: string; categoryName: string; categoryId: string; hubName: string; serviceName: string
}
const string = (value: unknown) => typeof value === "string" ? value : ""
const integer = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0
const date = (value: unknown) => value instanceof Timestamp ? value.toDate() : null
export function customerIdentity(data: DocumentData) {
  const reference = data.customer_id
  const path = reference instanceof DocumentReference && /^customer\/[^/]+$/.test(reference.path) ? reference.path : ""
  const uid = string(data.customerUid)
  // The document reference is authoritative; UID supports events without a reference.
  const customerPath = path || (uid && !uid.includes("/") ? "customer/" + uid : "")
  return { customerPath, customerUid: customerPath.split("/")[1] || "" }
}
export function parseEvent(id: string, data: DocumentData): SlotUnavailabilityEvent {
  const diagnostics: Record<string, number> = {}
  if (data.diagnostics && typeof data.diagnostics === "object" && !Array.isArray(data.diagnostics)) {
    for (const [key, value] of Object.entries(data.diagnostics)) diagnostics[key] = integer(value)
  }
  return {
    ...customerIdentity(data), customerName: "", customerPhone: "", customerEmail: "", customerStatus: "Not recorded",
    id, eventType: string(data.eventType), eventVersion: integer(data.eventVersion),
    createdAt: date(data.createdAt), clientCreatedAt: date(data.clientCreatedAt),
    source: string(data.source), subCategoryId: string(data.subCategoryId),
    serviceCoverageCityId: string(data.serviceCoverageCityId), serviceCoverageCategoryId: string(data.serviceCoverageCategoryId),
    serviceHubId: string(data.serviceHubId), reasonCode: string(data.reasonCode) || "unknown",
    platform: string(data.platform), daysSearched: integer(data.daysSearched), diagnostics,
    cityName: "", categoryName: "", categoryId: "", hubName: "", serviceName: "",
  }
}
export type EventFilters = Partial<Record<"serviceCoverageCityId" | "categoryPath" | "hubPath" | "subCategoryId" | "reasonCode" | "source" | "platform", string>>
export const categoryPath = (e: SlotUnavailabilityEvent) => `${e.serviceCoverageCityId}/${e.serviceCoverageCategoryId}`
export const hubPath = (e: SlotUnavailabilityEvent) => `${categoryPath(e)}/${e.serviceHubId}`
export function filterEvents(events: SlotUnavailabilityEvent[], filters: EventFilters) {
  return events.filter(e => Object.entries(filters).every(([key, value]) => !value ||
    (key === "categoryPath" ? categoryPath(e) : key === "hubPath" ? hubPath(e) : e[key as keyof SlotUnavailabilityEvent]) === value))
}
export function groupEvents(events: SlotUnavailabilityEvent[]) {
  const groups = new Map<string, { key: string; event: SlotUnavailabilityEvent; count: number; reasons: Record<string, number>; last: Date | null; schedules: number; mismatches: number; leadTime: number }>()
  for (const event of events) {
    const key = `${hubPath(event)}/${event.subCategoryId}`
    const group = groups.get(key) || { key, event, count: 0, reasons: {}, last: null, schedules: 0, mismatches: 0, leadTime: 0 }
    group.count++
    group.reasons[event.reasonCode] = (group.reasons[event.reasonCode] || 0) + 1
    if (event.createdAt && (!group.last || event.createdAt > group.last)) group.last = event.createdAt
    group.schedules += event.diagnostics.schedulesFetched || 0
    group.mismatches += event.diagnostics.hubMismatchExcluded || 0
    group.leadTime += event.diagnostics.leadTimeExcluded || 0
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count)
}

// Scoped to the mounted page/user. Cache promises too, to deduplicate concurrent reads.
export class SlotUnavailabilityRepository {
  private names = new Map<string, Promise<DocumentData>>()
  private lookup(path: string): Promise<DocumentData> {
    let pending = this.names.get(path)
    if (!pending) {
      pending = getDoc(doc(getFirestoreDb(), path)).then(s => s.data() || {}).catch(error => {
        this.names.delete(path)
        throw error
      })
      this.names.set(path, pending)
    }
    return pending
  }
  private async resolve(event: SlotUnavailabilityEvent) {
    const valid = (id: string) => Boolean(id) && !id.includes("/")
    const cityPath = valid(event.serviceCoverageCityId) ? `service_coverage/${event.serviceCoverageCityId}` : ""
    const category = cityPath && valid(event.serviceCoverageCategoryId) ? `${cityPath}/Categories/${event.serviceCoverageCategoryId}` : ""
    const hub = category && valid(event.serviceHubId) ? `${category}/service_hubs/${event.serviceHubId}` : ""
    const service = valid(event.subCategoryId) ? `service_subcategories/${event.subCategoryId}` : ""
    const [c, cat, h, s] = await Promise.all([cityPath, category, hub, service].map(path => path ? this.lookup(path) : Promise.resolve({} as DocumentData)))
    let customer: DocumentData = {}
    let customerStatus = "Not recorded"
    if (event.customerPath) {
      try {
        customer = await this.lookup(event.customerPath)
        customerStatus = Object.keys(customer).length ? "Available" : "Customer record not found"
      } catch {
        // A restricted or deleted customer must not hide the availability event.
        customerStatus = "Customer details unavailable"
      }
    }
    return { ...event,
      customerName: string(customer.display_name) || string(customer.customer_name) || string(customer.name),
      customerPhone: string(customer.phone_number) || (typeof customer.contact_no === "number" ? String(customer.contact_no) : string(customer.contact_no)),
      customerEmail: string(customer.email), customerStatus,
      cityName: string(c.cityName) || event.serviceCoverageCityId || "Unresolved city",
      categoryName: string(cat.categoryName) || event.serviceCoverageCategoryId || "Unresolved category",
      categoryId: string(cat.categoryId) || string(cat.categoryId?.id),
      hubName: string(h.hubName) || event.serviceHubId || "Unresolved hub",
      serviceName: [s.name, s.title, s.categoryName, s.subcategoryName, s.itemName, s.optionName, s.service_name].find(v => typeof v === "string" && v.trim()) || event.subCategoryId || "Unresolved service" }
  }
  async fetchPage(from: Date, to: Date, cursor?: QueryDocumentSnapshot<DocumentData>) {
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) throw new Error("Select a valid date range")
    // Only a date query: all other filters run over the complete range in memory,
    // keeping summaries accurate without combinatorial composite indexes.
    const constraints = [where("createdAt", ">=", Timestamp.fromDate(from)), where("createdAt", "<", Timestamp.fromDate(to)), orderBy("createdAt", "desc")]
    const snapshot = await getDocs(query(collection(getFirestoreDb(), "slot_unavailability_events"), ...constraints, ...(cursor ? [startAfter(cursor)] : []), limit(100)))
    const events = await Promise.all(snapshot.docs.map(d => this.resolve(parseEvent(d.id, d.data()))))
    return { events, cursor: snapshot.docs.at(-1), hasMore: snapshot.size === 100 }
  }
}
