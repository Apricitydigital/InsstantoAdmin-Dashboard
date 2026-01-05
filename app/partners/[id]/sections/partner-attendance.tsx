"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttendanceRecord {
  EmployeeId: number;
  EmployeeName: string;
  MobileNo: string;
  AssignedWard: string;
  AttendanceDate: string;
  InTime: string;
  OutTime: string | null;
  InAddress: string;
  OutAddress: string;
}

interface Props {
  partnerName: string;        // → "Vishal Bodre"
  startDate?: string;         // fromDate (YYYY-MM-DD)
  endDate?: string;           // toDate (YYYY-MM-DD)
}

export default function PartnerAttendance({ partnerName, startDate, endDate }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const pageSize = 10;
  const [page, setPage] = useState(1);

  // 🔥 Compute KPI stats
  const kpis = useMemo(() => {
    if (records.length === 0) return { present: 0, missingOut: 0, avgHours: 0 };

    let present = records.length;
    let missingOut = records.filter(r => !r.OutTime).length;

    // Calculate average work hours
    let totalHours = 0;
    records.forEach(r => {
      if (!r.OutTime) return;
      try {
        const start = new Date(`${r.AttendanceDate} ${r.InTime}`);
        const end = new Date(`${r.AttendanceDate} ${r.OutTime}`);
        const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (!isNaN(diff)) totalHours += diff;
      } catch {}
    });

    const avgHours = totalHours / (present - missingOut || 1);

    return { present, missingOut, avgHours };
  }, [records]);

  // Convert to CSV
  const exportCSV = () => {
    const header = "Date,In Time,Out Time,In Address,Out Address\n";
    const rows = records
      .map(r =>
        [
          new Date(r.AttendanceDate).toLocaleDateString("en-IN"),
          r.InTime,
          r.OutTime || "-",
          r.InAddress.replace(/,/g, " "),
          r.OutAddress?.replace(/,/g, " ") || "-"
        ].join(",")
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${partnerName}-attendance.csv`;
    a.click();
  };

  // Fetch Attendance Data
  const fetchAttendance = async () => {
    try {
      setLoading(true);

      let url = "http://103.39.132.76:5000/api/insstanto-attendance";

      // If dates selected → Add filters
      if (startDate && endDate) {
        url += `?start=${startDate}&end=${endDate}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (json.status !== "success") {
        console.error("API error", json);
        return;
      }

      // Filter by partner name
      let filtered: AttendanceRecord[] = json.data.filter(
        (rec: AttendanceRecord) =>
          rec.EmployeeName.toLowerCase() === partnerName.toLowerCase()
      );

      // SORT DESCENDING BY DATE
      filtered.sort((a: AttendanceRecord, b: AttendanceRecord) =>
        new Date(b.AttendanceDate).getTime() -
        new Date(a.AttendanceDate).getTime()
      );

      setRecords(filtered);
      setPage(1); // reset pagination
    } catch (err) {
      console.error("Fetch attendance error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount & when date range changes
  useEffect(() => {
    fetchAttendance();
  }, [partnerName, startDate, endDate]);

  // Paginated Table Data
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return records.slice(start, start + pageSize);
  }, [records, page]);

  const totalPages = Math.ceil(records.length / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Attendance — {partnerName}

          {/* Export Button */}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            Export CSV
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent>

        {/* 🔥 KPI CARDS */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="border p-4">
              <p className="text-sm text-muted-foreground">Present Days</p>
              <p className="text-2xl font-bold">{kpis.present}</p>
            </Card>

            <Card className="border p-4">
              <p className="text-sm text-muted-foreground">Missing Out Time</p>
              <p className="text-2xl font-bold">{kpis.missingOut}</p>
            </Card>

            <Card className="border p-4">
              <p className="text-sm text-muted-foreground">Avg Work Hours</p>
              <p className="text-2xl font-bold">
                {kpis.avgHours.toFixed(1)} hrs
              </p>
            </Card>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading attendance…
          </div>
        ) : records.length === 0 ? (
          <p className="text-muted-foreground text-sm">No attendance found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">In Time</th>
                    <th className="p-2 text-left">Out Time</th>
                    <th className="p-2 text-left">In Address</th>
                    <th className="p-2 text-left">Out Address</th>
                  </tr>
                </thead>

                <tbody>
                  {paginated.map((rec, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">
                        {new Date(rec.AttendanceDate).toLocaleDateString("en-IN")}
                      </td>

                      <td className="p-2">{rec.InTime}</td>

                      <td className="p-2">{rec.OutTime || "—"}</td>

                      {/* Map Links */}
                      <td className="p-2 text-sm">
                        <a
                          className="text-blue-600 underline"
                          href={`https://maps.google.com/?q=${encodeURIComponent(rec.InAddress)}`}
                          target="_blank"
                        >
                          {rec.InAddress}
                        </a>
                      </td>

                      <td className="p-2 text-sm">
                        {rec.OutAddress ? (
                          <a
                            className="text-blue-600 underline"
                            href={`https://maps.google.com/?q=${encodeURIComponent(rec.OutAddress)}`}
                            target="_blank"
                          >
                            {rec.OutAddress}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>

              <span className="text-sm">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
