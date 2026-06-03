import {
  fetchBookingStats,
  fetchCategoryWiseBookings,
} from "@/lib/queries/dashboard";

import type { AiChatRequest, DashboardToolResult } from "./types";

function normalizeMessage(message: string) {
  return message.toLowerCase().trim();
}

function wantsCategoryAnalysis(message: string) {
  const text = normalizeMessage(message);

  return [
    "category",
    "cleaning",
    "electrical",
    "electrician",
    "security",
    "driver",
    "service type",
    "which service",
    "top service",
  ].some((keyword) => text.includes(keyword));
}

function wantsBookingStats(message: string) {
  const text = normalizeMessage(message);

  return [
    "booking",
    "bookings",
    "revenue",
    "sales",
    "earning",
    "net revenue",
    "completion",
    "completed",
    "cancelled",
    "pending",
    "confirmed",
    "customer",
    "customers",
    "cac",
    "pnl",
    "p&l",
    "profit",
    "loss",
    "offer",
    "discount",
    "summary",
    "performance",
    "today",
    "month",
    "week",
    "dashboard",
  ].some((keyword) => text.includes(keyword));
}

export async function runDashboardTools(
  request: AiChatRequest
): Promise<DashboardToolResult[]> {
  const { message, fromDate, toDate } = request;

  const results: DashboardToolResult[] = [];

  const shouldRunCategory = wantsCategoryAnalysis(message);
  const shouldRunBookingStats = wantsBookingStats(message) || !shouldRunCategory;

  if (shouldRunBookingStats) {
    const bookingStats = await fetchBookingStats(fromDate, toDate);

    results.push({
      toolName: "booking_stats",
      data: bookingStats,
    });
  }

  if (shouldRunCategory) {
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

export function getFollowUpSuggestions(toolResults: DashboardToolResult[]) {
  const usedTools = toolResults.map((item) => item.toolName);

  const suggestions = new Set<string>();

  if (usedTools.includes("booking_stats")) {
    suggestions.add("Explain revenue and net revenue");
    suggestions.add("Analyze completion rate");
    suggestions.add("Show cancellation risk");
    suggestions.add("Show CAC and P&L summary");
  }

  if (usedTools.includes("category_wise_bookings")) {
    suggestions.add("Which category performed best?");
    suggestions.add("Which category needs improvement?");
  }

  suggestions.add("Generate dashboard summary report");

  return Array.from(suggestions).slice(0, 5);
}