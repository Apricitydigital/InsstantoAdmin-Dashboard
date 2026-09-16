import type { SlotUnavailabilityEvent } from "@/lib/queries/slot-unavailability"

export function SlotVisitSnapshot({ event }: { event: SlotUnavailabilityEvent }) {
  return <section className="space-y-3 rounded-lg border p-4" aria-label="Slots shown to customer">
    <h3 className="font-semibold">Dates and slots shown to the customer</h3>
    <p className="text-xs text-muted-foreground">Historical snapshot{event.timeZone ? ` (${event.timeZone})` : ""}. Available slots are highlighted; unavailable slots are disabled. This view does not make a booking.</p>
    {!event.slotDays.length ? <p className="text-sm text-muted-foreground">No slot snapshot was recorded for this event. Historical dates and availability cannot be reconstructed from the diagnostic counters.</p> : event.slotDays.map((day, index) => <div key={`${day.date}-${index}`} className="space-y-2 border-t pt-3">
      <h4 className="text-sm font-semibold">{day.date}</h4>
      {day.reasonCode && <p className="text-xs text-amber-700">{day.reasonCode.replaceAll("_", " ")}</p>}
      {!day.slots.length ? <p className="text-sm text-muted-foreground">No configured slots were available for this date.</p> : <div className="flex flex-wrap gap-2">{day.slots.map((slot, slotIndex) => slot.available === true ?
        <span key={slotIndex} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{slot.label}<span className="block text-xs">Available</span></span> :
        <button key={slotIndex} type="button" disabled className="cursor-not-allowed rounded-md border bg-muted px-3 py-2 text-left text-sm text-muted-foreground" aria-label={`${slot.label}: ${slot.available === false ? "Unavailable" : "Availability not recorded"}`}>
          {slot.label}<span className="block text-xs">{slot.available === false ? "Unavailable" : "Availability not recorded"}{slot.reasonCode ? ` (${slot.reasonCode.replaceAll("_", " ")})` : ""}</span>
        </button>)}</div>}
    </div>)}
  </section>
}
