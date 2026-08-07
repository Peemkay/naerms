import { prisma } from "@/lib/prisma"
import { getVisibleFormationIds } from "@/lib/scope"
import { toIsoDate } from "@/lib/format"
import type { ReturnRow } from "@/components/returns-table"

/** Every return ITEM (equipment line) submitted by any of the given formations. */
export function getReturnItemsForFormations(formationIds: string[]) {
  return prisma.returnItem.findMany({
    where: { return: { formationId: { in: formationIds } } },
    include: {
      return: {
        include: { formation: { select: { id: true, name: true, type: true } } },
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
    equipmentSerial: item.equipmentSerial,
    band: item.band,
    status: item.status,
    condition: item.condition,
    dateIssued: toIsoDate(item.return.dateIssued),
  }
}

export function getReturnWithItems(returnId: string) {
  return prisma.return.findUnique({
    where: { id: returnId },
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
