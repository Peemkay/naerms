import { notFound } from "next/navigation"

import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import {
  getSheetAccess,
  getSheetComments,
  getSheetRows,
  getSheetSettings,
  getSubtreeSheetRows,
} from "@/lib/sheet/data"
import { SheetWorkspace } from "@/components/sheet/sheet-workspace"
import { SheetScopeTabs } from "@/components/sheet/sheet-scope-tabs"

/**
 * A formation's whole register as one spreadsheet.
 *
 * ?formation= opens a subordinate's sheet. Access is resolved server-side
 * (own = editable, subordinate = read + comment, anything else = 404), so
 * hand-typing another formation's id gets nowhere.
 */
export default async function SheetPage({
  searchParams,
}: {
  searchParams: Promise<{ formation?: string; scope?: string }>
}) {
  const session = await requireSession()
  const { formation: requestedId, scope } = await searchParams
  const targetId = requestedId ?? session.user.id

  const access = await getSheetAccess(session.user.id, targetId)
  if (access === "none") notFound()

  const formation = await prisma.formation.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, _count: { select: { children: true } } },
  })
  if (!formation) notFound()

  // "All subordinate returns on one sheet", the way NAS keeps its master
  // register. Always read-only: the rows belong to different formations and
  // only their owner may edit them, so a consolidated sheet must not become
  // a way around that.
  const consolidated = scope === "all" && formation._count.children > 0

  const [rows, comments, settings] = await Promise.all([
    consolidated ? getSubtreeSheetRows(targetId) : getSheetRows(targetId),
    getSheetComments(targetId),
    getSheetSettings(targetId),
  ])

  return (
    <div className="flex flex-col gap-4">
      {/* Title block mirrors the paper register: the document names itself
          and the formation it belongs to, above the column headings. */}
      <div>
        <p className="text-xs tracking-widest text-muted-foreground uppercase">
          Equipment Returns Register
        </p>
        <h1 className="text-lg font-semibold">
          {formation.name}
          {consolidated && " and all subordinates"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {consolidated
            ? "Every formation under you, on one sheet. Read-only: each formation edits its own register."
            : access === "owner"
              ? "Your unit sheet. Every return you submit is added here automatically."
              : "Read-only. You can comment on any row, but only this formation can edit its own register."}
        </p>
      </div>

      {formation._count.children > 0 && (
        <SheetScopeTabs formationId={formation.id} scope={consolidated ? "all" : "own"} />
      )}

      <SheetWorkspace
        rows={rows}
        comments={comments}
        // A consolidated sheet spans formations, so nothing in it is
        // editable here even for the formation that owns the top of it.
        canEdit={access === "owner" && !consolidated}
        hiddenColumns={settings.hiddenColumns}
        formationName={consolidated ? `${formation.name} (all subordinates)` : formation.name}
        groupByFormation={consolidated}
      />
    </div>
  )
}
