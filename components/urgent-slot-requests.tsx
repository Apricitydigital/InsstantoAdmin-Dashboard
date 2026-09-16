"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { collection, doc, DocumentReference, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, type DocumentData } from "firebase/firestore"
import { BellRing, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getFirestoreDb } from "@/lib/firebase"
import { useAuth } from "@/lib/auth"

interface UrgentRequest {
  id: string
  createdAt: Date | null
  requestedDate: string
  customerUid: string
  customerName: string
  customerPhone: string
  serviceName: string
  hubName: string
  status: string
}

const text = (value: unknown) => typeof value === "string"
  ? value
  : typeof value === "number" && Number.isFinite(value) ? String(value) : ""

export function UrgentSlotRequests() {
  const { hasPermission } = useAuth()
  const [requests, setRequests] = useState<UrgentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const cache = useMemo(() => new Map<string, Promise<DocumentData>>(), [])
  const [handling, setHandling] = useState<string | null>(null)

  const markHandled = async (id: string) => {
    setHandling(id)
    setError("")
    try {
      await updateDoc(doc(getFirestoreDb(), "slot_availability_requests", id), {
        status: "handled",
        handledAt: serverTimestamp(),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark request handled")
    } finally {
      setHandling(null)
    }
  }

  useEffect(() => {
    let active = true
    const lookup = (path: string) => {
      let pending = cache.get(path)
      if (!pending) {
        pending = getDoc(doc(getFirestoreDb(), path)).then(snapshot => snapshot.data() || {})
        cache.set(path, pending)
      }
      return pending
    }
    const unsubscribe = onSnapshot(
      query(collection(getFirestoreDb(), "slot_availability_requests"), orderBy("createdAt", "desc"), limit(50)),
      snapshot => {
        void Promise.all(snapshot.docs.map(async requestDocument => {
          const data = requestDocument.data()
          if (text(data.priority) !== "urgent" || text(data.status) !== "open") return null
          const customerReference = data.customer_id instanceof DocumentReference ? data.customer_id : null
          const customerUid = customerReference?.id || text(data.customerUid)
          const cityId = text(data.serviceCoverageCityId)
          const categoryId = text(data.serviceCoverageCategoryId)
          const hubId = text(data.serviceHubId)
          const serviceId = text(data.subCategoryId)
          const hubPath = cityId && categoryId && hubId
            ? `service_coverage/${cityId}/Categories/${categoryId}/service_hubs/${hubId}` : ""
          const [customer, service, hub] = await Promise.all([
            customerUid ? lookup(`customer/${customerUid}`).catch(() => ({} as DocumentData)) : {} as DocumentData,
            serviceId ? lookup(`service_subcategories/${serviceId}`).catch(() => ({} as DocumentData)) : {} as DocumentData,
            hubPath ? lookup(hubPath).catch(() => ({} as DocumentData)) : {} as DocumentData,
          ])
          return {
            id: requestDocument.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
            requestedDate: text(data.requestedDate),
            customerUid,
            customerName: text(customer.display_name) || text(customer.customer_name) || text(customer.name) || "Unnamed customer",
            customerPhone: text(customer.phone_number) || text(customer.contact_no),
            serviceName: text(service.name) || text(service.subcategoryName) || text(service.service_name) || serviceId || "Unknown service",
            hubName: text(hub.hubName) || hubId || "Unknown hub",
            status: text(data.status),
          } satisfies UrgentRequest
        })).then(values => {
          if (active) {
            setRequests(values.filter((value): value is UrgentRequest => value !== null))
            setLoading(false)
          }
        }).catch(cause => {
          if (active) { setError(cause instanceof Error ? cause.message : "Unable to resolve urgent requests"); setLoading(false) }
        })
      },
      cause => { if (active) { setError(cause.message); setLoading(false) } },
    )
    return () => { active = false; unsubscribe() }
  }, [cache])

  return <Card className="border-red-200 bg-red-50/50">
    <CardHeader className="pb-3"><div className="flex items-center gap-3"><span className="rounded-full bg-red-100 p-2 text-red-700"><BellRing className="h-5 w-5" /></span><div><CardTitle>Urgent slot requests</CardTitle><p className="text-sm text-muted-foreground">Customers waiting for availability on a date with no bookable slots.</p></div>{requests.length > 0 && <Badge variant="destructive" className="ml-auto">{requests.length} open</Badge>}</div></CardHeader>
    <CardContent>
      {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking requests&hellip;</div> : requests.length === 0 ? <p className="text-sm text-muted-foreground">No urgent slot requests.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{requests.map(request => <div key={request.id} className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{request.serviceName}</p><p className="text-sm text-muted-foreground">{request.hubName}</p></div><Badge variant="destructive">Urgent</Badge></div>
        <p className="mt-3 text-sm"><span className="text-muted-foreground">Needed on:</span> <strong>{request.requestedDate || "Date not recorded"}</strong></p>
        <p className="mt-2 text-sm font-medium">{request.customerName}</p>{request.customerPhone && <p className="text-sm text-muted-foreground">{request.customerPhone}</p>}
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{request.createdAt?.toLocaleString() || "Pending timestamp"}</span>{request.customerUid && hasPermission("customers:view") && <Link className="font-medium text-primary underline" href={"/customers/" + encodeURIComponent(request.customerUid)}>View customer</Link>}</div>
        <Button className="mt-3 w-full" variant="outline" disabled={handling === request.id} onClick={() => void markHandled(request.id)}>{handling === request.id && <Loader2 className="h-4 w-4 animate-spin" />}Mark handled</Button>
      </div>)}</div>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </CardContent>
  </Card>
}
