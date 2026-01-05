"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  CheckCircle,
  XCircle,
  RotateCcw,
  IndianRupee,
  Banknote,
  Building,
} from "lucide-react";

interface PaymentStats {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  refundedPayments: number;
  refundedAmount: number;
  grossCapturedAmount: number;
  netCollectedBeforeFees: number;
  totalSettlements: number;
  totalSettlementAmount: number;
}

export default function PaymentStatsCards({ stats }: { stats: PaymentStats }) {
  const successRate =
    stats.totalPayments > 0
      ? ((stats.successfulPayments / stats.totalPayments) * 100).toFixed(1)
      : 0;

  const refundRate =
    stats.totalPayments > 0
      ? ((stats.refundedPayments / stats.totalPayments) * 100).toFixed(1)
      : 0;

  const cardBase =
    "min-h-[150px] flex flex-col justify-between p-4 rounded-2xl border-l-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01]";

  const titleBase = "text-sm font-medium text-gray-600";
  const numberBase = "text-2xl font-bold tracking-tight leading-snug";
  const noteBase = "text-xs text-gray-500 mt-1";

  return (
    <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {/* Total Payments */}
      <Card
        className={`${cardBase} border-blue-500 bg-blue-50 flex flex-col justify-between`}
      >
        <div className="flex justify-between items-center">
          <h2 className={titleBase}>Total Payments</h2>
          <Wallet className="h-5 w-5 text-blue-500" />
        </div>
        <p className={`${numberBase} text-blue-600`}>{stats.totalPayments}</p>
        <p className={noteBase}>All received payment attempts</p>
      </Card>

      {/* Successful */}
      <Card
        className={`${cardBase} border-green-500 bg-green-50 flex flex-col justify-between`}
      >
        <div className="flex justify-between items-center">
          <h2 className={titleBase}>Successful</h2>
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>
        <p className={`${numberBase} text-green-600`}>
          {stats.successfulPayments}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Captured transactions</p>
          
        </div>
      </Card>

      {/* Failed */}
      <Card
        className={`${cardBase} border-red-500 bg-red-50 flex flex-col justify-between`}
      >
        <div className="flex justify-between items-center">
          <h2 className={titleBase}>Failed</h2>
          <XCircle className="h-5 w-5 text-red-500" />
        </div>
        <p className={`${numberBase} text-red-600`}>
          {stats.failedPayments}
        </p>
        <p className={noteBase}>Failed attempts</p>
      </Card>

      {/* Refunds */}
      <Card
        className={`${cardBase} border-orange-500 bg-orange-50 flex flex-col justify-between`}
      >
        <div className="flex justify-between items-center">
          <h2 className={titleBase}>Refunded</h2>
          <RotateCcw className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <p className={`${numberBase} text-orange-600`}>
            {stats.refundedPayments}
          </p>
          <p className="text-sm font-semibold text-orange-700 leading-tight">
            ₹{(stats.refundedAmount || 0).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Total refund amount</p>
         
        </div>
      </Card>

      {/* Gross Captured */}
      <Card
        className={`${cardBase} border-purple-500 bg-purple-50 flex flex-col justify-between`}
      >
        <div className="flex justify-between items-center">
          <h2 className={titleBase}>Gross Captured</h2>
          <IndianRupee className="h-5 w-5 text-purple-500" />
        </div>
        <p className={`${numberBase} text-purple-600`}>
          ₹{stats.grossCapturedAmount.toLocaleString("en-IN")}
        </p>
        <p className={noteBase}>Captured before refunds & fees</p>
      </Card>

      {/* Settlements */}
      <Card
        className={`${cardBase} border-teal-500 bg-teal-50 flex flex-col justify-between`}
      >
        <div className="flex justify-between items-center">
          <h2 className={titleBase}>Settlements</h2>
          <Building className="h-5 w-5 text-teal-500" />
        </div>
        <p className={`${numberBase} text-teal-600`}>
          {stats.totalSettlements}
        </p>
        <p className={noteBase}>Settlement entries</p>
      </Card>

      {/* Settlement Amount */}
      <Card
        className={`${cardBase} border-indigo-500 bg-indigo-50 flex flex-col justify-between`}
      >
        <div className="flex justify-between items-center">
          <h2 className={titleBase}>Settlement Amount</h2>
          <Banknote className="h-5 w-5 text-indigo-500" />
        </div>
        <p className={`${numberBase} text-indigo-600`}>
          ₹{stats.totalSettlementAmount.toLocaleString("en-IN")}
        </p>
        <p className={noteBase}>After fees & adjustments</p>
      </Card>
    </div>
  );
}
