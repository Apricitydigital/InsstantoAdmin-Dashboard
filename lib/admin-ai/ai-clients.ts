import { INSSTANTO_ADMIN_AI_SYSTEM_PROMPT } from "./systemPrompt"
import type { AiChatRequest, AiChatResponse, DashboardToolResult } from "./types"

export async function generateAiAnswer(request: AiChatRequest, data: DashboardToolResult[]): Promise<AiChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing")
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input: [{ role: "system", content: INSSTANTO_ADMIN_AI_SYSTEM_PROMPT + `\nReturn one JSON object only: {answer:string, chart:null|{type:'bar'|'line'|'pie'|'area',title:string,xKey:string,yKey:string,data:object[]}, table:null|{title:string,columns:string[],rows:object[]}, suggestions:string[]}. Return a chart when it improves understanding and a table when the user asks for a list/export. Never put more than 200 table rows.` },
      ...((request.history || []).slice(-8).map(m => ({ role: m.role, content: m.content }))),
      { role: "user", content: JSON.stringify({ question: request.message, filters: { fromDate: request.fromDate, toDate: request.toDate, city: request.city }, dashboardData: data }) }],
    text: { format: { type: "json_object" } }
  }) })
  const json = await response.json()
  if (!response.ok) throw new Error(json?.error?.message || "AI request failed")
  const text = json.output_text || json.output?.flatMap((x: any) => x.content || []).find((x: any) => x.type === "output_text")?.text
  if (!text) throw new Error("AI returned no answer")
  return JSON.parse(text)
}
