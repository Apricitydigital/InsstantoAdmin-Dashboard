"use client"

import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Bot, Download, FileSpreadsheet, Loader2, Send, Sparkles, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { AiChatResponse, ChartSpec, ChatHistoryItem, ReportTable } from "@/lib/admin-ai/types"
import { getFirebaseAuth } from "@/lib/firebase"

type Message = ChatHistoryItem & { chart?: ChartSpec; table?: ReportTable; usedTools?: string[] }
const COLORS = ["#4f46e5", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"]

function downloadPdf(message: Message) {
  const lines = ["INSSTANTO DASHBOARD REPORT", "", message.content, "", ...(message.table ? [message.table.title, message.table.columns.join(" | "), ...message.table.rows.map(r => message.table!.columns.map(c => String(r[c] ?? "")).join(" | "))] : [])]
  const escaped = lines.join("\n").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E\n]/g, "")
  const stream = `BT /F1 10 Tf 45 800 Td 13 TL ${escaped.split("\n").slice(0, 55).map((line, i) => `${i ? "T* " : ""}(${line.slice(0, 105)}) Tj`).join(" ")} ET`
  const objects = ["1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj", "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj", "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj", "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj", `5 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj`]
  let pdf = "%PDF-1.4\n", offsets = [0]
  objects.forEach(o => { offsets.push(pdf.length); pdf += `${o}\n` })
  const xref = pdf.length
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })); const a = document.createElement("a"); a.href = url; a.download = "insstanto-report.pdf"; a.click(); URL.revokeObjectURL(url)
}

function ResultChart({ chart }: { chart: ChartSpec }) {
  const common = { data: chart.data, margin: { top: 10, right: 15, left: 0, bottom: 5 } }
  return <div className="mt-4 h-72 rounded-xl border bg-white p-3"><div className="mb-2 font-semibold">{chart.title}</div><ResponsiveContainer width="100%" height="88%">
    {chart.type === "pie" ? <PieChart><Pie data={chart.data} dataKey={chart.yKey} nameKey={chart.xKey} outerRadius={90} label>{chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
    : chart.type === "line" ? <LineChart {...common}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey={chart.xKey}/><YAxis/><Tooltip/><Line dataKey={chart.yKey} stroke="#4f46e5" strokeWidth={3}/></LineChart>
    : chart.type === "area" ? <AreaChart {...common}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey={chart.xKey}/><YAxis/><Tooltip/><Area dataKey={chart.yKey} fill="#c7d2fe" stroke="#4f46e5"/></AreaChart>
    : <BarChart {...common}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey={chart.xKey}/><YAxis/><Tooltip/><Bar dataKey={chart.yKey} fill="#4f46e5" radius={[6,6,0,0]}/></BarChart>}
  </ResponsiveContainer></div>
}

export default function AdvancedChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Ask me anything about bookings, revenue, customers, partners, support, ratings, or chat activity. I can analyze a date range, build charts, and export results." }])
  const [input, setInput] = useState(""); const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState(""); const [toDate, setToDate] = useState("")
  const [suggestions, setSuggestions] = useState(["Summarize dashboard performance", "Chart booking status", "List support issues", "Show customer growth"])
  const history = useMemo(() => messages.map(({ role, content }) => ({ role, content })), [messages])

  async function send(text = input) {
    const question = text.trim(); if (!question || loading) return
    setMessages(m => [...m, { role: "user", content: question }]); setInput(""); setLoading(true)
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken()
      const res = await fetch("/api/admin/ai-chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ message: question, history, fromDate: fromDate || undefined, toDate: toDate || undefined }) })
      const data = await res.json() as AiChatResponse
      if (!res.ok) throw new Error(data.answer)
      setMessages(m => [...m, { role: "assistant", content: data.answer, chart: data.chart || undefined, table: data.table || undefined, usedTools: data.usedTools }])
      if (data.suggestions?.length) setSuggestions(data.suggestions)
    } catch (e) { setMessages(m => [...m, { role: "assistant", content: e instanceof Error ? e.message : "The assistant could not answer right now." }]) }
    finally { setLoading(false) }
  }

  function excel(table: ReportTable) { const ws = XLSX.utils.json_to_sheet(table.rows, { header: table.columns }); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Dashboard data"); XLSX.writeFile(wb, "insstanto-dashboard.xlsx") }

  return <div className="flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-950 px-5 py-4 text-white"><div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-500 p-2"><Sparkles className="h-5 w-5"/></div><div><h1 className="font-semibold">Insstanto AI Data Assistant</h1><p className="text-xs text-slate-300">Live dashboard analysis, charts and exports</p></div></div><div className="flex gap-2"><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="rounded-lg border-white/20 bg-white/10 px-2 py-1.5 text-xs"/><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="rounded-lg border-white/20 bg-white/10 px-2 py-1.5 text-xs"/></div></div>
    <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50 p-4 sm:p-6">{messages.map((m,i)=><div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}><div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-slate-800 text-white" : "bg-indigo-600 text-white"}`}>{m.role === "user" ? <User className="h-4 w-4"/> : <Bot className="h-4 w-4"/>}</div><Card className={`max-w-[90%] p-4 ${m.role === "user" ? "bg-slate-900 text-white" : "bg-white"}`}><div className="whitespace-pre-wrap text-sm leading-6">{m.content}</div>{m.chart && <ResultChart chart={m.chart}/>} {m.table && <div className="mt-4"><div className="max-h-72 overflow-auto rounded-lg border"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{m.table.columns.map(c=><th key={c} className="p-2 text-left">{c}</th>)}</tr></thead><tbody>{m.table.rows.map((r,ri)=><tr key={ri} className="border-t">{m.table!.columns.map(c=><td key={c} className="p-2">{String(r[c] ?? "")}</td>)}</tr>)}</tbody></table></div></div>} {m.role === "assistant" && i > 0 && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={()=>downloadPdf(m)}><Download className="mr-1 h-3.5 w-3.5"/>PDF</Button>{m.table && <Button size="sm" variant="outline" onClick={()=>excel(m.table!)}><FileSpreadsheet className="mr-1 h-3.5 w-3.5"/>Excel</Button>}</div>}</Card></div>)}{loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Querying dashboard data and preparing analysis…</div>}</div>
    <div className="border-t bg-white p-3"><div className="mb-2 flex gap-2 overflow-x-auto">{suggestions.map(s=><button key={s} onClick={()=>send(s)} className="shrink-0 rounded-full border px-3 py-1 text-xs hover:bg-slate-50">{s}</button>)}</div><div className="flex gap-2"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Ask a custom question about the entire dashboard…" className="min-h-11 flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"/><Button onClick={()=>send()} disabled={loading||!input.trim()} className="h-11 bg-indigo-600"><Send className="mr-2 h-4 w-4"/>Send</Button></div></div>
  </div>
}
