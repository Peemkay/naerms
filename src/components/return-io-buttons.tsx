"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Download, FileDown, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  IO_COLUMNS,
  IO_HEADERS,
  isBlankRow,
  mapHeaderRow,
  parseCsv,
  rowToItem,
  toCsv,
} from "@/lib/return-io"
import type { ReturnItemDraft } from "@/lib/validation/return"

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Rows in the shared column order, ready for either output format. */
function itemsToRows(items: ReturnItemDraft[]): (string | number)[][] {
  return items.map((item, index) =>
    IO_COLUMNS.map((column) => {
      if (column.key === "lineNo") return index + 1
      const value = item[column.key as keyof ReturnItemDraft]
      return value == null ? "" : (value as string | number)
    })
  )
}

/**
 * Import and export for a return's equipment items.
 *
 * Import replaces or appends to the items on the form rather than writing to
 * the database: everything lands in the form first, where it can be checked
 * and corrected, and is only filed when the clerk submits. That also means
 * an imported sheet inherits the same autosave and draft handling as typed
 * entry.
 *
 * exceljs is loaded on demand (dynamic import) so the ~900KB parser never
 * reaches anyone who doesn't actually import or export an .xlsx.
 */
export function ReturnIoButtons({
  items,
  onImport,
  requestRef,
  disabled,
}: {
  items: ReturnItemDraft[]
  onImport: (items: ReturnItemDraft[], mode: "replace" | "append") => void
  requestRef: string
  disabled?: boolean
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const baseName = (requestRef.trim() || "return").replace(/[^\w.-]+/g, "-")

  function exportCsv() {
    download(
      new Blob([toCsv([[...IO_HEADERS], ...itemsToRows(items)])], {
        type: "text/csv;charset=utf-8",
      }),
      `${baseName}.csv`
    )
  }

  async function exportXlsx() {
    setBusy(true)
    try {
      const ExcelJS = await import("exceljs")
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Equipment Items")

      sheet.addRow([...IO_HEADERS])
      for (const row of itemsToRows(items)) sheet.addRow(row)

      sheet.getRow(1).font = { bold: true }
      // Widths from the header text, floored so short headers over long
      // data (Remarks, Equipment) still open readable.
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

  function downloadTemplate() {
    download(new Blob([toCsv([[...IO_HEADERS]])], { type: "text/csv;charset=utf-8" }), "naerms-return-template.csv")
    toast.success("Blank template downloaded.")
  }

  /** Header row + data rows -> form items, for both formats. */
  function ingest(rows: unknown[][], fileName: string) {
    if (rows.length < 2) {
      toast.error("That file has no data rows under its header.")
      return
    }

    const keys = mapHeaderRow(rows[0].map((c) => String(c ?? "")))
    if (!keys.some((k) => k === "equipmentName")) {
      toast.error("No 'Equipment' column found. Download the template to see the expected headers.")
      return
    }

    const parsed: ReturnItemDraft[] = []
    for (const row of rows.slice(1)) {
      const record: Record<string, unknown> = {}
      keys.forEach((key, index) => {
        if (key) record[key] = row[index]
      })
      if (isBlankRow(record)) continue
      const item = rowToItem(record)
      // An unnamed item can't be submitted and gives the clerk nothing to
      // correct, so blank-equipment rows are skipped rather than imported
      // as empty cards.
      if (!item.equipmentName) continue
      parsed.push(item)
    }

    if (parsed.length === 0) {
      toast.error("No equipment rows found in that file.")
      return
    }

    // Appending is only offered when there's real work on screen to protect;
    // the untouched single blank row the form starts with isn't that.
    const hasExisting = items.some((item) => item.equipmentName.trim() !== "")
    const mode: "replace" | "append" =
      hasExisting && window.confirm(`Add these ${parsed.length} item(s) to the ones already on the form?\n\nCancel replaces them instead.`)
        ? "append"
        : "replace"

    onImport(parsed, mode)
    toast.success(`Imported ${parsed.length} item(s) from ${fileName}.`)
  }

  async function handleFile(file: File) {
    setBusy(true)
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        ingest(parseCsv(await file.text()), file.name)
        return
      }

      const ExcelJS = await import("exceljs")
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(await file.arrayBuffer())
      const sheet = workbook.worksheets[0]
      if (!sheet) {
        toast.error("That workbook has no sheets.")
        return
      }

      const rows: unknown[][] = []
      sheet.eachRow((row) => {
        // values is 1-based with a leading hole; slice(1) drops it.
        const values = (row.values as unknown[]).slice(1)
        rows.push(values.map((v) => (v && typeof v === "object" && "text" in v ? (v as { text: unknown }).text : v)))
      })
      ingest(rows, file.name)
    } catch {
      toast.error("Could not read that file. Check it's a .csv or .xlsx.")
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={() => fileInput.current?.click()}
      >
        <Upload className="size-3.5" />
        Import
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="sm" disabled={disabled || busy}>
              <Download className="size-3.5" />
              Export
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={exportCsv}>Export as CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void exportXlsx()}>Export as Excel (.xlsx)</DropdownMenuItem>
          <DropdownMenuItem onClick={downloadTemplate}>
            <FileDown className="size-3.5" />
            Blank template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
