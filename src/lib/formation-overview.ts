import { prisma } from "@/lib/prisma"
import { getVisibleReturnItems } from "@/lib/returns"

export async function getFormationOverviewData(formationId: string) {
  const formation = await prisma.formation.findUniqueOrThrow({
    where: { id: formationId },
    include: { children: { orderBy: { name: "asc" } } },
  })
  const returnItems = await getVisibleReturnItems(formationId)
  return { formation, returnItems }
}

export type FormationOverviewData = Awaited<ReturnType<typeof getFormationOverviewData>>
