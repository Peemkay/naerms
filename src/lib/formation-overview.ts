import { prisma } from "@/lib/prisma"
import { getVisibleReturns } from "@/lib/returns"

export async function getFormationOverviewData(formationId: string) {
  const formation = await prisma.formation.findUniqueOrThrow({
    where: { id: formationId },
    include: { children: { orderBy: { name: "asc" } } },
  })
  const returns = await getVisibleReturns(formationId)
  return { formation, returns }
}

export type FormationOverviewData = Awaited<ReturnType<typeof getFormationOverviewData>>
