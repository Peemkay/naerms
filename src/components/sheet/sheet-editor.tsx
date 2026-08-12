"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Bold,
  Check,
  Download,
  Italic,
  MessageSquare,
  Minimize2,
  Palette,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SheetGrid, type GridSelection } from "@/components/sheet/sheet-grid"
import { SheetComments } from "@/components/sheet/sheet-comments"
import {
  EMPTY_FILTERS,
  SheetFilters,
  applySheetFilters,
  type SheetFilterState,
} from "@/components/sheet/sheet-filters"
import { allColumns, columnLetter } from "@/lib/sheet/columns"
import { toCsv } from "@/lib/return-io"
import {
  addSheetRowAction,
  deleteSheetRowAction,
  formatSheetCellAction,
  updateSheetCellAction,
} from "@/lib/actions/sheet"
import type { SheetComment, SheetRow } from "@/lib/sheet/data"

const FILL_COLORS = [
  { label: "None", value: null },
  { label: "Yellow", value: "#FEF3C7" },
  { label: "Green", value: "#DCFCE7" },
  { label: "Red", value: "#FEE2E2" },
  { label: "Blue", value: "#DBEAFE" },
] as const

/** One reversible cell write, for the undo/redo stacks. */
type HistoryEntry = {
  returnItemId: string
  columnKey: string
  before: string
  after: string
}

/**
 * The register opened as a full-screen spreadsheet editor.
 *
 * Editing was previously double-click-only inside the dashboard layout,
 * with nothing on screen saying so — which read as "not editable". This is
 * the deliberate mode instead: a menu bar, a formula bar showing the
 * selected cell's real contents, and a grid that fills the window.
 *
 * Rendered as a fixed overlay rather than a route so entering and leaving
 * costs no navigation, and the sheet keeps its scroll position and
 * selection when the editor closes.
 */
export function SheetEditor({
  rows: allRows,
  comments,
  canEdit,
  hiddenColumns,
  formationName,
  groupByFormation = false,
  onClose,
}: {
  rows: SheetRow[]
  comments: SheetComment[]
  canEdit: boolean
  hiddenColumns: string[]
  formationName: string
  /** Consolidated subtree sheet: label each formation's block. */
  groupByFormation?: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [selection, setSelection] = useState<GridSelection | null>({ row: 0, col: 0 })
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const [filters, setFilters] = useState<SheetFilterState>(EMPTY_FILTERS)

  // The grid works on the filtered set, so a selection always refers to a
  // visible row and an edit lands on the row the clerk can actually see.
  const rows = applySheetFilters(allRows, filters)

  const columns = allColumns().filter((c) => !hiddenColumns.includes(c.key))
  const selectedRow = selection ? rows[selection.row] : null
  const selectedColumn = selection ? columns[selection.col] : null

  const selectedLabel = selectedRow
    ? `Row ${(selection?.row ?? 0) + 1} · ${selectedRow.values.equipmentName || "(no equipment name)"}`
    : ""

  /** The cell reference shown in the name box, e.g. "H4". */
  const cellRef =
    selection && selectedColumn ? `${columnLetter(selection.col)}${selection.row + 1}` : ""

  /** Raw contents of the selected cell: formula source if there is one. */
  const cellContents = (() => {
    if (!selectedRow || !selectedColumn) return ""
    const cell = selectedRow.cells[selectedColumn.key]
    if (cell?.formula) return cell.formula
    if (cell?.value) return cell.value
    if (selectedColumn.key === "serial") return String((selection?.row ?? 0) + 1)
    return String(selectedRow.values[selectedColumn.key] ?? "")
  })()

  const [formulaDraft, setFormulaDraft] = useState(cellContents)
  const [formulaFocused, setFormulaFocused] = useState(false)

  // The formula bar follows the selection, except while the clerk is typing
  // in it — overwriting what they are mid-way through entering would be
  // maddening. Synced during render rather than in an effect (React's
  // "adjusting state when a prop changes" pattern, as in returns-table.tsx),
  // which avoids the extra render pass an effect would cost.
  const [lastShown, setLastShown] = useState(cellContents)
  if (!formulaFocused && lastShown !== cellContents) {
    setLastShown(cellContents)
    setFormulaDraft(cellContents)
  }

  // Escape leaves the editor, matching every other full-screen surface.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA"
      if (event.key === "Escape" && !typing) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const write = useCallback(
    async (returnItemId: string, columnKey: string, value: string, record = true) => {
      const row = rows.find((r) => r.id === returnItemId)
      const before = row
        ? String(row.cells[columnKey]?.formula ?? row.cells[columnKey]?.value ?? row.values[columnKey] ?? "")
        : ""

      const res = await updateSheetCellAction({ returnItemId, columnKey, value })
      if ("error" in res) {
        toast.error(res.error)
        return false
      }
      if (record) {
        setUndoStack((s) => [...s.slice(-49), { returnItemId, columnKey, before, after: value }])
        setRedoStack([])
      }
      router.refresh()
      return true
    },
    [rows, router]
  )

  function commitFormulaBar() {
    if (!selectedRow || !selectedColumn || !canEdit) return
    if (formulaDraft === cellContents) return
    void write(selectedRow.id, selectedColumn.key, formulaDraft)
  }

  async function undo() {
    const entry = undoStack[undoStack.length - 1]
    if (!entry) return
    setUndoStack((s) => s.slice(0, -1))
    const ok = await write(entry.returnItemId, entry.columnKey, entry.before, false)
    if (ok) setRedoStack((s) => [...s, entry])
  }

  async function redo() {
    const entry = redoStack[redoStack.length - 1]
    if (!entry) return
    setRedoStack((s) => s.slice(0, -1))
    const ok = await write(entry.returnItemId, entry.columnKey, entry.after, false)
    if (ok) setUndoStack((s) => [...s, entry])
  }

  function applyFormat(patch: Record<string, unknown>) {
    if (!selectedRow || !selectedColumn) return
    setBusy(true)
    void formatSheetCellAction({
      returnItemId: selectedRow.id,
      columnKey: selectedColumn.key,
      ...patch,
    })
      .then((res) => {
        if ("error" in res) toast.error(res.error)
        else router.refresh()
      })
      .finally(() => setBusy(false))
  }

  function gridAsRows(): (string | number)[][] {
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
      sheet.addRow([formationName])
      sheet.getRow(1).font = { bold: true, size: 12 }
      sheet.addRow(columns.map((c) => c.header))
      sheet.getRow(2).font = { bold: true }
      for (const row of gridAsRows()) sheet.addRow(row)
      sheet.columns = columns.map((c) => ({ width: Math.max(12, Math.round(c.width / 7)) }))
      sheet.views = [{ state: "frozen", ySplit: 2 }]
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

  function addRow() {
    setBusy(true)
    void addSheetRowAction()
      .then((res) => {
        if ("error" in res) toast.error(res.error)
        else {
          toast.success("Row added.")
          router.refresh()
        }
      })
      .finally(() => setBusy(false))
  }

  function deleteRow() {
    if (!selectedRow) return
    if (!window.confirm("Delete this row from the register? This cannot be undone.")) return
    setBusy(true)
    void deleteSheetRowAction(selectedRow.id)
      .then((res) => {
        if ("error" in res) toast.error(res.error)
        else {
          toast.success("Row deleted.")
          router.refresh()
        }
      })
      .finally(() => setBusy(false))
  }

  const cellFormat = selectedRow && selectedColumn ? selectedRow.cells[selectedColumn.key] : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Title bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-brand-navy px-3 py-2 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{formationName}</p>
          <p className="text-[11px] text-white/60">
            Equipment Returns Register {canEdit ? "" : "(read-only)"}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <Minimize2 className="size-3.5" />
          Close Editor
        </Button>
      </div>

      {/* Menu / ribbon */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1.5">
        {canEdit && (
          <>
            <Button size="sm" variant="ghost" disabled={busy} onClick={addRow}>
              <Plus className="size-3.5" />
              Add Row
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || !selectedRow}
              onClick={deleteRow}
            >
              <Trash2 className="size-3.5" />
              Delete Row
            </Button>

            <span className="mx-1 h-5 w-px bg-border" />

            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Undo"
              disabled={undoStack.length === 0}
              onClick={() => void undo()}
            >
              <Undo2 className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Redo"
              disabled={redoStack.length === 0}
              onClick={() => void redo()}
            >
              <Redo2 className="size-3.5" />
            </Button>

            <span className="mx-1 h-5 w-px bg-border" />

            <Button
              size="icon-sm"
              variant={cellFormat?.bold ? "secondary" : "ghost"}
              aria-label="Bold"
              disabled={!selectedRow || busy}
              onClick={() => applyFormat({ bold: !cellFormat?.bold })}
            >
              <Bold className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant={cellFormat?.italic ? "secondary" : "ghost"}
              aria-label="Italic"
              disabled={!selectedRow || busy}
              onClick={() => applyFormat({ italic: !cellFormat?.italic })}
            >
              <Italic className="size-3.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="icon-sm" variant="ghost" aria-label="Fill colour" disabled={!selectedRow || busy}>
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
                  <Button size="sm" variant="ghost" disabled={!selectedRow || busy}>
                    Number
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
          </>
        )}

        <Button size="sm" variant="ghost" disabled={!selectedRow} onClick={() => setCommentsOpen((v) => !v)}>
          <MessageSquare className="size-3.5" />
          Comments
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm" variant="ghost" disabled={busy}>
                <Download className="size-3.5" />
                Export
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() =>
                download(
                  new Blob([toCsv([columns.map((c) => c.header), ...gridAsRows()])], {
                    type: "text/csv;charset=utf-8",
                  }),
                  `${baseName}-returns.csv`
                )
              }
            >
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void exportXlsx()}>Export as Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.print()}>Print</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="ml-auto pr-1 text-xs text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Filter bar */}
      <div className="border-b border-border bg-card px-2 py-1.5">
        <SheetFilters
          rows={allRows}
          filters={filters}
          onChange={(next) => {
            setFilters(next)
            // The old selection points into the unfiltered list, so it would
            // otherwise refer to a different row (or none) after narrowing.
            setSelection({ row: 0, col: selection?.col ?? 0 })
          }}
          matchCount={rows.length}
        />
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-1.5">
        <span className="w-16 shrink-0 rounded border border-border px-2 py-1 text-center font-mono text-xs">
          {cellRef || "—"}
        </span>
        <span className="shrink-0 font-mono text-sm text-muted-foreground">fx</span>
        <input
          value={formulaDraft}
          disabled={!canEdit || !selectedRow || selectedColumn?.readOnly}
          onChange={(e) => setFormulaDraft(e.target.value)}
          onFocus={() => setFormulaFocused(true)}
          onBlur={() => {
            setFormulaFocused(false)
            commitFormulaBar()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commitFormulaBar()
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === "Escape") {
              e.preventDefault()
              setFormulaDraft(cellContents)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          placeholder={canEdit ? "Value, or =formula" : "Read-only"}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:border-primary disabled:opacity-60"
        />
        {canEdit && formulaDraft !== cellContents && (
          <>
            <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setFormulaDraft(cellContents)}>
              <X className="size-3.5" />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Confirm" onClick={commitFormulaBar}>
              <Check className="size-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Grid fills the rest of the window */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto p-2">
          <SheetGrid
            rows={rows}
            canEdit={canEdit}
            hiddenColumns={hiddenColumns}
            selection={selection}
            onSelect={setSelection}
            formationName={formationName}
            groupByFormation={groupByFormation}
          />
        </div>
        {commentsOpen && (
          <div className="w-80 shrink-0 border-l border-border p-2">
            <SheetComments
              comments={comments}
              selectedRowId={selectedRow?.id ?? null}
              selectedRowLabel={selectedLabel}
              open
              onClose={() => setCommentsOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 border-t border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
        <span>{canEdit ? "Ready" : "Read-only"}</span>
        {selectedColumn && <span>Column: {selectedColumn.header}</span>}
        <span className="ml-auto">
          Double-click or press Enter to edit · Ctrl+C / Ctrl+V works with Excel · Esc closes
        </span>
      </div>
    </div>
  )
}
