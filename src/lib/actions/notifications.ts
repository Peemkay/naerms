"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"

export async function markAllNotificationsReadAction() {
  const session = await requireSession()
  await prisma.notification.updateMany({
    where: { formationId: session.user.id, isRead: false },
    data: { isRead: true },
  })
  revalidatePath("/", "layout")
}
