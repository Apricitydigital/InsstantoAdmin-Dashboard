import { NextRequest, NextResponse } from "next/server"
import { generateAiAnswer } from "@/lib/admin-ai/ai-clients"
import { queryDashboard } from "@/lib/admin-ai/dashboardData"
import type { AiChatRequest } from "@/lib/admin-ai/types"
import { getAuth } from "firebase-admin/auth"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    if (!token) return NextResponse.json({ answer: "Please sign in again to use the assistant." }, { status: 401 })
    await getAuth().verifyIdToken(token)
    const body = await req.json() as AiChatRequest
    const request = { ...body, message: String(body.message || "").trim().slice(0, 2000), history: (body.history || []).slice(-10) }
    if (!request.message) return NextResponse.json({ answer: "Please enter a question." }, { status: 400 })
    const results = await queryDashboard(request)
    const answer = await generateAiAnswer(request, results)
    return NextResponse.json({ ...answer, usedTools: results.map(r => r.toolName) })
  } catch (error) {
    console.error("Dashboard assistant error", error)
    return NextResponse.json({ answer: error instanceof Error ? error.message : "Unable to analyze dashboard data." }, { status: 500 })
  }
}
