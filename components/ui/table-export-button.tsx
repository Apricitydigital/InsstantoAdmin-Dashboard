"use client"

import type { MouseEvent } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export function exportTableToCsv(table: HTMLTableElement) {
  const rows = Array.from(table.querySelectorAll("tr"))
    .filter((row) => row.offsetParent !== null)
    .map((row) =>
      Array.from(row.querySelectorAll<HTMLElement>("th, td"))
        .filter((cell) => cell.offsetParent !== null)
        .map((cell) => csvCell(cell.innerText.trim().replace(/\s+/g, " ")))
        .join(",")
    )
    .filter(Boolean)

  if (!rows.length) return

  const blob = new Blob(["\uFEFF", rows.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const pageName = document.title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "table"

  link.href = url
  link.download = `${pageName}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function TableExportButton() {
  const handleExport = (event: MouseEvent<HTMLButtonElement>) => {
    const scope = event.currentTarget.closest<HTMLElement>("[data-export-scope]")
    const table = scope?.querySelector<HTMLTableElement>("table")
    if (table) exportTableToCsv(table)
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      Export
    </Button>
  )
}
