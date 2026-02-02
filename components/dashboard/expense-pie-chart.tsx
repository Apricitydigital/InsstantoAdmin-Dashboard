"use client";

import React, { useEffect, useState } from "react";
import Papa from "papaparse";
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
    "Insurance Exp": "🛡️",
    "Telephone exp": "📞",
    "Razorpay Payout": "💳",
    "Event Exp": "🎊",
    "Professional Exp": "👨‍💼",
    "Cleaning Exp": "🧽",
    "Travelling Exp": "✈️",
    "Advertisement Exp": "📢",
    "Repair and Maintenance": "🔧",
};

interface ExpenseData {
    name: string;
    value: number;
    percentage?: number;
}

export function ExpensePieChart({ className = "" }: { className?: string }) {
    const [months, setMonths] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState("");
    const [data, setData] = useState<ExpenseData[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const sheetUrl =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzu4Xj2cluOSQ7-eT9VNvEkZu_3ghcImdSWYTWq2181-0M7OV16a2GN70WcC7DnagsrkZFfDeJioJo/pub?output=csv";

    /* ---------------- CSV PARSER ---------------- */
    const parseCSV = (text: string) => {
        const parsed = Papa.parse<Record<string, string>>(text, {
            header: true,
            skipEmptyLines: true,
        });
        return parsed.data;
    };

    /* ---------------- FETCH SHEET ---------------- */
    const fetchSheetData = async () => {
        try {
            setLoading(true);

            const res = await fetch(sheetUrl);
            const text = await res.text();
            const rows = parseCSV(text);

            if (!rows.length) return;

            const columns = Object.keys(rows[0]);

            const monthColumn = columns.find(c =>
                c.toLowerCase().includes("month")
            );
            const totalColumn = columns.find(c =>
                c.toLowerCase().includes("total")
            );

            if (!monthColumn || !totalColumn) {
                console.error("Month or Total column not found");
                return;
            }

            const allMonths = rows
                .map(r => r[monthColumn])
                .filter(Boolean);

            setMonths(allMonths);

            const lastMonth = allMonths[allMonths.length - 1];
            setSelectedMonth(lastMonth);

            buildChartData(rows, monthColumn, totalColumn, lastMonth);
        } catch (err) {
            console.error("Error fetching sheet:", err);
        } finally {
            setLoading(false);
        }
    };

    /* ---------------- BUILD PIE DATA ---------------- */
    const buildChartData = (
        rows: Record<string, string>[],
        monthColumn: string,
        totalColumn: string,
        month: string
    ) => {
        const row = rows.find(r => r[monthColumn] === month);
        if (!row) return;

        const totalValue =
            parseFloat(row[totalColumn]?.replace(/,/g, "")) || 0;

        setTotal(totalValue);

        const chartData: ExpenseData[] = [];

        Object.entries(row).forEach(([key, value]) => {
            if (
                key !== monthColumn &&
                key !== totalColumn &&
                value &&
                !isNaN(parseFloat(value.replace(/,/g, "")))
            ) {
                const num = parseFloat(value.replace(/,/g, ""));
                chartData.push({
                    name: key,
                    value: num,
                    percentage: totalValue
                        ? +(num / totalValue * 100).toFixed(1)
                        : 0,
                });
            }
        });

        setData(chartData);
    };

    /* ---------------- MONTH CHANGE ---------------- */
    const handleMonthChange = async (
        e: React.ChangeEvent<HTMLSelectElement>
    ) => {
        const month = e.target.value;
        setSelectedMonth(month);

        const res = await fetch(sheetUrl);
        const text = await res.text();
        const rows = parseCSV(text);

        const columns = Object.keys(rows[0]);
        const monthColumn = columns.find(c =>
            c.toLowerCase().includes("month")
        );
        const totalColumn = columns.find(c =>
            c.toLowerCase().includes("total")
        );

        if (monthColumn && totalColumn) {
            buildChartData(rows, monthColumn, totalColumn, month);
        }
    };

    useEffect(() => {
        fetchSheetData();
    }, []);

    /* ---------------- UI ---------------- */
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
                    {months.map(m => (
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
                        {/* TOTAL */}
                        <div className="text-center">
                            <p className="text-sm text-gray-500 font-medium uppercase">
                                Total Expense:
                                <span className="text-indigo-700 font-bold text-lg ml-1">
                                    ₹{total.toLocaleString()}
                                </span>
                            </p>
                            <p className="text-xs text-gray-500">
                                for {selectedMonth}
                            </p>
                        </div>

                        {/* CHART */}
                        <div className="flex flex-col md:flex-row w-full gap-4">
                            <div className="w-full md:w-2/3 h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius="90%"
                                            dataKey="value"
                                            label={({ percent }) =>
                                                `${(percent * 100).toFixed(1)}%`
                                            }
                                            onMouseEnter={(_, i) => setActiveIndex(i)}
                                            onMouseLeave={() => setActiveIndex(null)}
                                            isAnimationActive={false}
                                        >
                                            {data.map((_, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={COLORS[i % COLORS.length]}
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

                            {/* LEGEND */}
                            <div className="md:w-1/3 w-full space-y-2">
                                {data.map((item, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between border rounded-lg px-2 py-1"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{ICONS[item.name] || "💡"}</span>
                                            <span className="text-sm font-medium">
                                                {item.name}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold">
                                            ₹{item.value.toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
