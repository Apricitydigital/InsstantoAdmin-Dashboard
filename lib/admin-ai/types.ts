// lib/admin-ai/types.ts

export type DashboardToolResult = {
  toolName: string;
  data: unknown;
};

export type AiChatRequest = {
  message: string;
  fromDate?: string;
  toDate?: string;
  dateLabel?: string;
  city?: string;
  module?: string;
  dashboardData?: DashboardToolResult[];
};

export type AiChatResponse = {
  answer: string;
  data?: unknown;
  usedTools?: string[];
  suggestions?: string[];
};