import { prisma } from "@/lib/prisma"

export function getUnreadNotificationCount(formationId: string) {
  return prisma.notification.count({ where: { formationId, isRead: false } })
}

export function getRecentNotifications(formationId: string, limit = 15) {
  return prisma.notification.findMany({
    where: { formationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      return: { select: { requestRef: true } },
      request: { select: { requestRef: true } },
    },
  })
}
