
import { NextRequest, NextResponse } from "next/server";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = "https://api.razorpay.com/v1/payouts";
const FIREBASE_APP_NAME = "razorpayx-token-verifier";

type RazorpayPayout = {
  id: string;
  entity?: string;
  fund_account_id?: string;
  amount: number;
  currency: string;
  fees?: number | null;
  tax?: number | null;
  status: string;
  purpose?: string;
  mode?: string;
  reference_id?: string;
  narration?: string;
  utr?: string | null;
  created_at: number;
  notes?: Record<string, string>;
  status_details?: {
    description?: string;
    reason?: string;
    source?: string;
  } | null;
};

type PayoutResponse = {
  entity?: string;
  count?: number;
  items: RazorpayPayout[];
};

// =====================================================
// 1. VERIFY FIREBASE LOGIN
// =====================================================
// Uses Firebase public keys for token verification.
// Does not require a service-account JSON file.
// This verifies identity, not Insstanto Admin membership.

async function verifyLogin(
  request: NextRequest
): Promise<boolean> {
  try {
    const authorization =
      request.headers.get("authorization");

    const token = authorization
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim();

    if (!token) {
      console.warn(
        "[RazorpayX] Firebase login token missing"
      );
      return false;
    }

    const projectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_ADMIN_PROJECT_ID;

    if (!projectId) {
      console.error(
        "[RazorpayX] Firebase project ID missing"
      );
      return false;
    }

    let adminApp = getApps().find(
      (app) => app.name === FIREBASE_APP_NAME
    );

    if (!adminApp) {
      adminApp = initializeApp(
        { projectId },
        FIREBASE_APP_NAME
      );
    }

    const decoded = await getAuth(
      adminApp
    ).verifyIdToken(token);

    if (!decoded.uid) {
      return false;
    }

    console.log(
      "[RazorpayX] Firebase login verified"
    );

    return true;
  } catch (error) {
    console.error(
      "[RazorpayX] Authentication failed:",
      error instanceof Error
        ? error.message
        : "Unknown authentication error"
    );

    return false;
  }
}

// =====================================================
// 2. HELPER FUNCTIONS
// =====================================================

function sum(
  payouts: RazorpayPayout[],
  field: "amount" | "fees" | "tax"
): number {
  const total = payouts.reduce(
    (value, payout) => {
      const amount = payout[field];

      return (
        value +
        (typeof amount === "number" &&
        Number.isFinite(amount)
          ? amount
          : 0)
      );
    },
    0
  );

  return total / 100;
}

function byStatus(
  payouts: RazorpayPayout[],
  status: string
): RazorpayPayout[] {
  return payouts.filter(
    (payout) =>
      payout.status?.toLowerCase() === status
  );
}

// =====================================================
// 3. GET RAZORPAYX PAYOUT HISTORY
// =====================================================

export async function GET(
  request: NextRequest
) {
  try {
    // STEP 1: Verify Firebase login.

    const loggedIn = await verifyLogin(request);

    if (!loggedIn) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Firebase login verification failed. Please check your session.",
        },
        { status: 401 }
      );
    }

    // =================================================
    // STEP 2: READ RAZORPAY CREDENTIALS
    // =================================================

    const xKeyId =
      process.env.RAZORPAYX_KEY_ID;

    const xKeySecret =
      process.env.RAZORPAYX_KEY_SECRET;

    // Both RazorpayX credentials must be present
    // together, if using separate RazorpayX keys.

    if (
      Boolean(xKeyId) !== Boolean(xKeySecret)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Both RazorpayX API key and secret must be configured.",
        },
        { status: 500 }
      );
    }

    // Prefer RazorpayX keys.
    // Fall back to existing Razorpay keys.

    const keyId =
      xKeyId || process.env.RAZORPAY_KEY_ID;

    const keySecret =
      xKeySecret || process.env.RAZORPAY_KEY_SECRET;

    const accountNumber =
      process.env.RAZORPAYX_ACCOUNT_NUMBER;

    // =================================================
    // STEP 3: SAFE CONFIGURATION DIAGNOSTICS
    // =================================================

    console.log("[RazorpayX] Configuration check:", {
      credentialSource:
        xKeyId && xKeySecret
          ? "RAZORPAYX"
          : "RAZORPAY",

      mode: keyId?.startsWith("rzp_live_")
        ? "LIVE"
        : keyId?.startsWith("rzp_test_")
          ? "TEST"
          : "UNKNOWN",

      accountConfigured: Boolean(accountNumber),

      accountLength: accountNumber?.length ?? 0,
    });

    // Validate configuration.

    if (
      !keyId ||
      !keySecret ||
      !accountNumber
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing RazorpayX API credentials or account number.",
        },
        { status: 500 }
      );
    }

    // =================================================
    // STEP 4: READ DATE FILTERS
    // =================================================

    const params =
      request.nextUrl.searchParams;

    const from = params.get("from");
    const to = params.get("to");

    const validTimestamp = (
      value: string | null
    ) =>
      value === null ||
      /^\d{1,12}$/.test(value);

    if (
      !validTimestamp(from) ||
      !validTimestamp(to) ||
      (
        from !== null &&
        to !== null &&
        Number(from) > Number(to)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid date range.",
        },
        { status: 400 }
      );
    }

    // =================================================
    // STEP 5: PREPARE RAZORPAY AUTHENTICATION
    // =================================================

    const basicAuth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString("base64");

    const LIMIT = 100;
    const MAX_PAGES = 100;

    const allPayouts: RazorpayPayout[] = [];

    let skip = 0;
    let historyComplete = false;

    // =================================================
    // STEP 6: FETCH PAYOUTS WITH PAGINATION
    // =================================================

    for (
      let page = 0;
      page < MAX_PAGES;
      page++
    ) {
      const query = new URLSearchParams({
        account_number: accountNumber,
        count: String(LIMIT),
        skip: String(skip),
      });

      if (from !== null) {
        query.set("from", from);
      }

      if (to !== null) {
        query.set("to", to);
      }

      const response = await fetch(
        `${API_URL}?${query.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            Accept: "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(30000),
        }
      );

      // =================================================
      // STEP 7: HANDLE RAZORPAYX ERRORS
      // =================================================

      if (!response.ok) {
        let razorpayError: {
          error?: {
            code?: string;
            description?: string;
            reason?: string;
            source?: string;
          };
        } = {};

        try {
          razorpayError = await response.json();
        } catch {
          console.error(
            "[RazorpayX] Non-JSON error response"
          );
        }

        const details = razorpayError.error;

        console.error("[RazorpayX] API FAILED", {
          httpStatus: response.status,
          code: details?.code ?? "UNKNOWN",
          description:
            details?.description ?? "No description",
          reason: details?.reason ?? "Unknown",
          source: details?.source ?? "Unknown",
        });

        let message =
          "Unable to fetch payout history from RazorpayX.";

        if (response.status === 400) {
          message =
            "RazorpayX rejected the request. Check the server logs for the exact error.";
        } else if (
          response.status === 401 ||
          response.status === 403
        ) {
          message =
            "RazorpayX API credentials or payout permissions were rejected.";
        } else if (response.status === 429) {
          message =
            "RazorpayX rate limit reached. Please try again later.";
        }

        return NextResponse.json(
          {
            success: false,
            error: message,
          },
          { status: 502 }
        );
      }

      // =================================================
      // STEP 8: READ SUCCESSFUL RESPONSE
      // =================================================

      const data =
        (await response.json()) as PayoutResponse;

      if (!Array.isArray(data.items)) {
        throw new Error(
          "Invalid RazorpayX response format."
        );
      }

      allPayouts.push(...data.items);

      // Stop if this is the final page.

      if (data.items.length < LIMIT) {
        historyComplete = true;
        break;
      }

      // Move to next page.

      skip += LIMIT;
    }

    // =================================================
    // STEP 9: CHECK HISTORY COMPLETENESS
    // =================================================

    if (!historyComplete) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Payout history exceeds the request limit. Select a smaller date range.",
        },
        { status: 413 }
      );
    }

    // =================================================
    // STEP 10: REMOVE DUPLICATE PAYOUTS
    // =================================================

    const payouts = Array.from(
      new Map(
        allPayouts.map(
          (payout) => [payout.id, payout]
        )
      ).values()
    );

    // Newest payouts first.

    payouts.sort(
      (a, b) =>
        b.created_at - a.created_at
    );

    // =================================================
    // STEP 11: GROUP PAYOUTS BY STATUS
    // =================================================

    const processed =
      byStatus(payouts, "processed");

    const processing =
      byStatus(payouts, "processing");

    const reversed =
      byStatus(payouts, "reversed");

    const failed =
      byStatus(payouts, "failed");

    const pending =
      byStatus(payouts, "pending");

    const queued =
      byStatus(payouts, "queued");

    // =================================================
    // STEP 12: CALCULATE FINANCE TOTALS
    // =================================================

    const totals = {
      totalRecords: payouts.length,

      totalProcessed:
        sum(processed, "amount"),

      totalProcessing:
        sum(processing, "amount"),

      totalReversed:
        sum(reversed, "amount"),

      totalFailed:
        sum(failed, "amount"),

      totalPending:
        sum(pending, "amount"),

      totalQueued:
        sum(queued, "amount"),

      totalFees:
        sum(payouts, "fees"),

      totalTax:
        sum(payouts, "tax"),

      processedCount:
        processed.length,

      processingCount:
        processing.length,

      reversedCount:
        reversed.length,

      failedCount:
        failed.length,

      pendingCount:
        pending.length,

      queuedCount:
        queued.length,
    };

    // =================================================
    // STEP 13: RETURN DATA TO INSSTANTO ADMIN
    // =================================================

    console.log("[RazorpayX] Fetch successful:", {
      totalRecords: payouts.length,
      historyComplete,
    });

    return NextResponse.json(
      {
        success: true,
        payouts,
        totals,
        fetchedCount: payouts.length,
        historyComplete: true,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "[RazorpayX] Report error:",
      error instanceof Error
        ? error.message
        : error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to load RazorpayX payout history.",
      },
      { status: 500 }
    );
  }
}
