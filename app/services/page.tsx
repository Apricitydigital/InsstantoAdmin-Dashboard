"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth"
import {
  assignCategory,
  CatalogueCategory,
  CoverageCategory,
  CoverageCity,
  CoverageHub,
  CoveragePincode,
  fetchCoverage,
  fetchServiceCatalogue,
  renameCoverage,
  saveCity,
  saveHub,
  savePincodes,
  setActive,
  setPincodeActive,
} from "@/lib/queries/service-management"
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  FolderTree,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"

type Modal =
  | { type: "city" }
  | { type: "category"; city: CoverageCity }
  | { type: "hub"; city: CoverageCity; category: CoverageCategory }
  | { type: "pin"; city: CoverageCity; category: CoverageCategory; hub: CoverageHub; pin?: CoveragePincode }
  | { type: "rename"; path: string; field: "cityName" | "hubName"; current: string }
  | null

function StatusBadge({ active }: { active?: boolean }) {
  if (active == null) return <Badge variant="outline">No status field</Badge>
  return active ? (
    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
}

export default function ServicesPage() {
  const { hasPermission } = useAuth()
  const canWrite = hasPermission("services:write")
  const [catalogue, setCatalogue] = useState<CatalogueCategory[]>([])
  const [coverage, setCoverage] = useState<CoverageCity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [modal, setModal] = useState<Modal>(null)
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [pinCode, setPinCode] = useState("")
  const [areaNames, setAreaNames] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [services, areas] = await Promise.all([fetchServiceCatalogue(), fetchCoverage()])
      setCatalogue(services)
      setCoverage(areas.sort((a, b) => a.cityName.localeCompare(b.cityName)))
    } catch (cause) {
      console.error(cause)
      setError(cause instanceof Error ? cause.message : "Unable to load service management data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openModal = (next: Modal) => {
    setModal(next)
    setError("")
    setName(next?.type === "rename" ? next.current : "")
    setCategoryId("")
    setPinCode(next?.type === "pin" && next.pin ? String(next.pin.code) : "")
    setAreaNames(next?.type === "pin" && next.pin ? next.pin.areaNames.join(", ") : "")
  }

  const runWrite = async (work: () => Promise<void>) => {
    setSaving(true)
    setError("")
    try {
      await work()
      setModal(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The change could not be saved")
    } finally {
      setSaving(false)
    }
  }

  const submitModal = () => {
    if (!modal) return
    if (modal.type === "city") return void runWrite(() => saveCity(name))
    if (modal.type === "rename") return void runWrite(() => renameCoverage(modal.path, modal.field, name))
    if (modal.type === "category") {
      const category = catalogue.find((entry) => entry.id === categoryId)
      if (!category) return setError("Select a service category")
      return void runWrite(() => assignCategory(modal.city.id, category))
    }
    if (modal.type === "hub") return void runWrite(() => saveHub(modal.city.id, modal.category.id, name))
    const code = Number(pinCode)
    if (!/^\d{6}$/.test(pinCode) || !Number.isInteger(code)) return setError("Enter a valid six-digit pincode")
    const duplicate = modal.category.hubs.some((hub) =>
      hub.pincodes.some((pin) =>
        pin.code === code && !(hub.id === modal.hub.id && pin.code === modal.pin?.code),
      ),
    )
    if (duplicate) return setError("This pincode is already assigned to another hub in this city and category")
    const names = [...new Set(areaNames.split(",").map((value) => value.trim()).filter(Boolean))]
    const nextPin: CoveragePincode = { code, Active: modal.pin?.Active ?? true, areaNames: names }
    const next = modal.pin
      ? modal.hub.pincodes.map((pin) => (pin.code === modal.pin?.code ? nextPin : pin))
      : [...modal.hub.pincodes, nextPin]
    return void runWrite(() => savePincodes(modal.hub.path, next))
  }

  const filteredCatalogue = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return catalogue
    return catalogue
      .map((category) => ({
        ...category,
        subcategories: category.subcategories
          .map((subcategory) => ({
            ...subcategory,
            items: subcategory.items
              .map((item) => ({
                ...item,
                options: item.options.filter((option) => option.name.toLowerCase().includes(query)),
              }))
              .filter((item) => item.name.toLowerCase().includes(query) || item.options.length),
          }))
          .filter((subcategory) => subcategory.name.toLowerCase().includes(query) || subcategory.items.length),
      }))
      .filter((category) => category.name.toLowerCase().includes(query) || category.subcategories.length)
  }, [catalogue, search])

  const availableCategories = modal?.type === "category"
    ? catalogue.filter(
        (category) => category.path && !modal.city.categories.some((assigned) => assigned.categoryId === category.id),
      )
    : []

  const runStatusWrite = async (work: () => Promise<void>, applyLocal: () => void) => {
    setSaving(true)
    setError("")
    try {
      await work()
      applyLocal()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The status could not be changed")
    } finally {
      setSaving(false)
    }
  }

  const toggle = (path: string, Active: boolean) => void runStatusWrite(
    () => setActive(path, Active),
    () => setCoverage((cities) => cities.map((city) => ({
      ...city,
      Active: city.path === path ? Active : city.Active,
      categories: city.categories.map((category) => ({
        ...category,
        Active: category.path === path ? Active : category.Active,
        hubs: category.hubs.map((hub) => ({
          ...hub,
          Active: hub.path === path ? Active : hub.Active,
        })),
      })),
    }))),
  )

  const togglePincode = (hubPath: string, code: number, Active: boolean) => void runStatusWrite(
    () => setPincodeActive(hubPath, code, Active),
    () => setCoverage((cities) => cities.map((city) => ({
      ...city,
      categories: city.categories.map((category) => ({
        ...category,
        hubs: category.hubs.map((hub) => hub.path === hubPath ? {
          ...hub,
          pincodes: hub.pincodes.map((pin) => pin.code === code ? { ...pin, Active } : pin),
        } : hub),
      })),
    }))),
  )

  return (
    <div className="flex min-h-screen bg-muted/30">
      <main className="min-w-0 flex-1 space-y-6 p-4 pt-16 sm:p-6 sm:pt-16 lg:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Service Management</h1>
            <p className="mt-1 text-muted-foreground">Catalogue structure and area-wise pincode coverage from Firestore.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {error && !modal && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <Tabs defaultValue="services" className="space-y-5">
          <TabsList className="grid w-full max-w-lg grid-cols-2">
            <TabsTrigger value="services">Services Offered</TabsTrigger>
            <TabsTrigger value="areas">Areas Served</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories, services, items, or options" className="pl-9" />
            </div>
            {loading ? <Loading /> : filteredCatalogue.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FolderTree className="h-5 w-5" /> Service catalogue</CardTitle>
                  <CardDescription>Exact document IDs and paths are shown to make reference issues visible.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="space-y-2">
                    {filteredCatalogue.map((category) => (
                      <AccordionItem key={category.id} value={`cat-${category.id}`} className="rounded-lg border px-4">
                        <AccordionTrigger>
                          <NodeTitle name={category.name} id={category.id} path={category.path} active={category.active} count={`${category.subcategories.length} subcategories`} />
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2 pl-3">
                          {category.subcategories.length ? category.subcategories.map((subcategory) => (
                            <Accordion key={subcategory.id} type="multiple">
                              <AccordionItem value={`sub-${subcategory.id}`} className="rounded-md border px-4">
                                <AccordionTrigger>
                                  <NodeTitle name={subcategory.name} id={subcategory.id} path={subcategory.path} active={subcategory.active} count={`${subcategory.items.length} items`} />
                                </AccordionTrigger>
                                <AccordionContent className="space-y-2 pl-3">
                                  {subcategory.items.length ? subcategory.items.map((item) => (
                                    <div key={item.id} className="rounded-md border bg-muted/20 p-3">
                                      <NodeTitle name={item.name} id={item.id} path={item.path} active={item.active} count={`${item.options.length} options`} />
                                      {item.options.length > 0 && (
                                        <div className="mt-3 space-y-2 border-l-2 pl-4">
                                          {item.options.map((option) => <NodeTitle key={option.path} name={option.name} id={option.id} path={option.path} active={option.active} />)}
                                        </div>
                                      )}
                                    </div>
                                  )) : <EmptyState>No linked subcategory items found.</EmptyState>}
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          )) : <EmptyState>No linked subcategories found.</EmptyState>}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ) : <EmptyState>No service catalogue documents found.</EmptyState>}
          </TabsContent>

          <TabsContent value="areas" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">City → category → hub → pincode → locality names</p>
              {canWrite && <Button onClick={() => openModal({ type: "city" })}><Plus className="mr-2 h-4 w-4" /> Add city</Button>}
            </div>
            {!canWrite && <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-900">You have read-only access. Only a super admin can change coverage.</div>}
            {loading ? <Loading /> : coverage.length ? (
              <Accordion type="multiple" className="space-y-3">
                {coverage.map((city) => (
                  <AccordionItem key={city.id} value={city.id} className="rounded-xl border bg-background px-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <AccordionTrigger className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-3 text-left">
                          <Building2 className="h-5 w-5 shrink-0 text-primary" />
                          <div className="min-w-0"><div className="font-semibold">{city.cityName}</div><code className="text-xs font-normal text-muted-foreground">{city.id}</code></div>
                        </div>
                      </AccordionTrigger>
                      {canWrite && <Button size="icon" variant="ghost" onClick={() => openModal({ type: "rename", path: city.path, field: "cityName", current: city.cityName })}><Pencil className="h-4 w-4" /><span className="sr-only">Rename city</span></Button>}
                      <Switch checked={city.Active} disabled={!canWrite || saving} onCheckedChange={(value) => toggle(city.path, value)} aria-label={`Set ${city.cityName} active`} />
                    </div>
                    <AccordionContent className="space-y-3 pt-2">
                      <div className="flex justify-end">{canWrite && <Button size="sm" variant="outline" onClick={() => openModal({ type: "category", city })}><Plus className="mr-2 h-4 w-4" /> Assign category</Button>}</div>
                      {city.categories.length ? (
                        <Accordion type="multiple" className="space-y-3">
                          {city.categories.map((category) => (
                            <CategoryCoverage key={category.id} city={city} category={category} canWrite={canWrite} saving={saving} toggle={toggle} togglePincode={togglePincode} openModal={openModal} runWrite={runWrite} />
                          ))}
                        </Accordion>
                      ) : <EmptyState>No service categories assigned to this city.</EmptyState>}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : <EmptyState>No cities exist in <code>service_coverage</code>.</EmptyState>}
          </TabsContent>
        </Tabs>

        <Dialog open={Boolean(modal)} onOpenChange={(open) => !open && setModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modalTitle(modal)}</DialogTitle>
              <DialogDescription>{modalDescription(modal)}</DialogDescription>
            </DialogHeader>
            {modal?.type === "category" ? (
              <div className="space-y-2"><Label>Service category</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger><SelectContent>{availableCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name} ({category.id})</SelectItem>)}</SelectContent></Select>{!availableCategories.length && <p className="text-sm text-muted-foreground">All available catalogue categories are already assigned.</p>}</div>
            ) : modal?.type === "pin" ? (
              <div className="space-y-4">
                <div className="space-y-2"><Label htmlFor="pin-code">Six-digit pincode</Label><Input id="pin-code" inputMode="numeric" maxLength={6} value={pinCode} onChange={(event) => setPinCode(event.target.value.replace(/\D/g, ""))} /></div>
                <div className="space-y-2"><Label htmlFor="areas">Area/locality names</Label><Input id="areas" value={areaNames} onChange={(event) => setAreaNames(event.target.value)} placeholder="Vijay Nagar, Scheme No. 54" /><p className="text-xs text-muted-foreground">Separate multiple locality names with commas.</p></div>
              </div>
            ) : (
              <div className="space-y-2"><Label htmlFor="entity-name">Name</Label><Input id="entity-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus /></div>
            )}
            {error && <div className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            <DialogFooter><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={submitModal} disabled={saving || (modal?.type === "category" && !availableCategories.length)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

function CategoryCoverage({ city, category, canWrite, saving, toggle, togglePincode, openModal, runWrite }: {
  city: CoverageCity
  category: CoverageCategory
  canWrite: boolean
  saving: boolean
  toggle: (path: string, active: boolean) => void
  togglePincode: (hubPath: string, code: number, active: boolean) => void
  openModal: (modal: Modal) => void
  runWrite: (work: () => Promise<void>) => Promise<void>
}) {
  const removePin = (hub: CoverageHub, pin: CoveragePincode) => {
    if (window.confirm(`Remove pincode ${pin.code} from ${hub.hubName}?`)) void runWrite(() => savePincodes(hub.path, hub.pincodes.filter((entry) => entry.code !== pin.code)))
  }
  return (
    <AccordionItem value={category.path} className="rounded-lg border px-3">
      <div className="flex flex-wrap items-center gap-3">
        <AccordionTrigger className="min-w-0 flex-1">
          <div className="min-w-0 flex-1 text-left"><div className="font-medium">{category.categoryName}</div><code className="text-xs font-normal text-muted-foreground">{category.id}</code></div>
          <StatusBadge active={category.Active} />
        </AccordionTrigger>
        <Switch checked={category.Active} disabled={!canWrite || saving} onCheckedChange={(value) => toggle(category.path, value)} aria-label={`Set ${category.categoryName} active`} />
        {canWrite && <Button size="sm" variant="outline" onClick={() => openModal({ type: "hub", city, category })}><Plus className="mr-2 h-4 w-4" /> Add hub</Button>}
      </div>
      <AccordionContent className="space-y-3 pl-2 pt-2 sm:pl-5">
        {category.hubs.length ? category.hubs.map((hub) => (
          <div key={hub.id} className="rounded-lg bg-muted/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /><div className="min-w-0 flex-1"><span className="font-medium">{hub.hubName}</span> <code className="ml-2 text-xs text-muted-foreground">{hub.id}</code></div>
              {canWrite && <Button size="icon" variant="ghost" onClick={() => openModal({ type: "rename", path: hub.path, field: "hubName", current: hub.hubName })}><Pencil className="h-4 w-4" /><span className="sr-only">Rename hub</span></Button>}
              <Switch checked={hub.Active} disabled={!canWrite || saving} onCheckedChange={(value) => toggle(hub.path, value)} aria-label={`Set ${hub.hubName} active`} />
              {canWrite && <Button size="sm" onClick={() => openModal({ type: "pin", city, category, hub })}><Plus className="mr-2 h-4 w-4" /> Add pincode</Button>}
            </div>
            <div className="mt-3 grid gap-2 xl:grid-cols-2">
              {hub.pincodes.length ? hub.pincodes.map((pin) => (
                <div key={pin.code} className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-2"><span className="font-mono text-base font-semibold">{pin.code}</span><div className="flex-1" /><Switch checked={pin.Active} disabled={!canWrite || saving} onCheckedChange={(Active) => togglePincode(hub.path, pin.code, Active)} aria-label={`Set pincode ${pin.code} active`} />{canWrite && <Button size="icon" variant="ghost" onClick={() => openModal({ type: "pin", city, category, hub, pin })}><Pencil className="h-4 w-4" /><span className="sr-only">Edit pincode</span></Button>}{canWrite && <Button size="icon" variant="ghost" className="text-red-600" onClick={() => removePin(hub, pin)}><Trash2 className="h-4 w-4" /><span className="sr-only">Remove pincode</span></Button>}</div>
                  <div className="mt-2 flex flex-wrap gap-1">{pin.areaNames.length ? pin.areaNames.map((area) => <Badge key={area} variant="outline">{area}</Badge>) : <span className="text-xs text-muted-foreground">No locality names added</span>}</div>
                </div>
              )) : <EmptyState>No pincodes assigned to this hub.</EmptyState>}
            </div>
          </div>
        )) : <EmptyState>No service hubs in this category.</EmptyState>}
      </AccordionContent>
    </AccordionItem>
  )
}

function NodeTitle({ name, id, path, active, count }: { name: string; id: string; path: string; active?: boolean; count?: string }) {
  return <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-3 text-left"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="font-medium">{name}</div><code className="block truncate text-xs font-normal text-muted-foreground" title={path}>{id}{path ? ` · ${path}` : ""}</code></div>{count && <span className="text-xs font-normal text-muted-foreground">{count}</span>}<StatusBadge active={active} /></div>
}

function Loading() {
  return <div className="flex items-center justify-center gap-2 rounded-lg border p-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading Firestore data…</div>
}

function modalTitle(modal: Modal) {
  if (!modal) return ""
  if (modal.type === "city") return "Add service city"
  if (modal.type === "category") return `Assign category to ${modal.city.cityName}`
  if (modal.type === "hub") return `Add hub to ${modal.category.categoryName}`
  if (modal.type === "pin") return modal.pin ? `Edit pincode ${modal.pin.code}` : `Add pincode to ${modal.hub.hubName}`
  return modal.field === "cityName" ? "Rename city" : "Rename hub"
}

function modalDescription(modal: Modal) {
  if (modal?.type === "category") return "The real catalogue DocumentReference will be stored in categoryId."
  if (modal?.type === "pin") return "New and edited coverage is stored in the canonical pincodes array."
  return "Active is saved as a Firestore Boolean and can be changed after creation."
}
