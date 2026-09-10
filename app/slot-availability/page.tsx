"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import { categoryPath, DIAGNOSTICS, filterEvents, groupEvents, hubPath, REASONS, SlotUnavailabilityRepository, SOURCES, type EventFilters, type SlotUnavailabilityEvent } from "@/lib/queries/slot-unavailability"
import { Loader2, RefreshCw } from "lucide-react"

function localDay(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
function defaultRange() { const end = new Date(), start = new Date(); start.setDate(start.getDate() - 6); return { from: localDay(start), to: localDay(end) } }
const time = (d: Date | null) => d ? d.toLocaleString() : "Not recorded"
const reason = (code: string) => REASONS[code] || code
const cards = [["", "Total unavailable attempts"], ["no_schedules_found", "No schedules"], ["no_partner_for_selected_hub", "No partner in hub"], ["no_available_time_entries", "Unavailable time entries"], ["all_slots_inside_lead_time", "Lead-time restrictions"], ["service_slots_disabled", "Monthly slots disabled"]]
const definitions: [keyof EventFilters, string][] = [["serviceCoverageCityId", "City"], ["categoryPath", "Service category"], ["hubPath", "Hub"], ["subCategoryId", "Service subcategory"], ["reasonCode", "Reason"], ["source", "Source"], ["platform", "Platform"]]
function Headers({ values }: { values: string[] }) { return <TableHeader><TableRow>{values.map(v => <TableHead key={v}>{v}</TableHead>)}</TableRow></TableHeader> }

export default function SlotAvailabilityPage() {
  const { user } = useAuth()
  const [range, setRange] = useState(defaultRange)
  const [refresh, setRefresh] = useState(0)
  const [events, setEvents] = useState<SlotUnavailabilityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(0)
  const [error, setError] = useState("")
  const [filters, setFilters] = useState<EventFilters>({})
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<SlotUnavailabilityEvent | null>(null)
  const repository = useMemo(() => new SlotUnavailabilityRepository(), [user?.id])
  useEffect(() => {
    let cancelled = false
    setEvents([]); setLoaded(0); setLoading(true); setError(""); setPage(0); setSelected(null)
    async function load() {
      try {
        const from = new Date(`${range.from}T00:00:00`), to = new Date(`${range.to}T00:00:00`)
        to.setDate(to.getDate() + 1)
        if (!range.from || !range.to || range.from > range.to) throw new Error("Select a valid start and end date")
        let cursor: Awaited<ReturnType<SlotUnavailabilityRepository["fetchPage"]>>["cursor"]
        const all: SlotUnavailabilityEvent[] = []
        do {
          const result = await repository.fetchPage(from, to, cursor)
          if (cancelled) return
          all.push(...result.events); setLoaded(all.length)
          cursor = result.hasMore ? result.cursor : undefined
        } while (cursor)
        if (!cancelled) setEvents(all)
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load events") }
      finally { if (!cancelled) setLoading(false) }
    }
    if (user) void load()
    return () => { cancelled = true }
  }, [range.from, range.to, refresh, repository, user?.id])
  const filtered = useMemo(() => filterEvents(events, filters), [events, filters])
  const grouped = useMemo(() => groupEvents(filtered), [filtered])
  const pages = Math.max(1, Math.ceil(filtered.length / 100)), current = Math.min(page, pages - 1)
  function updateFilter(key: keyof EventFilters, value: string) {
    setFilters(old => ({ ...old, [key]: value, ...(key === "serviceCoverageCityId" ? { categoryPath: "", hubPath: "" } : {}), ...(key === "categoryPath" ? { hubPath: "" } : {}) })); setPage(0)
  }
  function options(key: keyof EventFilters) {
    const values = new Map<string, string>()
    for (const e of events) {
      if ((key === "categoryPath" || key === "hubPath") && filters.serviceCoverageCityId && e.serviceCoverageCityId !== filters.serviceCoverageCityId) continue
      if (key === "hubPath" && filters.categoryPath && categoryPath(e) !== filters.categoryPath) continue
      const value = key === "categoryPath" ? categoryPath(e) : key === "hubPath" ? hubPath(e) : e[key]
      const label = key === "serviceCoverageCityId" ? e.cityName : key === "categoryPath" ? `${e.categoryName} (${e.cityName})` : key === "hubPath" ? `${e.hubName} (${e.cityName} / ${e.categoryName})` : key === "subCategoryId" ? e.serviceName : key === "reasonCode" ? reason(e.reasonCode) : key === "source" ? SOURCES[e.source] || e.source : e.platform
      if (value) values.set(value, label)
    }
    if (key === "reasonCode") for (const [k, v] of Object.entries(REASONS)) values.set(k, v)
    if (key === "source") for (const [k, v] of Object.entries(SOURCES)) values.set(k, v)
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }
  return <div className="space-y-6 p-4 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Slot Availability Issues</h1><p className="mt-1 text-sm text-muted-foreground">Find where customers could not get a bookable slot and what prevented availability.</p></div><Button variant="outline" disabled={loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Each event is an anonymous unavailable slot-screen occurrence, not a unique customer. Customer identities and contact details are not collected.</p>
    <Card><CardHeader><CardTitle>Filters</CardTitle></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <label className="space-y-2 text-sm font-medium">From<Input type="date" value={range.from} max={range.to} onChange={e => { setFilters({}); setRange(r => ({ ...r, from: e.target.value })) }} /></label>
      <label className="space-y-2 text-sm font-medium">Through<Input type="date" value={range.to} min={range.from} onChange={e => { setFilters({}); setRange(r => ({ ...r, to: e.target.value })) }} /></label>
      {definitions.map(([key, label]) => <label key={key} className="space-y-2 text-sm font-medium">{label}<select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters[key] || ""} onChange={e => updateFilter(key, e.target.value)} disabled={loading}><option value="">All</option>{options(key).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}
      <div className="flex items-end"><Button variant="outline" onClick={() => { setRange(defaultRange()); setFilters({}); setPage(0) }}>Reset to last 7 days</Button></div>
    </div><p className="mt-3 text-xs text-muted-foreground">Dates use your browser’s local timezone. Summaries respect all filters. Filter choices come from events in this range.</p></CardContent></Card>
    {loading ? <div role="status" className="flex items-center justify-center gap-3 p-12"><Loader2 className="h-5 w-5 animate-spin" />Loading availability events ({loaded.toLocaleString()} read)…</div> : error ? <div role="alert" className="rounded-lg border border-destructive p-5"><p className="font-semibold">Could not load availability issues</p><p className="mt-2 break-words text-sm">{error}</p><p className="mt-2 text-sm text-muted-foreground">If access is denied, check that the updated Firestore rules are deployed and your account has analytics access.</p><Button variant="outline" className="mt-3" onClick={() => setRefresh(v => v + 1)}>Retry</Button></div> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([code, label]) => <Card key={code}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{(code ? filtered.filter(e => e.reasonCode === code).length : filtered.length).toLocaleString()}</p></CardContent></Card>)}</div>
      {!filtered.length ? <div className="rounded-lg border border-dashed p-12 text-center"><h2 className="font-semibold">No availability issues found</h2><p className="mt-2 text-sm text-muted-foreground">Try another date range or clear the filters. Events appear when the customer app records an unavailable result.</p></div> : <>
        <Card><CardHeader><CardTitle>Hub / service summary</CardTitle><p className="text-sm text-muted-foreground">Highest attempt counts first. Diagnostic counters are summed across attempts.</p></CardHeader><CardContent><Table><Headers values={["City", "Hub", "Service", "Attempts", "Most common reason", "Last occurrence", "Schedules fetched", "Hub mismatches", "Lead-time exclusions"]} /><TableBody>{grouped.map(g => <TableRow key={g.key}><TableCell>{g.event.cityName}</TableCell><TableCell>{g.event.hubName}</TableCell><TableCell>{g.event.serviceName}</TableCell><TableCell className="font-semibold">{g.count}</TableCell><TableCell>{reason(Object.entries(g.reasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0])}</TableCell><TableCell>{time(g.last)}</TableCell><TableCell>{g.schedules}</TableCell><TableCell>{g.mismatches}</TableCell><TableCell>{g.leadTime}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Detailed events</CardTitle><p className="text-sm text-muted-foreground">{filtered.length.toLocaleString()} attempts · Most recent first</p></CardHeader><CardContent><Table><Headers values={["Date / time", "City", "Hub", "Service", "Source", "Platform", "Reason", "Diagnostics"]} /><TableBody>{filtered.slice(current * 100, (current + 1) * 100).map(e => <TableRow key={e.id}><TableCell>{time(e.createdAt)}</TableCell><TableCell>{e.cityName}</TableCell><TableCell>{e.hubName}</TableCell><TableCell>{e.serviceName}</TableCell><TableCell>{SOURCES[e.source] || e.source || "Unknown"}</TableCell><TableCell>{e.platform || "Unknown"}</TableCell><TableCell>{reason(e.reasonCode)}</TableCell><TableCell><p className="text-xs text-muted-foreground">Schedules: {e.diagnostics.schedulesFetched ?? "—"} · Hub mismatches: {e.diagnostics.hubMismatchExcluded ?? "—"} · Lead time: {e.diagnostics.leadTimeExcluded ?? "—"}</p><Button variant="link" className="px-0" onClick={() => setSelected(e)} aria-label={`View diagnostics for event ${e.id}`}>View details</Button></TableCell></TableRow>)}</TableBody></Table><div className="mt-4 flex items-center justify-between gap-3"><Button variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button><span className="text-sm">Page {current + 1} of {pages}</span><Button variant="outline" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</Button></div></CardContent></Card>
      </>}
    </>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Unavailable attempt details</DialogTitle><DialogDescription>Recorded metadata and diagnostic counters for this anonymous occurrence.</DialogDescription></DialogHeader>{selected && <>
      <dl className="grid grid-cols-2 gap-3 text-sm">{Object.entries({ "Event ID": selected.id, "Event type": selected.eventType, "Version": selected.eventVersion, "Server time": time(selected.createdAt), "Device time": time(selected.clientCreatedAt), "City": selected.cityName, "City ID": selected.serviceCoverageCityId, "Category": selected.categoryName, "Coverage category ID": selected.serviceCoverageCategoryId, "Original category ID": selected.categoryId, "Hub": selected.hubName, "Hub ID": selected.serviceHubId, "Service": selected.serviceName, "Subcategory ID": selected.subCategoryId, "Source": SOURCES[selected.source] || selected.source, "Platform": selected.platform, "Reason code": selected.reasonCode, "Days searched": selected.daysSearched }).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value === "" ? "Not recorded" : value}</dd></div>)}</dl>
      <Table><Headers values={["Diagnostic", "Count"]} /><TableBody>{[...new Set([...Object.keys(DIAGNOSTICS), ...Object.keys(selected.diagnostics)])].map(key => <TableRow key={key}><TableCell>{DIAGNOSTICS[key] || key}<span className="block text-xs text-muted-foreground">{key}</span></TableCell><TableCell>{selected.diagnostics[key] ?? "Not recorded"}</TableCell></TableRow>)}</TableBody></Table>
    </>}</DialogContent></Dialog>
  </div>
}
