"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  allColumns,
  columnLetter,
  isExtraColumn,
  type SheetColumn,
} from "@/lib/sheet/columns"
import { applyNumberFormat, evaluateGrid } from "@/lib/sheet/formula"
import { updateSheetCellAction } from "@/lib/actions/sheet"
import type { SheetRow } from "@/lib/sheet/data"

export type GridSelection = { row: number; col: number }

/**
 * The register rendered as an editable spreadsheet.
 *
 * Editing is per cell and optimistic: the value lands on screen immediately
 * and is written in the background, because a clerk tabbing across a row
 * must never wait on a round trip. A rejected write rolls that one cell back
 * and says why, rather than reloading and discarding the rest of the edits.
 *
 * Read-only viewers (superiors looking at a subordinate's sheet) get the
 * same grid with editing disabled — the server enforces this too, so the
 * disabled state here is convenience, not the security boundary.
 */
export function SheetGrid({
  rows,
  canEdit,
  hiddenColumns,
  onSelect,
  selection,
  formationName,
  groupByFormation = false,
}: {
  rows: SheetRow[]
  canEdit: boolean
  hiddenColumns: string[]
  onSelect?: (selection: GridSelection | null) => void
  selection: GridSelection | null
  formationName: string
  /** Consolidated sheet: start a titled block whenever the formation changes. */
  groupByFormation?: boolean
}) {
  const columns = useMemo(
    () => allColumns().filter((c) => !hiddenColumns.includes(c.key)),
    [hiddenColumns]
  )

  // Local overlay of edits, so the grid stays responsive while writes are in
  // flight and can roll back a single cell if one is refused.
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<GridSelection | null>(null)
  const [editValue, setEditValue] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const cellKey = (rowIndex: number, columnKey: string) => `${rowIndex}:${columnKey}`

  /** Literal contents of a cell: an override, a formula, or stored data. */
  const rawValueAt = useCallback(
    ({ row, col }: { row: number; col: number }): string | number | null => {
      const sheetRow = rows[row]
      const column = columns[col]
      if (!sheetRow || !column) return null

      const override = overrides[cellKey(row, column.key)]
      if (override !== undefined) return override

      const cell = sheetRow.cells[column.key]
      if (cell?.formula) return cell.formula
      if (isExtraColumn(column.key)) return cell?.value ?? ""
      if (column.key === "serial") return row + 1
      return sheetRow.values[column.key] ?? ""
    },
    [rows, columns, overrides]
  )

  // Formulas resolve against the whole visible grid, so a cell referencing
  // another formula shows that one's result rather than its source.
  const computed = useMemo(
    () =>
      evaluateGrid({
        rowCount: rows.length,
        colCount: columns.length,
        rawValue: rawValueAt,
      }),
    [rows.length, columns.length, rawValueAt]
  )

  const displayAt = useCallback(
    (rowIndex: number, colIndex: number): string => {
      const raw = rawValueAt({ row: rowIndex, col: colIndex })
      const column = columns[colIndex]
      const format = rows[rowIndex]?.cells[column.key]?.numberFormat ?? null
      if (typeof raw === "string" && raw.startsWith("=")) {
        return applyNumberFormat(computed.get(`${rowIndex}:${colIndex}`) ?? "", format)
      }
      return applyNumberFormat(String(raw ?? ""), format)
    },
    [rawValueAt, computed, columns, rows]
  )

  const commit = useCallback(
    async (rowIndex: number, column: SheetColumn, value: string) => {
      const sheetRow = rows[rowIndex]
      if (!sheetRow) return
      const key = cellKey(rowIndex, column.key)
      const previous = overrides[key]

      setOverrides((prev) => ({ ...prev, [key]: value }))

      const result = await updateSheetCellAction({
        returnItemId: sheetRow.id,
        columnKey: column.key,
        value,
      })

      if ("error" in result) {
        // Roll back just this cell, keeping every other pending edit.
        setOverrides((prev) => {
          const next = { ...prev }
          if (previous === undefined) delete next[key]
          else next[key] = previous
          return next
        })
        toast.error(result.error)
      }
    },
    [rows, overrides]
  )

  const startEditing = useCallback(
    (rowIndex: number, colIndex: number) => {
      const column = columns[colIndex]
      if (!canEdit || column.readOnly) return
      setEditing({ row: rowIndex, col: colIndex })
      const raw = rawValueAt({ row: rowIndex, col: colIndex })
      setEditValue(String(raw ?? ""))
    },
    [columns, canEdit, rawValueAt]
  )

  function finishEditing(move: "down" | "right" | null) {
    if (!editing) return
    const column = columns[editing.col]
    void commit(editing.row, column, editValue)
    const next =
      move === "down"
        ? { row: Math.min(editing.row + 1, rows.length - 1), col: editing.col }
        : move === "right"
          ? { row: editing.row, col: Math.min(editing.col + 1, columns.length - 1) }
          : editing
    setEditing(null)
    onSelect?.(next)
  }

  // Keyboard model mirrors Excel closely enough that muscle memory carries
  // over: arrows move, Enter/F2 edit, Escape cancels, typing replaces.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!selection || editing) return
      const target = event.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      const { row, col } = selection
      const move = (dRow: number, dCol: number) => {
        event.preventDefault()
        onSelect?.({
          row: Math.max(0, Math.min(rows.length - 1, row + dRow)),
          col: Math.max(0, Math.min(columns.length - 1, col + dCol)),
        })
      }

      switch (event.key) {
        case "ArrowDown": return move(1, 0)
        case "ArrowUp": return move(-1, 0)
        case "ArrowLeft": return move(0, -1)
        case "ArrowRight": return move(0, 1)
        case "Tab":
          event.preventDefault()
          return move(0, event.shiftKey ? -1 : 1)
        case "Enter":
        case "F2":
          event.preventDefault()
          return startEditing(row, col)
        case "Delete":
        case "Backspace": {
          event.preventDefault()
          const column = columns[col]
          if (!canEdit || column.readOnly) return
          void commit(row, column, "")
          return
        }
        default: {
          // A printable character starts an edit with that character, the
          // way typing over a selected cell does in Excel.
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const column = columns[col]
            if (!canEdit || column.readOnly) return
            event.preventDefault()
            setEditing({ row, col })
            setEditValue(event.key)
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selection, editing, rows.length, columns, canEdit, commit, onSelect, startEditing])

  /**
   * Paste a block straight from Excel: tab-separated columns, newline rows,
   * written from the selected cell rightward and downward. This is the
   * feature that makes an existing register usable without re-typing it.
   */
  useEffect(() => {
    if (!canEdit) return
    async function onPaste(event: ClipboardEvent) {
      if (!selection || editing) return
      const text = event.clipboardData?.getData("text/plain")
      if (!text) return
      event.preventDefault()

      const block = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").map((line) => line.split("\t"))
      const writes: Promise<void>[] = []

      block.forEach((cells, dRow) => {
        cells.forEach((value, dCol) => {
          const rowIndex = selection.row + dRow
          const colIndex = selection.col + dCol
          if (rowIndex >= rows.length || colIndex >= columns.length) return
          const column = columns[colIndex]
          if (column.readOnly) return
          writes.push(commit(rowIndex, column, value))
        })
      })

      await Promise.all(writes)
      toast.success(`Pasted ${block.length} row(s).`)
    }

    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [selection, editing, rows.length, columns, canEdit, commit])

  /** Copy the selected cell as text, so the sheet round-trips with Excel. */
  useEffect(() => {
    function onCopy(event: ClipboardEvent) {
      if (!selection || editing) return
      event.clipboardData?.setData("text/plain", displayAt(selection.row, selection.col))
      event.preventDefault()
    }
    window.addEventListener("copy", onCopy)
    return () => window.removeEventListener("copy", onCopy)
  }, [selection, editing, displayAt])

  return (
    <div ref={containerRef} className="overflow-auto rounded-lg border border-border bg-card">
      <table className="border-collapse text-xs" style={{ tableLayout: "fixed" }}>
        <thead className="sticky top-0 z-20">
          {/* The formation's name sits above the column headings, exactly as
              on the paper register where each block is titled with the
              formation it belongs to. */}
          <tr>
            <th
              colSpan={columns.length + 1}
              className="border border-border bg-muted px-2 py-2 text-left text-sm font-semibold"
            >
              {formationName}
            </th>
          </tr>
          <tr>
            {/* Corner cell above the row numbers. */}
            <th className="sticky left-0 z-30 w-12 border border-border bg-muted px-2 py-1.5 text-muted-foreground" />
            {columns.map((column, index) => (
              <th
                key={column.key}
                style={{ width: column.width, minWidth: column.width }}
                className="border border-border bg-muted px-2 py-1.5 text-left font-medium whitespace-nowrap"
                title={`${columnLetter(index)} · ${column.header}`}
              >
                <span className="mr-1.5 text-[10px] text-muted-foreground">{columnLetter(index)}</span>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <Fragment key={row.id}>
              {/* On a consolidated sheet each formation gets a titled band,
                  the way the paper master separates one unit's block from
                  the next. */}
              {groupByFormation && row.formationName !== rows[rowIndex - 1]?.formationName && (
                <tr>
                  <th
                    colSpan={columns.length + 1}
                    className="border border-border bg-muted/80 px-2 py-1.5 text-left text-xs font-semibold"
                  >
                    {row.formationName}
                  </th>
                </tr>
              )}
            <tr className="group">
              <td className="sticky left-0 z-10 border border-border bg-muted px-2 py-1 text-center text-[10px] text-muted-foreground">
                <span className="flex items-center justify-center gap-1">
                  {rowIndex + 1}
                  {row.unresolvedComments > 0 && (
                    <span
                      className="size-1.5 rounded-full bg-status-warning"
                      title={`${row.unresolvedComments} unresolved comment(s)`}
                    />
                  )}
                </span>
              </td>
              {columns.map((column, colIndex) => {
                const isSelected = selection?.row === rowIndex && selection?.col === colIndex
                const isEditing = editing?.row === rowIndex && editing?.col === colIndex
                const format = row.cells[column.key]
                return (
                  <td
                    key={column.key}
                    onClick={() => onSelect?.({ row: rowIndex, col: colIndex })}
                    onDoubleClick={() => startEditing(rowIndex, colIndex)}
                    style={{
                      backgroundColor: format?.fillColor ?? undefined,
                      color: format?.textColor ?? undefined,
                      fontWeight: format?.bold ? 600 : undefined,
                      fontStyle: format?.italic ? "italic" : undefined,
                    }}
                    title={
                      canEdit && !column.readOnly
                        ? "Double-click (or press Enter) to edit"
                        : undefined
                    }
                    className={cn(
                      "relative border border-border px-2 py-1 align-top",
                      column.readOnly && "bg-muted/40 text-muted-foreground",
                      isSelected && "ring-2 ring-primary ring-inset",
                      canEdit && !column.readOnly
                        ? "cursor-cell hover:bg-primary/5"
                        : "cursor-default"
                    )}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => finishEditing(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            finishEditing("down")
                          } else if (e.key === "Tab") {
                            e.preventDefault()
                            finishEditing("right")
                          } else if (e.key === "Escape") {
                            e.preventDefault()
                            setEditing(null)
                          }
                        }}
                        className="absolute inset-0 z-10 w-full border-2 border-primary bg-background px-2 py-1 text-xs outline-none"
                      />
                    ) : (
                      <span className="block truncate" title={displayAt(rowIndex, colIndex)}>
                        {displayAt(rowIndex, colIndex)}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
            </Fragment>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="border border-border px-3 py-10 text-center text-muted-foreground"
              >
                No returns on this sheet yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
