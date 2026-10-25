
import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.GOOGLE_SHEET_CSV_URL;

    if (!url) {
      return NextResponse.json(
        { error: "Sheet URL not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to fetch sheet data");
    }

    const csv = await response.text();

    const rows = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });

    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json(
      { error: "Failed to load sheet" },
      { status: 500 }
    );
  }
}
