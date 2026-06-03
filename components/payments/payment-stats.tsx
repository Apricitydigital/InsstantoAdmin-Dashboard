"use client";

import { Card } from "@/components/ui/card";
import {
  Wallet,
  CheckCircle,
  XCircle,
  RotateCcw,
  IndianRupee,
  Banknote,
  Clock3,
  Undo2,
  Split,
} from "lucide-react";

export interface PaymentStats {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingOrOtherPayments: number;

  refundedPayments?: number;
  refundedAmount: number;

  totalRefundEntries?: number;
  fullRefundCount?: number;
  partialRefundCount?: number;

  grossCapturedAmount: number;
  netCollectedBeforeFees: number;

  totalSettlements?: number;
  totalSettlementAmount: number;
}

type PaymentRow = {
  id?: string;
  entity?: string;
  type?: string;
  status?: string;

  amount?: number | string;
  amount_refunded?: number | string;
  refunded_amount?: number | string;

  refund_status?: string | null;

  payment_id?: string;
  paymentId?: string;

  created_at?: number | string;
  createdAt?: string;

  parent_amount?: number | string;

  [key: string]: any;
};

const normalizeText = (value: unknown) => {
  return String(value || "").trim().toLowerCase();
};

const formatCurrency = (value: number) => {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

const toAmount = (value: unknown, amountInPaise: boolean) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return amountInPaise ? amount / 100 : amount;
};

const isPaymentRow = (row: PaymentRow) => {
  const id = String(row.id || "");
  const entity = normalizeText(row.entity);
  const type = normalizeText(row.type);

  return id.startsWith("pay_") || entity === "payment" || type === "payment";
};

const isSettlementRow = (row: PaymentRow) => {
  const id = String(row.id || "");
  const entity = normalizeText(row.entity);
  const type = normalizeText(row.type);

  return (
    id.startsWith("setl_") ||
    entity === "settlement" ||
    type === "settlement"
  );
};

const isRefundRow = (row: PaymentRow) => {
  const id = String(row.id || "");
  const entity = normalizeText(row.entity);
  const type = normalizeText(row.type);

  return id.startsWith("rfnd_") || entity === "refund" || type === "refund";
};

const isSuccessfulPayment = (row: PaymentRow) => {
  const status = normalizeText(row.status);
  return ["captured", "paid", "success", "successful"].includes(status);
};

const isFailedPayment = (row: PaymentRow) => {
  const status = normalizeText(row.status);
  return ["failed", "error", "cancelled", "canceled"].includes(status);
};

const isSuccessfulRefund = (row: PaymentRow) => {
  const status = normalizeText(row.status);
  return ["processed", "success", "successful", "refunded"].includes(status);
};

export function calculatePaymentStats(
  rows: PaymentRow[] = [],
  options?: {
    amountInPaise?: boolean;
  }
): PaymentStats {
  const amountInPaise = options?.amountInPaise ?? false;

  const paymentRows = rows.filter(isPaymentRow);
  const settlementRows = rows.filter(isSettlementRow);
  const refundRows = rows.filter(isRefundRow);

  const successfulPaymentRows = paymentRows.filter(isSuccessfulPayment);
  const failedPaymentRows = paymentRows.filter(isFailedPayment);

  const totalPayments = paymentRows.length;
  const successfulPayments = successfulPaymentRows.length;
  const failedPayments = failedPaymentRows.length;

  const pendingOrOtherPayments = Math.max(
    totalPayments - successfulPayments - failedPayments,
    0
  );

  const grossCapturedAmount = successfulPaymentRows.reduce((sum, row) => {
    return sum + toAmount(row.amount, amountInPaise);
  }, 0);

  let refundedAmount = 0;
  let totalRefundEntries = 0;
  let fullRefundCount = 0;
  let partialRefundCount = 0;

  if (refundRows.length > 0) {
    const successfulRefundRows = refundRows.filter(isSuccessfulRefund);

    totalRefundEntries = successfulRefundRows.length;

    successfulRefundRows.forEach((refund) => {
      const refundAmount = Number(refund.amount || 0);
      const parentAmount = Number(refund.parent_amount || 0) * 100;

      if (parentAmount > 0 && refundAmount === parentAmount) {
        fullRefundCount += 1;
      } else if (
        parentAmount > 0 &&
        refundAmount > 0 &&
        refundAmount < parentAmount
      ) {
        partialRefundCount += 1;
      }
    });

    refundedAmount = successfulRefundRows.reduce((sum, refund) => {
      return sum + toAmount(refund.amount, amountInPaise);
    }, 0);
  } else {
    const refundedPaymentRows = paymentRows.filter((payment) => {
      const amountRefunded = Number(
        payment.amount_refunded || payment.refunded_amount || 0
      );

      const refundStatus = normalizeText(payment.refund_status);

      return (
        amountRefunded > 0 ||
        refundStatus === "full" ||
        refundStatus === "partial" ||
        refundStatus === "refunded"
      );
    });

    totalRefundEntries = refundedPaymentRows.length;

    refundedPaymentRows.forEach((payment) => {
      const amount = Number(payment.amount || 0);
      const amountRefunded = Number(
        payment.amount_refunded || payment.refunded_amount || 0
      );

      if (amountRefunded > 0 && amountRefunded === amount) {
        fullRefundCount += 1;
      } else if (amountRefunded > 0 && amountRefunded < amount) {
        partialRefundCount += 1;
      }
    });

    refundedAmount = refundedPaymentRows.reduce((sum, payment) => {
      const amountRefunded =
        Number(payment.amount_refunded || 0) > 0
          ? payment.amount_refunded
          : payment.refunded_amount;

      return sum + toAmount(amountRefunded, amountInPaise);
    }, 0);
  }

  const totalSettlementAmount = settlementRows.reduce((sum, settlement) => {
    return sum + toAmount(settlement.amount, amountInPaise);
  }, 0);

  const netCollectedBeforeFees = grossCapturedAmount - refundedAmount;

  return {
    totalPayments,
    successfulPayments,
    failedPayments,
    pendingOrOtherPayments,

    refundedAmount,

    totalRefundEntries,
    fullRefundCount,
    partialRefundCount,

    grossCapturedAmount,
    netCollectedBeforeFees,

    totalSettlementAmount,
  };
}

export default function PaymentStatsCards({ stats }: { stats: PaymentStats }) {
  const safeStats: PaymentStats = {
    totalPayments: stats?.totalPayments || 0,
    successfulPayments: stats?.successfulPayments || 0,
    failedPayments: stats?.failedPayments || 0,
    pendingOrOtherPayments: stats?.pendingOrOtherPayments || 0,

    refundedAmount: stats?.refundedAmount || 0,

    totalRefundEntries: stats?.totalRefundEntries || 0,
    fullRefundCount: stats?.fullRefundCount || 0,
    partialRefundCount: stats?.partialRefundCount || 0,

    grossCapturedAmount: stats?.grossCapturedAmount || 0,
    netCollectedBeforeFees: stats?.netCollectedBeforeFees || 0,

    totalSettlementAmount: stats?.totalSettlementAmount || 0,
  };

  const cardBase =
    "min-h-[150px] flex flex-col justify-between p-4 rounded-2xl border-l-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01]";

  const titleBase = "text-sm font-semibold text-gray-700";
  const numberBase = "text-2xl font-bold tracking-tight leading-snug";
  const noteBase = "text-xs text-gray-500 mt-1 leading-snug";

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-800">
            Payment Status Summary
          </h2>
          <p className="text-xs text-gray-500">
            {safeStats.successfulPayments} successful +{" "}
            {safeStats.failedPayments} failed +{" "}
            {safeStats.pendingOrOtherPayments} pending/other ={" "}
            {safeStats.totalPayments} total payments
          </p>
        </div>

        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <Card className={`${cardBase} border-blue-500 bg-blue-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Total Payments</h2>
              <Wallet className="h-5 w-5 text-blue-500 shrink-0" />
            </div>
            <p className={`${numberBase} text-blue-600`}>
              {safeStats.totalPayments}
            </p>
            <p className={noteBase}>Only payment attempts</p>
          </Card>

          <Card className={`${cardBase} border-green-500 bg-green-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Successful</h2>
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            </div>
            <p className={`${numberBase} text-green-600`}>
              {safeStats.successfulPayments}
            </p>
            <p className={noteBase}>Captured payments</p>
          </Card>

          <Card className={`${cardBase} border-red-500 bg-red-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Failed</h2>
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            </div>
            <p className={`${numberBase} text-red-600`}>
              {safeStats.failedPayments}
            </p>
            <p className={noteBase}>Failed payment attempts</p>
          </Card>

          <Card className={`${cardBase} border-yellow-500 bg-yellow-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Pending / Other</h2>
              <Clock3 className="h-5 w-5 text-yellow-600 shrink-0" />
            </div>
            <p className={`${numberBase} text-yellow-700`}>
              {safeStats.pendingOrOtherPayments}
            </p>
            <p className={noteBase}>Created, authorized, pending or other</p>
          </Card>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-800">
            Refund & Settlement Summary
          </h2>
          <p className="text-xs text-gray-500">
            Full refunds, partial refunds, and refund entries are separated for
            Razorpay matching.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Card className={`${cardBase} border-orange-500 bg-orange-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Full Refunds</h2>
              <Undo2 className="h-5 w-5 text-orange-500 shrink-0" />
            </div>
            <p className={`${numberBase} text-orange-600`}>
              {safeStats.fullRefundCount}
            </p>
            <p className={noteBase}>Fully refunded payments</p>
          </Card>

          <Card className={`${cardBase} border-amber-500 bg-amber-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Partial Refunds</h2>
              <Split className="h-5 w-5 text-amber-500 shrink-0" />
            </div>
            <p className={`${numberBase} text-amber-600`}>
              {safeStats.partialRefundCount}
            </p>
            <p className={noteBase}>Partially refunded payments</p>
          </Card>

          <Card className={`${cardBase} border-orange-500 bg-orange-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Refund Entries</h2>
              <RotateCcw className="h-5 w-5 text-orange-500 shrink-0" />
            </div>
            <div>
              <p className={`${numberBase} text-orange-600`}>
                {safeStats.totalRefundEntries}
              </p>
              <p className="text-sm font-semibold text-orange-700 leading-tight">
                {formatCurrency(safeStats.refundedAmount)}
              </p>
            </div>
            <p className={noteBase}>Total processed refund transactions</p>
          </Card>

          <Card className={`${cardBase} border-purple-500 bg-purple-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Gross Captured</h2>
              <IndianRupee className="h-5 w-5 text-purple-500 shrink-0" />
            </div>
            <p className={`${numberBase} text-purple-600`}>
              {formatCurrency(safeStats.grossCapturedAmount)}
            </p>
            <p className={noteBase}>Captured before refunds & fees</p>
          </Card>

          <Card className={`${cardBase} border-pink-500 bg-pink-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Net After Refunds</h2>
              <IndianRupee className="h-5 w-5 text-pink-500 shrink-0" />
            </div>
            <p className={`${numberBase} text-pink-600`}>
              {formatCurrency(safeStats.netCollectedBeforeFees)}
            </p>
            <p className={noteBase}>Gross captured minus refunds</p>
          </Card>

          <Card className={`${cardBase} border-indigo-500 bg-indigo-50`}>
            <div className="flex justify-between items-start gap-3">
              <h2 className={titleBase}>Settlement Amount</h2>
              <Banknote className="h-5 w-5 text-indigo-500 shrink-0" />
            </div>
            <p className={`${numberBase} text-indigo-600`}>
              {formatCurrency(safeStats.totalSettlementAmount)}
            </p>
            <p className={noteBase}>After fees & adjustments</p>
          </Card>
        </div>
      </div>
    </div>
  );
}