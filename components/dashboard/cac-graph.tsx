"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { fetchCACMonthlyPoints, MonthlyCACPoint } from "@/lib/queries/cac";

type Props = {
  title?: string;
  description?: string;
  fromDate?: string; // "YYYY-MM-DD"
  toDate?: string;   // "YYYY-MM-DD"
};

export default function CACGraph({
  title = "Customer Acquisition Cost (CAC)",
  description = "Monthly CAC based on marketing spend vs customers with exactly one completed booking",
  fromDate,
  toDate,
}: Props) {
  const [data, setData] = useState<MonthlyCACPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const points = await fetchCACMonthlyPoints(fromDate, toDate);
        if (!alive) return;
        setData(points);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load CAC data");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [fromDate, toDate]);

  const yMax = useMemo(() => {
    if (!data.length) return 0;
    const mx = Math.max(...data.map((d) => d.cac));
    return mx <= 0 ? 0 : mx;
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="h-[360px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading CAC...
          </div>
        ) : err ? (
          <div className="flex h-full items-center justify-center text-red-600">{err}</div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No CAC data available for this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthLabel" />
              <YAxis domain={[0, yMax === 0 ? "auto" : "auto"]} />
              <Tooltip
                formatter={(value: any, name: any, props: any) => {
                  if (name === "cac") return [`₹${Number(value).toFixed(2)}`, "CAC"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="cac"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
