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
  hoverContent?: React.ReactNode; // 👈 optional hover graph
}

export function KpiCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color,
  description,
  hoverContent,
}: KpiCardProps) {
  const [hovered, setHovered] = useState(false);

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
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* KPI CARD */}
      <Card
        className={cn(
          "transition-transform hover:scale-[1.02] hover:shadow-md border-l-4 shadow-sm cursor-pointer",
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

          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
      </Card>

      {/* 👇 Responsive Hover Graph Popup */}
{hovered && hoverContent && (
  <div
    className={cn(
      "fixed z-[9999] p-3 bg-white border shadow-2xl rounded-xl transition-all duration-200",
      "w-[90vw] sm:w-[600px] md:w-[500px] lg:w-[600px]"
    )}
    style={{
      top: "50%", // You can fine-tune this value depending on layout
      left: "50%",
      transform: "translate(-50%, -50%)",
    }}
  >
    <div className="w-full h-auto max-h-[400px] overflow-hidden rounded-md">
      {hoverContent}
    </div>
  </div>
)}

    </div>
  );
}