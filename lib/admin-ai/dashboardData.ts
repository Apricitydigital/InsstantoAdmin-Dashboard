import { getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore, Timestamp } from "firebase-admin/firestore"
import type { AiChatRequest, DashboardToolResult } from "./types"

if (!getApps().length) initializeApp({ credential: applicationDefault() })
const db = getFirestore()

const DATASETS = {
  bookings: { collection: "bookings", date: "date", fields: ["status", "amount_paid", "walletAmountUsed", "discount_amount", "date", "city"] },
  customers: { collection: "customer", date: "created_time", fields: ["created_time", "userType", "city", "display_name"] },
  support: { collection: "complaints", date: "created_at", fields: ["status", "category", "priority", "created_at"] },
  reviews: { collection: "reviews", date: "created_at", fields: ["rating", "partnerRating", "created_at"] },
  chats: { collection: "partner_stream_responses", date: "created_at", fields: ["created_at"] },
} as const

type DatasetName = keyof typeof DATASETS

function serialise(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value && typeof value === "object" && "path" in value) return (value as { path: string }).path
  if (Array.isArray(value)) return value.map(serialise)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialise(v)]))
  return value
}

function wantedDatasets(question: string): DatasetName[] {
  const q = question.toLowerCase()
  const selected = new Set<DatasetName>()
  if (/booking|revenue|sales|earning|completion|cancel|profit|discount|offer/.test(q)) selected.add("bookings")
  if (/customer|user|signup|retention/.test(q)) selected.add("customers")
  if (/support|complaint|ticket|issue/.test(q)) selected.add("support")
  if (/review|rating|feedback/.test(q)) selected.add("reviews")
  if (/chat|conversation|bot/.test(q)) selected.add("chats")
  if (!selected.size || /dashboard|overall|summary|everything/.test(q)) Object.keys(DATASETS).forEach(k => selected.add(k as DatasetName))
  return [...selected]
}

export async function queryDashboard(request: AiChatRequest): Promise<DashboardToolResult[]> {
  const from = request.fromDate ? Timestamp.fromDate(new Date(`${request.fromDate}T00:00:00Z`)) : undefined
  const to = request.toDate ? Timestamp.fromDate(new Date(`${request.toDate}T23:59:59.999Z`)) : undefined

  return Promise.all(wantedDatasets(request.message).map(async name => {
    const config = DATASETS[name]
    let query: FirebaseFirestore.Query = db.collection(config.collection)
    if (from) query = query.where(config.date, ">=", from)
    if (to) query = query.where(config.date, "<=", to)
    const snapshot = await query.limit(1000).get()
    const rows = snapshot.docs.map(doc => {
      const raw = doc.data()
      return Object.fromEntries(config.fields.map(field => [field, serialise(raw[field])]))
    })
    return { toolName: name, data: { count: snapshot.size, truncated: snapshot.size === 1000, rows } }
  }))
}
