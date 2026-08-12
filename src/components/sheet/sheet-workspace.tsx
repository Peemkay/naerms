"use client"

import { useState } from "react"

import { SheetGrid, type GridSelection } from "@/components/sheet/sheet-grid"
import { SheetToolbar } from "@/components/sheet/sheet-toolbar"
import { SheetComments } from "@/components/sheet/sheet-comments"
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

  const selectedRow = selection ? rows[selection.row] : null
  const selectedLabel = selectedRow
    ? `Row ${(selection?.row ?? 0) + 1} · ${selectedRow.values.equipmentName || "(no equipment name)"}`
    : ""

  return (
    <div className="flex flex-col gap-3">
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
