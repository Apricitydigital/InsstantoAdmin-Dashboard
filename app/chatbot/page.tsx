"use client"

import { useEffect, useState } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bot, MessageCircle, Loader2, User2 } from "lucide-react"
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  DocumentReference,
  DocumentData,
  limit,
  getCountFromServer,
  getDoc,
} from "firebase/firestore"
import { getFirestoreDb } from "@/lib/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

type PartnerStreamResponse = {
  created_at: Timestamp
  partner_id?: DocumentReference<DocumentData> | null
  chat_history?: string[]
}

type Row = PartnerStreamResponse & { id: string }

export default function ChatBotPage() {
  const db = getFirestoreDb()
  const [rows, setRows] = useState<Row[]>([])
  const [filteredRows, setFilteredRows] = useState<Row[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [allTimeChats, setAllTimeChats] = useState<number>(0)
  const [loadingCount, setLoadingCount] = useState(true)
  const [nameByRefPath, setNameByRefPath] = useState<Record<string, string>>({})
  const [openDetails, setOpenDetails] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch chat list (latest 100)
  useEffect(() => {
    const q = query(
      collection(db, "partner_stream_responses"),
      orderBy("created_at", "desc"),
      limit(100)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data() as PartnerStreamResponse
          return {
            id: d.id,
            created_at: data.created_at,
            partner_id: data.partner_id ?? null,
            chat_history: Array.isArray(data.chat_history) ? data.chat_history : [],
          } as Row
        })
        setRows(next)
        setFilteredRows(next)
        setLoadingList(false)
      },
      (err) => {
        console.error("partner_stream_responses list error:", err)
        setLoadingList(false)
      }
    )
    return () => unsub()
  }, [db])

  // Fetch total chat count
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const coll = collection(db, "partner_stream_responses")
        const snapshot = await getCountFromServer(coll)
        if (!cancelled) setAllTimeChats(snapshot.data().count)
      } catch (e) {
        console.error("count error:", e)
      } finally {
        if (!cancelled) setLoadingCount(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db])

  // Fetch partner display names
  useEffect(() => {
    const missing = Array.from(
      new Set(
        rows
          .map((r) => r.partner_id?.path)
          .filter((p): p is string => typeof p === "string" && !(p in nameByRefPath))
      )
    )
    if (!missing.length) return

    ;(async () => {
      const updates: Record<string, string> = {}
      for (const path of missing) {
        try {
          const refObj = rows.find((r) => r.partner_id?.path === path)?.partner_id
          if (!refObj) continue
          const snap = await getDoc(refObj)
          const dn = (snap.exists() && (snap.get("display_name") as string | undefined)) || undefined
          updates[path] = dn && dn.trim() ? dn : refObj.id
        } catch {
          const fallback = rows.find((r) => r.partner_id?.path === path)?.partner_id?.id
          if (fallback) updates[path] = fallback
        }
      }
      if (Object.keys(updates).length) setNameByRefPath((prev) => ({ ...prev, ...updates }))
    })()
  }, [rows, nameByRefPath])

  // Filter search results
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredRows(rows)
    } else {
      const filtered = rows.filter((r) => {
        const partnerName = nameByRefPath[r.partner_id?.path || ""] || r.partner_id?.id || ""
        return partnerName.toLowerCase().includes(searchQuery.toLowerCase())
      })
      setFilteredRows(filtered)
    }
  }, [searchQuery, rows, nameByRefPath])

  const formatDateTime = (ts?: Timestamp) =>
    ts?.toDate
      ? ts.toDate().toLocaleString([], {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—"

  const PartnerChip = ({ r }: { r: Row }) => {
    const refPath = r.partner_id?.path
    const label = refPath ? nameByRefPath[refPath] || r.partner_id?.id || "unknown" : "unknown"
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-6 w-6 ring-2 ring-white shadow-sm bg-gradient-to-br from-blue-500 to-purple-500">
          <AvatarImage src="" alt="user" />
          <AvatarFallback className="bg-transparent p-0">
            <User2 className="h-4 w-4 text-white" />
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{label}</span>
      </div>
    )
  }

  const openRow = (row: Row) => {
    setSelected(row)
    setOpenDetails(true)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Partner Chat Bot</h1>
            <p className="text-gray-600">Manage AI-powered chat bot for partner communication</p>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 mb-6">
          <input
            type="text"
            placeholder="Search partner..."
            className="w-full p-3 pl-4 border rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Bot className="w-8 h-8 text-purple-600" />
                <Badge variant="secondary">Active</Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-purple-900">24/7</CardTitle>
              <CardDescription className="text-purple-700">Bot Availability</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <MessageCircle className="w-8 h-8 text-blue-600" />
                <Badge variant="secondary">
                  {loadingCount ? <Loader2 className="w-4 h-4 animate-spin" /> : allTimeChats}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-blue-900">
                {loadingCount ? "…" : allTimeChats.toLocaleString()}
              </CardTitle>
              <CardDescription className="text-blue-700">Total Chats (all time)</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Bot Flows</CardTitle>
            <CardDescription>Latest conversations</CardDescription>
          </CardHeader>

          <CardContent>
            {loadingList ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading…
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No conversations found</h3>
                <p className="mb-4">Start receiving partner messages to see them here.</p>
                <Button>Get Started</Button>
              </div>
            ) : (
              <div className="hidden md:block">
                <div className="relative w-full overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="text-left px-4 py-3 w-[36%]">Partner</th>
                        <th className="text-left px-4 py-3 w-[22%]">Created At</th>
                        <th className="text-left px-4 py-3 w-[10%]">Messages</th>
                        <th className="text-left px-4 py-3">Last Message</th>
                        <th className="px-4 py-3 w-[10%]"></th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:not(:last-child)]:border-b">
                      {filteredRows.map((r, i) => {
                        const created = formatDateTime(r.created_at)
                        const count = r.chat_history?.length ?? 0
                        const lastMsg = count ? r.chat_history![count - 1] : "(no messages)"
                        const zebra = i % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                        return (
                          <tr
                            key={r.id}
                            className={`${zebra} cursor-pointer hover:bg-indigo-50/40`}
                            onClick={() => openRow(r)}
                          >
                            <td className="px-4 py-3">
                              <PartnerChip r={r} />
                            </td>
                            <td className="px-4 py-3 text-gray-700">{created}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                                {count}
                              </span>
                            </td>
                            <td className="px-4 py-3 truncate max-w-[46ch]">{lastMsg}</td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openRow(r)
                                }}
                              >
                                Details
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
      {/* Details Dialog */}
<Dialog open={openDetails} onOpenChange={setOpenDetails}>
  <DialogContent
    className="p-0 w-[96vw] max-w-[96vw] h-[88vh] rounded-md sm:w-auto sm:max-w-xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl md:max-w-2xl lg:max-w-3xl overflow-hidden"
  >
    <DialogHeader className="px-4 sm:px-6 pt-6 space-y-2">
      <DialogTitle>Conversation</DialogTitle>
      <DialogDescription>
        {selected?.created_at
          ? `Started on ${formatDateTime(selected.created_at)}`
          : "No timestamp available"}
      </DialogDescription>

      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
        {selected && <PartnerChip r={selected} />}
      </div>
    </DialogHeader>

    {/* --- SCROLLABLE CHAT AREA --- */}
    <div className="px-4 sm:px-6 pb-4 sm:pb-6 overflow-y-auto max-h-[75vh] sm:max-h-[70vh]">
      {selected?.chat_history?.length ? (
        <div className="space-y-4 py-4">
          {selected.chat_history.map((m, idx) => {
            // BASIC BOT DETECTION → you can refine this anytime
            const isBot =
              m.includes("Insstanto") ||
              m.startsWith("आप") ||
              m.startsWith("Namaste") ||
              m.startsWith("नमस्ते") ||
              m.toLowerCase().includes("step")

            return (
              <div
                key={idx}
                className={`flex w-full ${isBot ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-sm
                    ${
                      isBot
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-gray-100 text-gray-800 rounded-bl-none"
                    }
                  `}
                >
                  {m}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-600">No messages in this conversation.</div>
      )}
    </div>
  </DialogContent>
</Dialog>

      </div>
    </div>
  )
}
