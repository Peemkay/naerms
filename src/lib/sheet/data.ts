import { prisma } from "@/lib/prisma"
import { getVisibleFormationIds } from "@/lib/scope"
import { toIsoDate } from "@/lib/format"
import { CONDITION_SHEET_LABEL } from "@/lib/sheet/columns"
import type { EquipmentCondition } from "@prisma/client"

/**
 * Loading a formation's register as a spreadsheet.
 *
 * Access has exactly two levels, and they are decided here rather than in
 * the UI so a hand-typed URL can't get past them:
 *
 *   own formation  -> read + write
 *   subordinate    -> read + comment, never write
 *   anyone else    -> nothing
 *
 * Superiors are read-only by design: an equipment holding is the owning
 * formation's own declaration, so an edit from above would both break that
 * accountability and race the owner's own typing.
 */

export type SheetAccess = "owner" | "reader" | "none"

export async function getSheetAccess(
  viewerFormationId: string,
  targetFormationId: string
): Promise<SheetAccess> {
  if (viewerFormationId === targetFormationId) return "owner"
  const visible = await getVisibleFormationIds(viewerFormationId)
  return visible.includes(targetFormationId) ? "reader" : "none"
}

/** The dominant condition for a row, used for the sheet's Status column. */
function conditionOf(item: {
  serviceableQty: number
  unserviceableQty: number
  underRepairQty: number
  awaitingEvacuationQty: number
}): EquipmentCondition | null {
  const buckets: [EquipmentCondition, number][] = [
    ["SERVICEABLE", item.serviceableQty],
    ["UNSERVICEABLE", item.unserviceableQty],
    ["UNDER_REPAIR", item.underRepairQty],
    ["AWAITING_EVACUATION", item.awaitingEvacuationQty],
  ]
  const top = buckets.reduce((a, b) => (b[1] > a[1] ? b : a))
  return top[1] > 0 ? top[0] : null
}

export type SheetRow = {
  /** ReturnItem id: the stable address for edits, formatting and comments. */
  id: string
  returnId: string
  isDraft: boolean
  /** Owning formation, so a consolidated subtree sheet can group by it. */
  formationName: string
  values: Record<string, string | number>
  /** Cell formatting and free-column contents, keyed by column. */
  cells: Record<
    string,
    {
      value: string | null
      formula: string | null
      bold: boolean | null
      italic: boolean | null
      fillColor: string | null
      textColor: string | null
      numberFormat: string | null
    }
  >
  commentCount: number
  unresolvedComments: number
}

/**
 * Every filed return line for one formation, as sheet rows.
 *
 * Drafts are excluded: they aren't in the register, and a superior reading a
 * subordinate's sheet must not see work the subordinate hasn't submitted.
 */
export async function getSheetRows(formationId: string): Promise<SheetRow[]> {
  const items = await prisma.returnItem.findMany({
    where: { return: { formationId, isDraft: false } },
    include: {
      return: { include: { formation: { select: { name: true } } } },
      sheetCells: true,
      _count: { select: { sheetComments: true } },
      sheetComments: { where: { resolvedAt: null }, select: { id: true } },
    },
    // Register order: oldest first, matching how the paper sheet accretes.
    orderBy: [{ return: { createdAt: "asc" } }, { lineNo: "asc" }],
  })

  return items.map((item) => toSheetRow(item))
}

/** Shared shape for both the own-formation and consolidated subtree views. */
function toSheetRow(item: {
  id: string
  returnId: string
  letterOfRequest: string | null
  authority: string | null
  dateIssued: Date | null
  fmnUnitIssued: string | null
  howDeployed: string | null
  purposeOfIssue: string | null
  equipmentName: string
  equipmentModel: string | null
  band: string | null
  equipmentType: string | null
  equipmentSerial: string | null
  origin: string | null
  status: string
  quantity: number
  serviceableQty: number
  unserviceableQty: number
  underRepairQty: number
  awaitingEvacuationQty: number
  remarks: string | null
  return: { isDraft: boolean; requestRef: string; formation: { name: string } }
  sheetCells: {
    columnKey: string
    value: string | null
    formula: string | null
    bold: boolean | null
    italic: boolean | null
    fillColor: string | null
    textColor: string | null
    numberFormat: string | null
  }[]
  _count: { sheetComments: number }
  sheetComments: { id: string }[]
}): SheetRow {
  {
    const condition = conditionOf(item)
    return {
      id: item.id,
      returnId: item.returnId,
      isDraft: item.return.isDraft,
      formationName: item.return.formation.name,
      values: {
        letterOfRequest: item.letterOfRequest ?? "",
        authority: item.authority ?? "",
        dateIssued: toIsoDate(item.dateIssued) ?? "",
        // Falls back to the owning formation's name only when the clerk
        // hasn't named a sub-unit, so an untouched row still reads sensibly.
        fmnUnitIssued: item.fmnUnitIssued ?? item.return.formation.name,
        howDeployed: item.howDeployed ?? "",
        purposeOfIssue: item.purposeOfIssue ?? "",
        equipmentName: item.equipmentName,
        equipmentModel: item.equipmentModel ?? "",
        band: item.band ?? "",
        equipmentType: item.equipmentType ?? "",
        equipmentSerial: item.equipmentSerial ?? "",
        origin: item.origin ?? "",
        condition: condition ? CONDITION_SHEET_LABEL[condition] : "",
        remarks: item.remarks ?? "",
        workflow: item.status,
        quantity: item.quantity,
        serviceableQty: item.serviceableQty,
        unserviceableQty: item.unserviceableQty,
        underRepairQty: item.underRepairQty,
        awaitingEvacuationQty: item.awaitingEvacuationQty,
        requestRef: item.return.requestRef,
      },
      cells: Object.fromEntries(
        item.sheetCells.map((cell) => [
          cell.columnKey,
          {
            value: cell.value,
            formula: cell.formula,
            bold: cell.bold,
            italic: cell.italic,
            fillColor: cell.fillColor,
            textColor: cell.textColor,
            numberFormat: cell.numberFormat,
          },
        ])
      ),
      commentCount: item._count.sheetComments,
      unresolvedComments: item.sheetComments.length,
    }
  }
}

/**
 * Every filed line from a formation *and everything under it*, as one
 * sheet.
 *
 * This is how NAS keeps its master register: one workbook, every
 * subordinate's returns in it, each block titled with the formation. Any
 * formation can do the same over its own subtree — a brigade sees its
 * regiments, a regiment sees its units.
 *
 * Always read-only. The rows belong to different formations, and only the
 * owning formation may change its own holdings (see getSheetAccess); a
 * consolidated view that let you edit another unit's line would route
 * straight around that.
 */
export async function getSubtreeSheetRows(rootFormationId: string): Promise<SheetRow[]> {
  const ids = await getVisibleFormationIds(rootFormationId)
  const items = await prisma.returnItem.findMany({
    where: { return: { formationId: { in: ids }, isDraft: false } },
    include: {
      return: { include: { formation: { select: { id: true, name: true } } } },
      sheetCells: true,
      _count: { select: { sheetComments: true } },
      sheetComments: { where: { resolvedAt: null }, select: { id: true } },
    },
    // Grouped by formation, then in register order within each, so the
    // sheet reads as one block per unit like the paper master does.
    orderBy: [
      { return: { formation: { name: "asc" } } },
      { return: { createdAt: "asc" } },
      { lineNo: "asc" },
    ],
  })

  return items.map((item) => toSheetRow(item))
}

export async function getSheetSettings(formationId: string) {
  const settings = await prisma.sheetSettings.findUnique({ where: { formationId } })
  return {
    columnWidths: (settings?.columnWidths as Record<string, number> | null) ?? {},
    hiddenColumns: (settings?.hiddenColumns as string[] | null) ?? [],
  }
}

export async function getSheetComments(formationId: string) {
  const comments = await prisma.sheetComment.findMany({
    where: { returnItem: { return: { formationId, isDraft: false } } },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  })
  return comments.map((c) => ({
    id: c.id,
    returnItemId: c.returnItemId,
    columnKey: c.columnKey,
    authorName: c.author.name,
    authorId: c.authorId,
    body: c.body,
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }))
}

export type SheetComment = Awaited<ReturnType<typeof getSheetComments>>[number]
