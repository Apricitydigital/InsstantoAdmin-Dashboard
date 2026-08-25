"use client"

import { useState, type ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface KpiCardProps { title: string; value: string; change: string; trend: "up" | "down"; icon: LucideIcon; color: string; description: string; onClickContent?: ReactNode }

const styles: Record<string, { accent: string; icon: string }> = {
  "text-primary": { accent: "bg-blue-500", icon: "bg-blue-50 text-blue-600" },
  "text-secondary": { accent: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-600" },
  "text-chart-3": { accent: "bg-violet-500", icon: "bg-violet-50 text-violet-600" },
  "text-chart-4": { accent: "bg-orange-500", icon: "bg-orange-50 text-orange-600" },
  "text-chart-2": { accent: "bg-indigo-500", icon: "bg-indigo-50 text-indigo-600" },
  "text-green-600": { accent: "bg-green-500", icon: "bg-green-50 text-green-600" },
  "text-red-600": { accent: "bg-red-500", icon: "bg-red-50 text-red-600" },
}

export function KpiCard({ title, value, change, trend, icon: Icon, color, description, onClickContent }: KpiCardProps) {
  const [open, setOpen] = useState(false)
  const visual = styles[color] || { accent: "bg-indigo-500", icon: "bg-indigo-50 text-indigo-600" }
  const content = <Card className={cn("relative h-full overflow-hidden border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md", onClickContent && "cursor-pointer")}><div className={cn("absolute inset-x-0 top-0 h-1", visual.accent)} /><CardContent className="p-4 pt-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-500">{title}</p><p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-950">{value}</p></div><div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", visual.icon)}><Icon className="h-5 w-5" /></div></div><div className="mt-3 flex flex-wrap items-center gap-1.5"><span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", trend === "up" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{trend === "up" ? <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" /> : <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}{change}</span><span className="text-xs text-slate-400">vs last month</span></div><p className="mt-2 truncate text-xs text-slate-400">{description}</p></CardContent></Card>

  return <>{onClickContent ? <button type="button" onClick={() => setOpen(true)} className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{content}</button> : content}<Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{onClickContent}</DialogContent></Dialog></>
}
