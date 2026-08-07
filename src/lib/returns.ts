import { prisma } from "@/lib/prisma"
import { getVisibleFormationIds } from "@/lib/scope"
import { toIsoDate } from "@/lib/format"
import type { ReturnRow } from "@/components/returns-table"

export function getReturnsForFormations(formationIds: string[]) {
  return prisma.equipmentReturn.findMany({
    where: { formationId: { in: formationIds } },
    include: {
      formation: { select: { id: true, name: true, type: true } },
      submittedBy: { select: { id: true, fullName: true, rank: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

/** Everything visible to `rootFormationId`: itself plus every descendant. */
export async function getVisibleReturns(rootFormationId: string) {
  const ids = await getVisibleFormationIds(rootFormationId)
  return getReturnsForFormations(ids)
}

type ReturnWithRelations = Awaited<ReturnType<typeof getReturnsForFormations>>[number]

export function toReturnRow(r: ReturnWithRelations): ReturnRow {
  return {
    id: r.id,
    serialNo: r.serialNo,
    requestRef: r.requestRef,
    formationName: r.formation.name,
    equipmentName: r.equipmentName,
    equipmentModel: r.equipmentModel,
    equipmentSerial: r.equipmentSerial,
    band: r.band,
    status: r.status,
    condition: r.condition,
    dateIssued: toIsoDate(r.dateIssued),
    submittedByName: r.submittedBy.fullName,
  }
}

export function getReturnWithHistory(returnId: string) {
  return prisma.equipmentReturn.findUnique({
    where: { id: returnId },
    include: {
      formation: true,
      submittedBy: { select: { id: true, fullName: true, rank: true, serviceId: true } },
      statusHistory: {
        orderBy: { changedAt: "asc" },
        include: { changedBy: { select: { fullName: true, rank: true, role: true } } },
      },
    },
  })
}
