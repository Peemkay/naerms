import { notFound } from "next/navigation"

import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import {
  getSheetAccess,
  getSheetComments,
  getSheetRows,
  getSheetSettings,
} from "@/lib/sheet/data"
import { SheetWorkspace } from "@/components/sheet/sheet-workspace"

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
  searchParams: Promise<{ formation?: string }>
}) {
  const session = await requireSession()
  const { formation: requestedId } = await searchParams
  const targetId = requestedId ?? session.user.id

  const access = await getSheetAccess(session.user.id, targetId)
  if (access === "none") notFound()

  const formation = await prisma.formation.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, type: true },
  })
  if (!formation) notFound()

  const [rows, comments, settings] = await Promise.all([
    getSheetRows(targetId),
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
        <h1 className="text-lg font-semibold">{formation.name}</h1>
        <p className="text-sm text-muted-foreground">
          {access === "owner"
            ? "Your unit sheet. Every return you submit is added here automatically."
            : "Read-only. You can comment on any row, but only this formation can edit its own register."}
        </p>
      </div>

      <SheetWorkspace
        rows={rows}
        comments={comments}
        canEdit={access === "owner"}
        hiddenColumns={settings.hiddenColumns}
        formationName={formation.name}
      />
    </div>
  )
}
