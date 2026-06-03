// lib/admin-ai/ai-clients.ts

import { INSSTANTO_ADMIN_AI_SYSTEM_PROMPT } from "./systemPrompt";
import type { AiChatRequest, DashboardToolResult } from "./types";

type GenerateAiAnswerParams = {
  request: AiChatRequest;
  toolResults: DashboardToolResult[];
};

function extractTextFromResponsesApi(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = data?.output;

  if (Array.isArray(output)) {
    const parts: string[] = [];

    for (const item of output) {
      if (typeof item?.content === "string") {
        parts.push(item.content);
      }

      if (Array.isArray(item?.content)) {
        for (const contentItem of item.content) {
          if (typeof contentItem?.text === "string") {
            parts.push(contentItem.text);
          }

          if (typeof contentItem?.value === "string") {
            parts.push(contentItem.value);
          }

          if (typeof contentItem?.content === "string") {
            parts.push(contentItem.content);
          }
        }
      }
    }

    const finalText = parts.join("\n").trim();

    if (finalText) {
      return finalText;
    }
  }

  return "";
}

export async function generateAiAnswer({
  request,
  toolResults,
}: GenerateAiAnswerParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in .env.local");
  }

  if (!toolResults.length) {
    return "Dashboard data was not provided, so I cannot analyze it yet.";
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      text: {
        verbosity: "medium",
      },
      input: [
        {
          role: "system",
          content: INSSTANTO_ADMIN_AI_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                adminQuestion: request.message,
filters: {
  fromDate: request.fromDate || null,
  toDate: request.toDate || null,
  dateLabel: request.dateLabel || null,
  city: request.city || null,
  module: request.module || null,
},
                dashboardData: toolResults,
              }),
            },
          ],
        },
      ],
    }),
  });

  const rawText = await response.text();

  let data: any = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(`OpenAI returned non-JSON response: ${rawText}`);
  }

  if (!response.ok) {
    throw new Error(`OpenAI API failed: ${rawText}`);
  }

  console.log("OpenAI raw response:", JSON.stringify(data, null, 2));

  const answer = extractTextFromResponsesApi(data);

  if (!answer) {
    throw new Error(
      "OpenAI response did not contain readable text. Check terminal log: OpenAI raw response."
    );
  }

  return answer;
}