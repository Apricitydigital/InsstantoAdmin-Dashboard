import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const keyId = process.env.RAZORPAY_KEY_ID!;
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Missing Razorpay credentials" },
        { status: 500 }
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const LIMIT = 100;

    // ---------------------- FETCH PAYMENTS ----------------------
    let allPayments: any[] = [];
    let pSkip = 0;

    while (true) {
      const params = new URLSearchParams();
      params.set("count", LIMIT.toString());
      params.set("skip", pSkip.toString());
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(
        `https://api.razorpay.com/v1/payments?${params.toString()}`,
        { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }
      );

      if (!res.ok) {
        console.error("Payment fetch failed:", await res.text());
        break;
      }

      const data = await res.json();
      const items = data.items ?? [];

      allPayments.push(...items);
      if (items.length < LIMIT) break;
      pSkip += LIMIT;
    }

    // ---------------------- FETCH SETTLEMENTS ----------------------
    let settlements: any[] = [];
    let sSkip = 0;

    while (true) {
      const sParams = new URLSearchParams();
      sParams.set("count", LIMIT.toString());
      sParams.set("skip", sSkip.toString());
      if (from) sParams.set("from", from);
      if (to) sParams.set("to", to);

      const sRes = await fetch(
        `https://api.razorpay.com/v1/settlements?${sParams.toString()}`,
        { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }
      );

      if (!sRes.ok) break;
      const sData = await sRes.json();
      const sItems = sData.items ?? [];

      settlements.push(...sItems);
      if (sItems.length < LIMIT) break;
      sSkip += LIMIT;
    }

    // ---------------------- FETCH REFUNDS ----------------------
    let allRefunds: any[] = [];
    let rSkip = 0;

    while (true) {
      const rParams = new URLSearchParams();
      rParams.set("count", LIMIT.toString());
      rParams.set("skip", rSkip.toString());
      if (from) rParams.set("from", from);
      if (to) rParams.set("to", to);

      const rRes = await fetch(
        `https://api.razorpay.com/v1/refunds?${rParams.toString()}`,
        { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }
      );

      if (!rRes.ok) {
        console.warn("Refund fetch failed:", await rRes.text());
        break;
      }

      const rData = await rRes.json();
      const rItems = rData.items ?? [];

      allRefunds.push(...rItems);
      if (rItems.length < LIMIT) break;
      rSkip += LIMIT;
    }

    // ---------------------- ENRICH REFUNDS WITH CUSTOMER DETAILS ----------------------
    const refundsWithCustomer = allRefunds.map((r) => {
      const parentPayment = allPayments.find((p) => p.id === r.payment_id);

      return {
        ...r,
        // ✅ Customer Details Derived from Parent Payment
        customer_name:
          parentPayment?.email?.split("@")[0] ||
          parentPayment?.contact ||
          "Unknown",
        customer_email: parentPayment?.email || "N/A",
        customer_contact: parentPayment?.contact || "N/A",

        // ✅ Parent Payment Details
        parent_payment_id: r.payment_id || "N/A",
        parent_amount: (parentPayment?.amount ?? 0) / 100,
        parent_method: parentPayment?.method
          ? parentPayment.method.toUpperCase()
          : "N/A",
      };
    });

    // ---------------------- COMPUTE STATS ----------------------
    const totalPayments = allPayments.length;
    const successfulPayments = allPayments.filter(
      (p) => p.status?.toUpperCase() === "CAPTURED"
    ).length;
    const failedPayments = allPayments.filter(
      (p) => p.status?.toUpperCase() === "FAILED"
    ).length;

    const grossCapturedAmount = allPayments.reduce((sum, p) => {
      if (p.status?.toUpperCase() === "CAPTURED") {
        return sum + (p.amount ?? 0) / 100;
      }
      return sum;
    }, 0);

    const totalRefunds = refundsWithCustomer.length;
    const totalRefundAmount = refundsWithCustomer.reduce(
      (sum, r) => sum + (r.amount ?? 0) / 100,
      0
    );

    const refundedPaymentIds = new Set(
      refundsWithCustomer.map((r) => r.payment_id)
    );
    const refundedPayments = refundedPaymentIds.size;

    const netCollectedBeforeFees = Math.max(
      grossCapturedAmount - totalRefundAmount,
      0
    );

    const totalSettlements = settlements.length;
    const totalSettlementAmount = settlements.reduce(
      (sum, s) => sum + (s.amount ?? 0) / 100,
      0
    );

    // ---------------------- FINAL RESPONSE ----------------------
    const stats = {
      totalPayments,
      successfulPayments,
      failedPayments,
      refundedPayments,
      totalRefunds,
      refundedAmount: totalRefundAmount,
      grossCapturedAmount,
      netCollectedBeforeFees,
      totalSettlements,
      totalSettlementAmount,
    };

    return NextResponse.json({
      payments: allPayments,
      settlements,
      refunds: refundsWithCustomer,
      stats,
    });
  } catch (e: any) {
    console.error("Payments API error:", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
