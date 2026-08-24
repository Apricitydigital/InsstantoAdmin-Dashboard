import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { partnerId, stats } = body

    console.log("AI API called:", { partnerId, stats })

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message: "OPENAI_API_KEY missing in .env.local",
        },
        { status: 500 }
      )
    }

    if (!partnerId) {
      return NextResponse.json(
        {
          success: false,
          message: "partnerId is required",
        },
        { status: 400 }
      )
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
You are an admin assistant for Insstanto.

Create a short partner performance summary using this data only:

${JSON.stringify(stats, null, 2)}

Return:
1. Overall summary
2. Risk level: Low, Medium, or High
3. Main issues
4. Suggested admin action
`,
    })

    return NextResponse.json({
      success: true,
      aiSummary: response.output_text,
    })
  } catch (error: any) {
    console.error("Partner AI summary error:", error)

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to generate partner AI summary",
      },
      { status: 500 }
    )
  }
}