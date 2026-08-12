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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  IO_COLUMNS,
  IO_HEADERS,
  findHeaderRow,
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
  // Set when a workbook has more than one sheet carrying a register, so the
  // clerk picks which one rather than the importer guessing.
  const [pendingSheets, setPendingSheets] = useState<
    { name: string; rows: unknown[][]; dataRows: number }[] | null
  >(null)
  const [pendingFileName, setPendingFileName] = useState("")

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

    // The header is found, not assumed to be row 1: the units' workbooks
    // title each block with the formation name on the row above the
    // headings, so row 1 is "51 SB", not "Serial | Letter of Request | ...".
    const headerIndex = findHeaderRow(rows)
    if (headerIndex === -1) {
      toast.error(
        "Couldn't find the column headings in that sheet. It needs a row with an Eqpt Name (or Equipment) column."
      )
      return
    }

    const keys = mapHeaderRow(rows[headerIndex].map((c) => String(c ?? "")))

    const parsed: ReturnItemDraft[] = []
    for (const row of rows.slice(headerIndex + 1)) {
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
      if (workbook.worksheets.length === 0) {
        toast.error("That workbook has no sheets.")
        return
      }

      /** One worksheet's cells as a plain row/column array. */
      const readSheet = (sheet: (typeof workbook.worksheets)[number]) => {
        const rows: unknown[][] = []
        sheet.eachRow((row) => {
          // values is 1-based with a leading hole; slice(1) drops it.
          const values = (row.values as unknown[]).slice(1)
          rows.push(
            values.map((v) => (v && typeof v === "object" && "text" in v ? (v as { text: unknown }).text : v))
          )
        })
        return rows
      }

      // A workbook often holds the register on Sheet2 with something else on
      // Sheet1, so silently taking the first sheet imports the wrong data (or
      // fails outright). Only sheets that actually contain a header row are
      // offered, and if exactly one does it is used without asking.
      const candidates = workbook.worksheets
        .map((sheet) => ({ sheet, rows: readSheet(sheet) }))
        .map((entry) => ({ ...entry, headerIndex: findHeaderRow(entry.rows) }))
        // A sheet needs headings *and* at least one row under them. Real
        // workbooks carry header-only scratch sheets, and offering those
        // just invites picking the one that imports nothing.
        .filter((entry) => entry.headerIndex !== -1 && entry.rows.length > entry.headerIndex + 1)

      if (candidates.length === 0) {
        toast.error(
          "No sheet in that workbook has recognisable column headings. Download the template to see the expected headers."
        )
        return
      }

      if (candidates.length === 1) {
        ingest(candidates[0].rows, `${file.name} (${candidates[0].sheet.name})`)
        return
      }

      setPendingSheets(
        candidates.map((entry) => ({
          name: entry.sheet.name,
          rows: entry.rows,
          dataRows: Math.max(0, entry.rows.length - entry.headerIndex - 1),
        }))
      )
      setPendingFileName(file.name)
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

      {/* Which sheet? Only shown when a workbook holds more than one
          register, since guessing imports the wrong unit's holdings. */}
      <Dialog open={pendingSheets !== null} onOpenChange={(open) => !open && setPendingSheets(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Which sheet do you want to import?</DialogTitle>
            <DialogDescription>
              {pendingFileName} has {pendingSheets?.length ?? 0} sheets with equipment columns.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {pendingSheets?.map((sheet) => (
              <Button
                key={sheet.name}
                type="button"
                variant="outline"
                className="justify-between"
                onClick={() => {
                  ingest(sheet.rows, `${pendingFileName} (${sheet.name})`)
                  setPendingSheets(null)
                }}
              >
                <span className="font-medium">{sheet.name}</span>
                <span className="text-xs text-muted-foreground">
                  {sheet.dataRows} row{sheet.dataRows === 1 ? "" : "s"}
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
