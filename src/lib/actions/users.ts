"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { ADMIN_ROLES, getAssignableRoles } from "@/lib/roles"
import { userFormSchema } from "@/lib/validation/user"

type ActionResult =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }

/**
 * User accounts grant login access, so — unlike formations — creating one is
 * restricted to admin-tier roles, scoped to formations they can already see,
 * and capped to roles at or below the creator's own (no self-escalation).
 */
export async function createUserAction(values: unknown): Promise<ActionResult> {
  const session = await requireRole(ADMIN_ROLES)

  const parsed = userFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  if (!getAssignableRoles(session.user.role).includes(parsed.data.role)) {
    return { error: "You cannot assign a role higher than your own." }
  }

  const visibleIds = await getVisibleFormationIds(session.user.formationId)
  if (!visibleIds.includes(parsed.data.formationId)) {
    return { error: "That formation is outside your scope." }
  }

  const existing = await prisma.user.findUnique({ where: { serviceId: parsed.data.serviceId } })
  if (existing) {
    return { error: "That service ID is already registered.", fieldErrors: { serviceId: ["Already in use"] } }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)

  const created = await prisma.user.create({
    data: {
      serviceId: parsed.data.serviceId,
      fullName: parsed.data.fullName,
      rank: parsed.data.rank || null,
      role: parsed.data.role,
      formationId: parsed.data.formationId,
      passwordHash,
    },
  })

  revalidatePath("/admin/users")
  return { success: true, id: created.id }
}

export async function setUserActiveAction(userId: string, isActive: boolean): Promise<ActionResult> {
  const session = await requireRole(ADMIN_ROLES)

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) return { error: "User not found." }

  const visibleIds = await getVisibleFormationIds(session.user.formationId)
  if (!visibleIds.includes(target.formationId)) {
    return { error: "That user is outside your scope." }
  }
  if (target.id === session.user.id) {
    return { error: "You cannot deactivate your own account." }
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive } })
  revalidatePath("/admin/users")
  return { success: true, id: userId }
}
