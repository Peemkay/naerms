"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IO_HEADERS, toCsv } from "@/lib/return-io"

/**
 * Export for a return that has already been filed. Takes rows pre-built on
 * the server (in the shared IO_COLUMNS order) rather than raw records, so
 * the detail page doesn't have to ship the whole item model to the client
 * just to write a spreadsheet.
 */
export function ExportReturnButton({
  rows,
  requestRef,
}: {
  rows: (string | number)[][]
  requestRef: string
}) {
  const [busy, setBusy] = useState(false)
  const baseName = (requestRef.trim() || "return").replace(/[^\w.-]+/g, "-")

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportXlsx() {
    setBusy(true)
    try {
      // Loaded on demand: the parser is large and most visits to this page
      // never export.
      const ExcelJS = await import("exceljs")
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Equipment Items")
      sheet.addRow([...IO_HEADERS])
      for (const row of rows) sheet.addRow(row)
      sheet.getRow(1).font = { bold: true }
      sheet.columns = IO_HEADERS.map((header) => ({ width: Math.max(12, header.length + 2) }))
      sheet.views = [{ state: "frozen", ySplit: 1 }]

      const buffer = await workbook.xlsx.writeBuffer()
      download(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${baseName}.xlsx`
      )
    } catch {
      toast.error("Could not build the Excel file.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={busy}>
            <Download className="size-3.5" />
            Export
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            download(
              new Blob([toCsv([[...IO_HEADERS], ...rows])], { type: "text/csv;charset=utf-8" }),
              `${baseName}.csv`
            )
          }
        >
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void exportXlsx()}>Export as Excel (.xlsx)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
