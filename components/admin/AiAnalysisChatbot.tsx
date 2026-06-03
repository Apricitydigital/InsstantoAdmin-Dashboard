// components/admin/AiAnalysisChatbot.tsx

"use client";

import { useMemo, useRef, useState } from "react";
import { Bot, Send, X, Sparkles, Loader2 } from "lucide-react";
import {
  fetchBookingStats,
  fetchCategoryWiseBookings,
} from "@/lib/queries/dashboard";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type DashboardToolResult = {
  toolName: string;
  data: unknown;
};

type AiChatResponse = {
  answer: string;
  suggestions?: string[];
};

type AiAnalysisChatbotProps = {
  city?: string;
  module?: string;
};

function formatDateInput(d: Date) {
  return d.toLocaleDateString("en-CA");
}

function getOverallDateRange() {
  const today = new Date();
  const defaultStart = new Date(2025, 3, 1);

  return {
    fromDate: formatDateInput(defaultStart),
    toDate: formatDateInput(today),
  };
}

function normalizeMessage(message: string) {
  return message.toLowerCase().trim();
}

function wantsCategoryAnalysis(message: string) {
  const text = normalizeMessage(message);

  return [
    "category",
    "categories",
    "cleaning",
    "electrical",
    "electrician",
    "security",
    "driver",
    "service type",
    "which service",
    "top service",
    "best service",
    "worst service",
  ].some((keyword) => text.includes(keyword));
}

function parseChatDateRange(message: string): {
  fromDate: string;
  toDate: string;
  label: string;
} {
  const text = normalizeMessage(message);
  const today = new Date();

  const overall = getOverallDateRange();

  const currentYear = today.getFullYear();

  const monthMap: Record<string, number> = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };

  if (
    text.includes("overall") ||
    text.includes("till date") ||
    text.includes("to date") ||
    text.includes("all time") ||
    text.includes("complete performance")
  ) {
    return {
      ...overall,
      label: `${overall.fromDate} to ${overall.toDate}`,
    };
  }

  if (text.includes("today")) {
    const date = formatDateInput(today);

    return {
      fromDate: date,
      toDate: date,
      label: "today",
    };
  }

  if (text.includes("yesterday")) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const date = formatDateInput(yesterday);

    return {
      fromDate: date,
      toDate: date,
      label: "yesterday",
    };
  }

  if (text.includes("this month")) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      fromDate: formatDateInput(start),
      toDate: formatDateInput(today),
      label: "this month",
    };
  }

  if (text.includes("last month")) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);

    return {
      fromDate: formatDateInput(start),
      toDate: formatDateInput(end),
      label: "last month",
    };
  }

  if (text.includes("this week")) {
    const start = new Date(today);
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    start.setDate(start.getDate() + diffToMonday);

    return {
      fromDate: formatDateInput(start),
      toDate: formatDateInput(today),
      label: "this week",
    };
  }

  if (text.includes("last week")) {
    const end = new Date(today);
    const day = end.getDay();
    const diffToSunday = day === 0 ? -7 : -day;

    end.setDate(end.getDate() + diffToSunday);

    const start = new Date(end);
    start.setDate(end.getDate() - 6);

    return {
      fromDate: formatDateInput(start),
      toDate: formatDateInput(end),
      label: "last week",
    };
  }

  const isoRangeMatch = text.match(
    /(\d{4}-\d{2}-\d{2}).*?(?:to|till|until|-).*?(\d{4}-\d{2}-\d{2})/
  );

  if (isoRangeMatch) {
    return {
      fromDate: isoRangeMatch[1],
      toDate: isoRangeMatch[2],
      label: `${isoRangeMatch[1]} to ${isoRangeMatch[2]}`,
    };
  }

  const slashRangeMatch = text.match(
    /(\d{1,2}[/-]\d{1,2}[/-]\d{4}).*?(?:to|till|until|-).*?(\d{1,2}[/-]\d{1,2}[/-]\d{4})/
  );

  if (slashRangeMatch) {
    const from = new Date(slashRangeMatch[1]);
    const to = new Date(slashRangeMatch[2]);

    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return {
        fromDate: formatDateInput(from),
        toDate: formatDateInput(to),
        label: `${formatDateInput(from)} to ${formatDateInput(to)}`,
      };
    }
  }

  for (const [monthName, monthIndex] of Object.entries(monthMap)) {
    if (text.includes(monthName)) {
      const yearMatch = text.match(/\b(20\d{2})\b/);
      const year = yearMatch ? Number(yearMatch[1]) : currentYear;

      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0);

      const finalEnd = end > today ? today : end;

      return {
        fromDate: formatDateInput(start),
        toDate: formatDateInput(finalEnd),
        label: `${monthName} ${year}`,
      };
    }
  }

  return {
    ...overall,
    label: `${overall.fromDate} to ${overall.toDate}`,
  };
}

async function getClientDashboardData({
  message,
  fromDate,
  toDate,
}: {
  message: string;
  fromDate: string;
  toDate: string;
}): Promise<DashboardToolResult[]> {
  const results: DashboardToolResult[] = [];

  const bookingStats = await fetchBookingStats(fromDate, toDate);

  results.push({
    toolName: "booking_stats",
    data: bookingStats,
  });

  if (wantsCategoryAnalysis(message)) {
    const categoryWiseBookings = await fetchCategoryWiseBookings(
      fromDate,
      toDate
    );

    results.push({
      toolName: "category_wise_bookings",
      data: categoryWiseBookings,
    });
  }

  return results;
}

export default function AiAnalysisChatbot({
  city,
  module,
}: AiAnalysisChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeDateLabel, setActiveDateLabel] = useState(() => {
    const overall = getOverallDateRange();
    return `${overall.fromDate} to ${overall.toDate}`;
  });

  const [suggestions, setSuggestions] = useState<string[]>([
    "Analyze overall dashboard performance",
    "Show this month revenue summary",
    "Analyze last month bookings",
    "What is today's completion rate?",
    "Which metric needs attention?",
  ]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I can analyze overall Insstanto dashboard performance till date. You can also ask for a specific period like today, this month, last month, January 2026, or 2026-01-01 to 2026-01-31.",
    },
  ]);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const dateLabel = useMemo(() => activeDateLabel, [activeDateLabel]);

  async function sendMessage(customMessage?: string) {
    const finalMessage = (customMessage || message).trim();

    if (!finalMessage || isLoading) return;

    const parsedRange = parseChatDateRange(finalMessage);

    setActiveDateLabel(parsedRange.label);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: finalMessage,
      },
    ]);

    setMessage("");
    setIsLoading(true);

    try {
      const dashboardData = await getClientDashboardData({
        message: finalMessage,
        fromDate: parsedRange.fromDate,
        toDate: parsedRange.toDate,
      });

      const res = await fetch("/api/admin/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: finalMessage,
          fromDate: parsedRange.fromDate,
          toDate: parsedRange.toDate,
          dateLabel: parsedRange.label,
          city,
          module,
          dashboardData,
        }),
      });

      const rawText = await res.text();

      let data: AiChatResponse | any = null;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const backendError =
          data?.answer ||
          data?.error ||
          rawText ||
          `AI API failed with status ${res.status}`;

        throw new Error(backendError);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data?.answer ||
            "I could not generate an analysis from the available dashboard data.",
        },
      ]);

      if (data?.suggestions?.length) {
        setSuggestions(data.suggestions);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong while analyzing the dashboard data.";

      console.error("AI chatbot error:", errorMessage);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-neutral-800"
      >
        <Sparkles className="h-4 w-4" />
        AI Analysis
      </button>

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[640px] w-[440px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-neutral-200 bg-neutral-950 px-4 py-4 text-white">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                <Bot className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-sm font-semibold">
                  Insstanto AI Analysis
                </h2>
                <p className="mt-1 text-xs text-neutral-300">
                  Analysis period: {dateLabel}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-4">
            {messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={`flex ${
                  item.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    item.role === "user"
                      ? "bg-black text-white"
                      : "border border-neutral-200 bg-white text-neutral-900"
                  }`}
                >
                  {item.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing dashboard data...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-neutral-200 bg-white p-3">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={isLoading}
                  onClick={() => sendMessage(item)}
                  className="shrink-0 rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={message}
                disabled={isLoading}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage();
                  }
                }}
                placeholder="Ask overall, today, last month, January 2026..."
                className="min-w-0 flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-neutral-100"
              />

              <button
                type="button"
                disabled={isLoading || !message.trim()}
                onClick={() => sendMessage()}
                className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}