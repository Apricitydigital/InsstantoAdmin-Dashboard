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

    const body = await request.json()
    const {
      completedBookings = "0",
      cancelledBookings = "0",
      totalAmountPaid = "0",
      netProfit = "0",
      marginPercentage = "0",
      avgOrderValue = "0",
      customerAcquisitionCost = "0",
      cleaning = "0",
      electrical = "0",
      security = "0",
      driver = "0",
      totalComplaints = "0",
      resolvedComplaints = "0",
      totalBookingAmount = "0",
    } = body

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
              to: ["+919472394155", "+919166477214", "+917225896737", "+917697928255", "+919111899909", "+919479882385", "+919229499999", "+919516600328"],
              components: {
                body_1: {
                  type: "text",
                  value: new Date().toLocaleDateString(),
                },
                body_2: {
                  type: "text",
                  value: String(completedBookings),
                },
                body_3: {
                  type: "text",
                  value: String(cancelledBookings),
                },
                body_4: {
                  type: "text",
                  value: String(cleaning),
                },
                body_5: {
                  type: "text",
                  value: String(electrical),
                },
                body_6: {
                  type: "text",
                  value: String(security),
                },
                body_7: {
                  type: "text",
                  value: String(driver),
                },
                body_8: {
                  type: "text",
                  value: `${String(totalBookingAmount)}`,
                },
                body_9: {
                  type: "text",
                  value: `${String(netProfit)}`,
                },
                body_10: {
                  type: "text",
                  value: `${String(marginPercentage)}%`,
                },
                body_11: {
                  type: "text",
                  value: `${String(customerAcquisitionCost)}`,
                },
                body_12: {
                  type: "text",
                  value: `${String(avgOrderValue)}`,
                },
                body_13: {
                  type: "text",
                  value: String(totalComplaints),
                },
                body_14: {
                  type: "text",
                  value: String(resolvedComplaints),
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
