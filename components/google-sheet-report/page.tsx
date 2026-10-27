
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, FileSpreadsheet, Search } from "lucide-react";

type ExpenseRow = Record<string, string>;

export default function MarketingExpenseReport() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/google-sheet", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sheet");
      }

      const result = await response.json();

      setRows(Array.isArray(result.data) ? result.data : []);
    } catch {
      setError("Unable to load marketing expenses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const columns = Object.keys(rows[0] ?? {});

  const filteredRows = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return rows;

    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      )
    );
  }, [rows, search]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-indigo-600" />

          <div>
            <h1 className="text-2xl font-bold">
              Marketing Expenses
            </h1>
            <p className="text-sm text-muted-foreground">
              Google Sheet Expense Report
            </p>
          </div>
        </div>

        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search expenses..."
            className="w-full rounded-lg border bg-background py-2 pl-10 pr-3 text-sm"
          />
        </div>
      </div>

      {loading && <p>Loading expense data...</p>}

      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="p-3 text-left font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={index} className="border-t hover:bg-muted/40">
                  {columns.map((column) => (
                    <td key={column} className="p-3">
                      {row[column] || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRows.length === 0 && (
            <p className="p-6 text-center text-muted-foreground">
              No expense records found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
