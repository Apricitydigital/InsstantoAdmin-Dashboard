"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: LucideIcon;
  color: string;
  description: string;
  onClickContent?: React.ReactNode; // ✅ click-based content (CAC chart)
}

export function KpiCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color,
  description,
  onClickContent,
}: KpiCardProps) {
  const [open, setOpen] = useState(false);

  const colorMapping: Record<
    string,
    { border: string; bg: string; text: string }
  > = {
    "text-primary": {
      border: "border-blue-500",
      bg: "bg-blue-50",
      text: "text-blue-600",
    },
    "text-secondary": {
      border: "border-green-500",
      bg: "bg-green-50",
      text: "text-green-600",
    },
    "text-chart-3": {
      border: "border-purple-500",
      bg: "bg-purple-50",
      text: "text-purple-600",
    },
    "text-chart-4": {
      border: "border-orange-500",
      bg: "bg-orange-50",
      text: "text-orange-600",
    },
    "text-chart-2": {
      border: "border-indigo-500",
      bg: "bg-indigo-50",
      text: "text-indigo-600",
    },
    default: {
      border: "border-teal-500",
      bg: "bg-teal-50",
      text: "text-teal-600",
    },
  };

  const colorStyles = colorMapping[color] || colorMapping.default;

  return (
    <>
      {/* KPI CARD */}
      <div
        className={cn(onClickContent && "cursor-pointer")}
        onClick={() => onClickContent && setOpen(true)}
      >
        <Card
          className={cn(
            "transition-transform hover:scale-[1.02] hover:shadow-md border-l-4 shadow-sm",
            colorStyles.border,
            colorStyles.bg
          )}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className={cn("h-4 w-4 opacity-90", color)} />
            </div>
          </CardHeader>

          <CardContent>
            <div className={cn("text-2xl font-bold", colorStyles.text)}>
              {value}
            </div>

            <div className="flex items-center space-x-1 text-xs">
              <span
                className={trend === "up" ? "text-green-600" : "text-red-600"}
              >
                {change}
              </span>
              <span className="text-muted-foreground">from last month</span>
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {description}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ CLICK MODAL */}
      {open && onClickContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative bg-white rounded-xl shadow-xl w-[90vw] max-w-3xl p-4">
            {/* Close button */}
            <button
              className="absolute top-2 right-2 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>

            {/* Content */}
            <div className="max-h-[70vh] overflow-auto">
              {onClickContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
