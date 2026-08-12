"use client"

import { useState } from "react"
import { Eye, Maximize2, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SheetGrid, type GridSelection } from "@/components/sheet/sheet-grid"
import { SheetToolbar } from "@/components/sheet/sheet-toolbar"
import { SheetComments } from "@/components/sheet/sheet-comments"
import { SheetEditor } from "@/components/sheet/sheet-editor"
import type { SheetComment, SheetRow } from "@/lib/sheet/data"

/**
 * Holds the state the grid, toolbar and comment panel all need: which cell
 * is selected. Kept in one client component so the page itself stays a
 * server component and the sheet data is fetched on the server.
 */
export function SheetWorkspace({
  rows,
  comments,
  canEdit,
  hiddenColumns,
  formationName,
}: {
  rows: SheetRow[]
  comments: SheetComment[]
  canEdit: boolean
  hiddenColumns: string[]
  formationName: string
}) {
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const selectedRow = selection ? rows[selection.row] : null
  const selectedLabel = selectedRow
    ? `Row ${(selection?.row ?? 0) + 1} · ${selectedRow.values.equipmentName || "(no equipment name)"}`
    : ""

  if (editorOpen) {
    return (
      <SheetEditor
        rows={rows}
        comments={comments}
        canEdit={canEdit}
        hiddenColumns={hiddenColumns}
        formationName={formationName}
        onClose={() => setEditorOpen(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The way into editing. Cell editing on the embedded grid is
          double-click, which is invisible until you happen to try it — so
          the primary action states plainly that the sheet can be worked on,
          and opens it full screen with the tools on show. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2">
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Open the register to add rows, edit cells, format and use formulas."
            : "You can read this register and comment on it."}
        </p>
        <Button size="sm" onClick={() => setEditorOpen(true)}>
          {canEdit ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
          {canEdit ? "Edit Register" : "Open Full Screen"}
          <Maximize2 className="size-3.5 opacity-70" />
        </Button>
      </div>

      <SheetToolbar
        rows={rows}
        selection={selection}
        canEdit={canEdit}
        formationName={formationName}
        onComment={() => setCommentsOpen(true)}
      />
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1">
          <SheetGrid
            rows={rows}
            canEdit={canEdit}
            hiddenColumns={hiddenColumns}
            selection={selection}
            onSelect={setSelection}
            formationName={formationName}
          />
        </div>
        <SheetComments
          comments={comments}
          selectedRowId={selectedRow?.id ?? null}
          selectedRowLabel={selectedLabel}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
      </div>
    </div>
  )
}
