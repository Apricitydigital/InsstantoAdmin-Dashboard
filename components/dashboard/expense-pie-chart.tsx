"use client";

import React, { useEffect, useState } from "react";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const COLORS = [
    "#6366F1", "#22C55E", "#F97316", "#EC4899",
    "#3B82F6", "#A855F7", "#EAB308", "#14B8A6",
    "#EF4444", "#8B5CF6"
];

const ICONS: Record<string, string> = {
    "Interest Exp": "💰",
    "Bank Charges": "🏦",
    Printing: "🖨️",
    Events: "🎉",
    Fuel: "⛽",
    "HK Material": "🧹",
    "Salary Exp": "👔",
    "Software Exp": "💻",
    Vinny: "👨‍💼",
    "Uniform Exp": "👕",
};

interface ExpenseData {
    name: string;
    value: number;
    percentage?: number;
}

export function ExpensePieChart({ className = "" }: { className?: string }) {
    const [months, setMonths] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [data, setData] = useState<ExpenseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState<number>(0);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const sheetUrl =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv";

    const fetchSheetData = async () => {
        try {
            setLoading(true);
            const res = await fetch(sheetUrl);
            const text = await res.text();
            const rows = text.trim().split("\n").map((r) => r.split(","));
            const header = rows[0];
            const monthIndex = header.findIndex((c) => c.toLowerCase().includes("month"));
            const totalIndex = header.findIndex((c) => c.toLowerCase().includes("total"));

            const allMonths = rows
                .slice(1)
                .map((r) => r[monthIndex])
                .filter((m) => m && m.trim() !== "");
            setMonths(allMonths);

            const lastMonth = allMonths[allMonths.length - 1] || allMonths[allMonths.length - 2];
            setSelectedMonth(lastMonth);
            buildChartData(rows, header, lastMonth, monthIndex, totalIndex);
        } catch (err) {
            console.error("Error fetching sheet:", err);
        } finally {
            setLoading(false);
        }
    };

    const buildChartData = (
        rows: string[][],
        header: string[],
        month: string,
        monthIndex: number,
        totalIndex: number
    ) => {
        const row = rows.find((r) => r[monthIndex] === month);
        if (!row) return;

        const totalValue = parseFloat(row[totalIndex]) || 0;
        setTotal(totalValue);

        const dataArr: ExpenseData[] = [];
        header.forEach((col, idx) => {
            if (
                idx !== monthIndex &&
                idx !== totalIndex &&
                col.trim() !== "" &&
                row[idx] &&
                !isNaN(parseFloat(row[idx]))
            ) {
                const value = parseFloat(row[idx]);
                const percentage = totalValue ? (value / totalValue) * 100 : 0;
                dataArr.push({
                    name: col,
                    value,
                    percentage: Number(percentage.toFixed(1)),
                });
            }
        });

        setData(dataArr);
    };

    useEffect(() => {
        fetchSheetData();
    }, []);

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedMonth(e.target.value);
        fetch(sheetUrl)
            .then((res) => res.text())
            .then((text) => {
                const rows = text.trim().split("\n").map((r) => r.split(","));
                const header = rows[0];
                const monthIndex = header.findIndex((c) => c.toLowerCase().includes("month"));
                const totalIndex = header.findIndex((c) => c.toLowerCase().includes("total"));
                buildChartData(rows, header, e.target.value, monthIndex, totalIndex);
            });
    };

    return (
        <Card
            className={`border-l-4 border-gray-300 bg-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md ${className}`}
        >
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-1">
                        💹 Expense Breakdown
                    </CardTitle>
                    <CardDescription>Bifurcation by expense type</CardDescription>
                </div>

                <select
                    value={selectedMonth}
                    onChange={handleMonthChange}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                    {months.map((m) => (
                        <option key={m} value={m}>
                            {m}
                        </option>
                    ))}
                </select>
            </CardHeader>

            <CardContent className="flex flex-col items-center justify-center w-full space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500 h-[300px]">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p>Loading chart...</p>
                    </div>
                ) : data.length === 0 ? (
                    <p className="text-gray-500 h-[300px]">
                        No data available for {selectedMonth}
                    </p>
                ) : (
                    <>
                        {/* 🧾 Total Expense */}
                        <div className="text-center">
                            <p className="text-sm text-gray-500 font-medium uppercase tracking-wide items-center gap-1">
                                Total Expense:{" "}
                                <span className="text-indigo-700 font-bold text-lg">
                                    ₹{total.toLocaleString()}
                                </span>
                            </p>
                            <p className="text-xs text-gray-500">for {selectedMonth}</p>
                        </div>

                        {/* Chart + Legend */}
                        <div className="flex flex-col md:flex-row items-center justify-center w-full gap-4">
                            {/* Pie Chart */}
                            <div className="w-full md:w-2/3 h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius="90%"
                                            dataKey="value"
                                            onMouseEnter={(_, index) => setActiveIndex(index)}
                                            onMouseLeave={() => setActiveIndex(null)}
                                            isAnimationActive={false} // 🚫 disables slice animation
                                            label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                                        >
                                            {data.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={COLORS[index % COLORS.length]}
                                                    style={{
                                                        filter:
                                                            activeIndex === index
                                                                ? "drop-shadow(0 0 5px rgba(0,0,0,0.4))"
                                                                : "none",
                                                        transition: "filter 0.2s ease",
                                                    }}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(val: number, name: string) => [
                                                `₹${val.toLocaleString()}`,
                                                name,
                                            ]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Legend */}
                            <div className="flex flex-col justify-center md:w-1/3 w-full gap-2">
                                {data.map((item, index) => {
                                    const isActive = activeIndex === index;
                                    return (
                                        <div
                                            key={index}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            onMouseLeave={() => setActiveIndex(null)}
                                            className={`flex items-center justify-between px-2 py-1 rounded-lg border ${isActive ? "bg-indigo-50 border-indigo-300" : "border-gray-100"
                                                } hover:bg-gray-50 transition-all cursor-pointer`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{ICONS[item.name] || "💡"}</span>
                                                <span className="text-sm font-medium text-gray-700">
                                                    {item.name}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-semibold text-gray-700 block">
                                                    ₹{item.value.toLocaleString()}
                                                </span>
                                                {/* <span className="text-xs text-indigo-600 font-medium">
                            {item.percentage?.toFixed(1)}%
                        </span> */}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}