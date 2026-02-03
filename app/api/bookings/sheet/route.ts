import { NextResponse } from "next/server";
import Papa from "papaparse";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1fccKd4_mVt26js0Y5VfBrpcnogvWA_toC6Y4NL8DhP4WEOtlS03pfwBG3Xj1H5oSnBgMZwrS_J5p/pub?output=csv&gid=1162982163";

/* ---------- DATE PARSER ---------- */
function parseDate(value?: string): Date | null {
  if (!value) return null;

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [a, b, c] = value.split("/").map(Number);
    return a > 12
      ? new Date(c, b - 1, a)
      : new Date(c, a - 1, b);
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/* ---------- API ---------- */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "from & to required" },
        { status: 400 }
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    const csvText = await res.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const fields = parsed.meta.fields || [];

    // 🔥 FIND SERVICE PRICE COLUMN INDEX
    const servicePriceIndex = fields.findIndex((f) =>
      f.toLowerCase().includes("service") &&
      f.toLowerCase().includes("pric")
    );

    const data = (parsed.data as any[])
      .map((row, index) => {
        const dateObj = parseDate(row["Date"]);
        if (!dateObj) return null;
        if (dateObj < fromDate || dateObj > toDate) return null;

        /* ---------- SOURCE ---------- */
        const sourceKey = Object.keys(row).find(
          (k) => k.trim().toLowerCase() === "source"
        );
        const source = sourceKey ? String(row[sourceKey] || "") : "";

        /* ---------- PRICE (INDEX BASED) ---------- */
        let amount = 0;
        if (servicePriceIndex !== -1) {
          const raw = Object.values(row)[servicePriceIndex];
          if (raw) {
            amount = Number(
              String(raw)
                .replace(/₹/g, "")
                .replace(/,/g, "")
                .trim()
            );
          }
        }

        return {
          id: `${row["Date"]}-${index}`,
          bookingDate: dateObj.toISOString().slice(0, 10),

          customerName: row["Customer Name"] || "",
          service: row["Service"] || "",
          phone: row["Contact Info"] || "",
          address: row["Address"] || "",
          partnerName: row["Patner Name"] || "",
          source,
          amount,
          arriveTime: row["Arrive Time"] || "",
          status: row["Status"] || "",
          feedback: row["Feedback"] || "",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return NextResponse.json({
      debug: {
        fields,
        servicePriceIndex,
      },
      data,
    });
  } catch (error) {
    console.error("Sheet booking API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sheet bookings" },
      { status: 500 }
    );
  }
}
