import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const authKey = process.env.MSG91_AUTH_KEY

    if (!authKey) {
      return NextResponse.json(
        { error: "MSG91_AUTH_KEY not configured" },
        { status: 500 }
      )
    }

    const payload = {
      integrated_number: "919516600328",
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "daily_booking_report",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: "c4480be9_4f75_4099_a294_ea1c07054ac4",
          to_and_components: [
            {
              to: ["+919166477214"],
              components: {
                body_1: {
                  type: "text",
                  value: new Date().toLocaleDateString(),
                },
                body_2: {
                  type: "text",
                  value: "2,450",
                },
                body_3: {
                  type: "text",
                  value: "125",
                },
                body_4: {
                  type: "text",
                  value: "850",
                },
                body_5: {
                  type: "text",
                  value: "620",
                },
                body_6: {
                  type: "text",
                  value: "520",
                },
                body_7: {
                  type: "text",
                  value: "460",
                },
                body_8: {
                  type: "text",
                  value: "₹8,45,000",
                },
                body_9: {
                  type: "text",
                  value: "₹4,20,500",
                },
                body_10: {
                  type: "text",
                  value: "49.7%",
                },
                body_11: {
                  type: "text",
                  value: "₹345",
                },
                body_12: {
                  type: "text",
                  value: "₹3,450",
                },
                body_13: {
                  type: "text",
                  value: "45",
                },
                body_14: {
                  type: "text",
                  value: "38",
                },
              },
            },
          ],
        },
      },
    }

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to send WhatsApp report", details: data },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: "WhatsApp report sent successfully",
      data,
    })
  } catch (error) {
    console.error("Error sending WhatsApp report:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
