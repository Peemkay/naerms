"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Bold, Download, Italic, MessageSquarePlus, Palette, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toCsv } from "@/lib/return-io"
import { allColumns } from "@/lib/sheet/columns"
import { deleteSheetRowAction, formatSheetCellAction } from "@/lib/actions/sheet"
import type { SheetRow } from "@/lib/sheet/data"
import type { GridSelection } from "@/components/sheet/sheet-grid"

/** Fill colours. Deliberately few: a register wants flags, not a palette. */
const FILL_COLORS = [
  { label: "None", value: null },
  { label: "Yellow", value: "#FEF3C7" },
  { label: "Green", value: "#DCFCE7" },
  { label: "Red", value: "#FEE2E2" },
  { label: "Blue", value: "#DBEAFE" },
] as const

export function SheetToolbar({
  rows,
  selection,
  canEdit,
  formationName,
  onComment,
}: {
  rows: SheetRow[]
  selection: GridSelection | null
  canEdit: boolean
  formationName: string
  onComment: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  const columns = allColumns()
  const selectedRow = selection ? rows[selection.row] : null
  const selectedColumn = selection ? columns[selection.col] : null
  const canFormat = canEdit && selectedRow && selectedColumn

  function applyFormat(patch: Record<string, unknown>) {
    if (!selectedRow || !selectedColumn) return
    startTransition(async () => {
      const res = await formatSheetCellAction({
        returnItemId: selectedRow.id,
        columnKey: selectedColumn.key,
        ...patch,
      })
      if ("error" in res) toast.error(res.error)
    })
  }

  /** Rows in the sheet's own column order, for export. */
  function sheetRowsAsGrid(): (string | number)[][] {
    return rows.map((row, index) =>
      columns.map((column) => {
        if (column.key === "serial") return index + 1
        const cell = row.cells[column.key]
        if (cell?.value) return cell.value
        return row.values[column.key] ?? ""
      })
    )
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const baseName = formationName.replace(/[^\w.-]+/g, "-")

  async function exportXlsx() {
    setBusy(true)
    try {
      const ExcelJS = await import("exceljs")
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Returns")

      // Title block above the table, matching the paper register: the
      // formation's name is part of the document, not just a filename.
      sheet.addRow(["EQUIPMENT RETURNS REGISTER"])
      sheet.addRow([formationName])
      sheet.addRow([])
      sheet.getRow(1).font = { bold: true, size: 14 }
      sheet.getRow(2).font = { bold: true, size: 12 }

      sheet.addRow(columns.map((c) => c.header))
      const headerRow = sheet.getRow(4)
      headerRow.font = { bold: true }

      for (const row of sheetRowsAsGrid()) sheet.addRow(row)

      sheet.columns = columns.map((c) => ({ width: Math.max(12, Math.round(c.width / 7)) }))
      sheet.views = [{ state: "frozen", ySplit: 4 }]

      const buffer = await workbook.xlsx.writeBuffer()
      download(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${baseName}-returns.xlsx`
      )
    } catch {
      toast.error("Could not build the Excel file.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-2">
      {canEdit && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bold"
            disabled={!canFormat || pending}
            onClick={() => applyFormat({ bold: !selectedRow?.cells[selectedColumn?.key ?? ""]?.bold })}
          >
            <Bold className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Italic"
            disabled={!canFormat || pending}
            onClick={() => applyFormat({ italic: !selectedRow?.cells[selectedColumn?.key ?? ""]?.italic })}
          >
            <Italic className="size-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Fill colour" disabled={!canFormat || pending}>
                  <Palette className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              {FILL_COLORS.map((color) => (
                <DropdownMenuItem key={color.label} onClick={() => applyFormat({ fillColor: color.value })}>
                  <span
                    className="mr-2 inline-block size-3 rounded-sm border border-border"
                    style={{ backgroundColor: color.value ?? "transparent" }}
                  />
                  {color.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="ghost" size="sm" disabled={!canFormat || pending}>
                  Format
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => applyFormat({ numberFormat: null })}>General</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyFormat({ numberFormat: "0" })}>Number (0)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyFormat({ numberFormat: "0.00" })}>Number (0.00)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyFormat({ numberFormat: "#,##0" })}>Thousands</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="mx-1 h-5 w-px bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete row"
            disabled={!selectedRow || pending}
            onClick={() => {
              if (!selectedRow) return
              if (!window.confirm("Delete this row from the register? This cannot be undone.")) return
              startTransition(async () => {
                const res = await deleteSheetRowAction(selectedRow.id)
                if ("error" in res) toast.error(res.error)
                else toast.success("Row deleted.")
              })
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!selectedRow}
        onClick={onComment}
      >
        <MessageSquarePlus className="size-3.5" />
        Comment
      </Button>

      <span className="mx-1 h-5 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="ghost" size="sm" disabled={busy}>
              <Download className="size-3.5" />
              Export
            </Button>
          }
        />
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() =>
              download(
                new Blob([toCsv([columns.map((c) => c.header), ...sheetRowsAsGrid()])], {
                  type: "text/csv;charset=utf-8",
                }),
                `${baseName}-returns.csv`
              )
            }
          >
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void exportXlsx()}>Export as Excel (.xlsx)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="ml-auto text-xs text-muted-foreground">
        {rows.length} row{rows.length === 1 ? "" : "s"}
        {!canEdit && " · read-only"}
      </span>
    </div>
  )
}
