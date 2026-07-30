export type ChatRole = "user" | "assistant"

export type ChatHistoryItem = { role: ChatRole; content: string }

export type ChartSpec = {
  type: "bar" | "line" | "pie" | "area"
  title: string
  xKey: string
  yKey: string
  data: Record<string, string | number>[]
}

export type ReportTable = {
  title: string
  columns: string[]
  rows: Record<string, string | number | null>[]
}

export type DashboardToolResult = { toolName: string; data: unknown }

export type AiChatRequest = {
  message: string
  history?: ChatHistoryItem[]
  fromDate?: string
  toDate?: string
  city?: string
  module?: string
}

export type AiChatResponse = {
  answer: string
  chart?: ChartSpec
  table?: ReportTable
  usedTools?: string[]
  suggestions?: string[]
}
