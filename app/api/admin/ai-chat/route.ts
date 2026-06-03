// app/api/admin/ai-chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generateAiAnswer } from "@/lib/admin-ai/ai-clients";
import type { AiChatRequest, AiChatResponse } from "@/lib/admin-ai/types";

export const dynamic = "force-dynamic";

function validateDate(date?: string) {
  if (!date) return true;

  const parsed = new Date(date);
  return !Number.isNaN(parsed.getTime());
}

function sanitizeMessage(message: string) {
  return message.trim().slice(0, 1000);
}

function getFollowUpSuggestions(usedTools: string[]) {
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
    suggestions.add("Compare category-wise bookings");
  }

  suggestions.add("Generate dashboard summary report");

  return Array.from(suggestions).slice(0, 5);
}

// TODO: Replace this with your real admin auth/session check.
async function getAdminFromRequest(_req: NextRequest) {
  return {
    id: "admin",
    role: "ADMIN",
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        {
          answer: "Unauthorized access.",
        },
        { status: 403 }
      );
    }

    const body = (await req.json()) as AiChatRequest;

    const message = sanitizeMessage(body.message || "");

    if (!message) {
      return NextResponse.json(
        {
          answer: "Please ask a question about dashboard analytics.",
        },
        { status: 400 }
      );
    }

    if (!validateDate(body.fromDate) || !validateDate(body.toDate)) {
      return NextResponse.json(
        {
          answer: "Invalid date filter. Please use YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }

    const dashboardData = body.dashboardData || [];

    if (!dashboardData.length) {
      return NextResponse.json(
        {
          answer:
            "Dashboard data was not provided. Please refresh the dashboard and try again.",
        },
        { status: 400 }
      );
    }

const requestPayload: AiChatRequest = {
  message,
  fromDate: body.fromDate,
  toDate: body.toDate,
  dateLabel: body.dateLabel,
  city: body.city,
  module: body.module,
  dashboardData,
};

    const answer = await generateAiAnswer({
      request: requestPayload,
      toolResults: dashboardData,
    });

    const usedTools = dashboardData.map((item) => item.toolName);

    const response: AiChatResponse = {
      answer,
      data: dashboardData,
      usedTools,
      suggestions: getFollowUpSuggestions(usedTools),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);

    console.error("Admin AI chat error:", error);

    return NextResponse.json(
      {
        answer:
          process.env.NODE_ENV === "development"
            ? `AI chat error: ${errorMessage}`
            : "Sorry, I could not analyze the dashboard data right now. Please try again.",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}