import { prisma } from "@/lib/prisma"
import { getVisibleFormationIds } from "@/lib/scope"
import { toIsoDate } from "@/lib/format"
import { conditionBreakdownText, dominantCondition } from "@/lib/condition-breakdown"
import type { ReturnRow } from "@/components/returns-table"

/**
 * Every return ITEM (equipment line) submitted by any of the given formations.
 *
 * Drafts are excluded here, at the single source every registry view and
 * dashboard count flows through — an unsubmitted draft is not in the
 * register, so it must never appear in a listing, a status tally, or a
 * condition breakdown.
 */
export function getReturnItemsForFormations(formationIds: string[]) {
  return prisma.returnItem.findMany({
    where: { return: { formationId: { in: formationIds }, isDraft: false } },
    include: {
      return: {
        include: { formation: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

/** Everything visible to `rootFormationId`: itself plus every descendant. */
export async function getVisibleReturnItems(rootFormationId: string) {
  const ids = await getVisibleFormationIds(rootFormationId)
  return getReturnItemsForFormations(ids)
}

type ReturnItemWithRelations = Awaited<ReturnType<typeof getReturnItemsForFormations>>[number]

export function toReturnRow(item: ReturnItemWithRelations): ReturnRow {
  return {
    id: item.id,
    returnId: item.returnId,
    lineNo: item.lineNo,
    requestRef: item.return.requestRef,
    formationName: item.return.formation.name,
    equipmentName: item.equipmentName,
    equipmentModel: item.equipmentModel,
    band: item.band,
    status: item.status,
    quantity: item.quantity,
    conditionSummary: conditionBreakdownText(item),
    conditionTone: dominantCondition(item),
    dateIssued: toIsoDate(item.dateIssued),
  }
}

/**
 * A formation's own saved drafts, newest first. Drafts are private to the
 * formation that owns them — unlike submitted returns, they are never
 * visible up or down the chain of command, so this takes a single id rather
 * than a visible-scope list.
 */
export function getDraftsForFormation(formationId: string) {
  return prisma.return.findMany({
    where: { formationId, isDraft: true },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  })
}

export function getDraftWithItems(draftId: string, formationId: string) {
  return prisma.return.findFirst({
    where: { id: draftId, formationId, isDraft: true },
    include: { items: { orderBy: { lineNo: "asc" } } },
  })
}

/**
 * A filed return with its items, for the detail and print views. Drafts are
 * excluded: they are not register entries, so they have no detail page and
 * nothing to print. Resuming one goes through /dashboard/new-return?draft=.
 */
export function getReturnWithItems(returnId: string) {
  return prisma.return.findFirst({
    where: { id: returnId, isDraft: false },
    include: {
      formation: true,
      items: {
        orderBy: { lineNo: "asc" },
        include: {
          statusHistory: {
            orderBy: { changedAt: "asc" },
            include: { changedBy: { select: { name: true } } },
          },
        },
      },
    },
  })
}

export function getReturnItemWithReturn(returnItemId: string) {
  return prisma.returnItem.findUnique({
    where: { id: returnItemId },
    include: { return: true },
  })
}
