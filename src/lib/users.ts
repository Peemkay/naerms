import { prisma } from "@/lib/prisma"

export function getUsersForFormations(formationIds: string[]) {
  return prisma.user.findMany({
    where: { formationId: { in: formationIds } },
    include: { formation: { select: { id: true, name: true, type: true } } },
    orderBy: [{ formation: { name: "asc" } }, { fullName: "asc" }],
  })
}
