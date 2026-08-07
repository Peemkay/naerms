"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import type { Privilege } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { requirePrivilege } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { ALL_PRIVILEGES, canGrant } from "@/lib/privileges"
import {
  accountFormSchema,
  formationFormSchema,
  privilegesFormSchema,
} from "@/lib/validation/formation"

type ActionResult =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }

/** Only formations holding MANAGE_FORMATIONS may add new formations. */
export async function createFormationAction(values: unknown): Promise<ActionResult> {
  const session = await requirePrivilege("MANAGE_FORMATIONS")

  const parsed = formationFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const parent = await prisma.formation.findUnique({ where: { id: parsed.data.parentId } })
  if (!parent) {
    return { error: "The selected parent formation no longer exists." }
  }

  if (parsed.data.privileges.length > 0 && !canGrant(session.user.privileges, parsed.data.privileges)) {
    return {
      error: "You can only grant privileges you hold yourself, and only with the Assign Privileges privilege.",
      fieldErrors: { privileges: ["Not all of these are yours to grant"] },
    }
  }

  let passwordHash: string | null = null
  if (parsed.data.email && parsed.data.password) {
    const existing = await prisma.formation.findUnique({ where: { email: parsed.data.email } })
    if (existing) {
      return { error: "That email is already in use.", fieldErrors: { email: ["Already registered"] } }
    }
    passwordHash = await bcrypt.hash(parsed.data.password, 10)
  }

  const created = await prisma.formation.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      parentId: parsed.data.parentId,
      role: parsed.data.role || null,
      attachedTo: parsed.data.type === "BRIGADE_SIGNALS" ? parsed.data.attachedTo || null : null,
      email: parsed.data.email || null,
      passwordHash,
      privileges: parsed.data.privileges,
    },
  })

  // Both trees read from the same table, and either could have the new
  // formation as a visible descendant somewhere in their sidebar/dropdowns.
  revalidatePath("/dashboard", "layout")

  return { success: true, id: created.id }
}

/** Sets or resets a formation's login (email + password) — MANAGE_ACCOUNTS, scoped. */
export async function setAccountAction(formationId: string, values: unknown): Promise<ActionResult> {
  const session = await requirePrivilege("MANAGE_ACCOUNTS")

  const parsed = accountFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const target = await prisma.formation.findUnique({ where: { id: formationId } })
  if (!target) return { error: "Formation not found." }

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(formationId)) {
    return { error: "That formation is outside your scope." }
  }

  const emailInUse = await prisma.formation.findFirst({
    where: { email: parsed.data.email, NOT: { id: formationId } },
  })
  if (emailInUse) {
    return { error: "That email is already in use.", fieldErrors: { email: ["Already registered"] } }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)
  await prisma.formation.update({
    where: { id: formationId },
    data: {
      email: parsed.data.email,
      passwordHash,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })

  revalidatePath("/dashboard/accounts")
  return { success: true, id: formationId }
}

export async function setAccountActiveAction(formationId: string, isActive: boolean): Promise<ActionResult> {
  const session = await requirePrivilege("MANAGE_ACCOUNTS")

  const target = await prisma.formation.findUnique({ where: { id: formationId } })
  if (!target) return { error: "Formation not found." }
  if (target.id === session.user.id) return { error: "You cannot deactivate your own account." }

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(formationId)) {
    return { error: "That formation is outside your scope." }
  }

  await prisma.formation.update({ where: { id: formationId }, data: { isActive } })
  revalidatePath("/dashboard/accounts")
  return { success: true, id: formationId }
}

/**
 * Grants/revokes privileges on another formation. A granter only ever
 * affects the privileges *it itself holds* — a privilege it doesn't have is
 * left exactly as-is on the target, so this can never be used to strip
 * access it had no authority over in the first place.
 */
export async function setPrivilegesAction(formationId: string, values: unknown): Promise<ActionResult> {
  const session = await requirePrivilege("MANAGE_PRIVILEGES")

  const parsed = privilegesFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const target = await prisma.formation.findUnique({ where: { id: formationId } })
  if (!target) return { error: "Formation not found." }

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(formationId)) {
    return { error: "That formation is outside your scope." }
  }

  const requested = new Set(parsed.data.privileges)
  const next = new Set(target.privileges)
  for (const privilege of ALL_PRIVILEGES) {
    if (!session.user.privileges.includes(privilege)) continue // not yours to touch
    if (requested.has(privilege)) next.add(privilege)
    else next.delete(privilege)
  }

  await prisma.formation.update({
    where: { id: formationId },
    data: { privileges: Array.from(next) as Privilege[] },
  })

  revalidatePath("/dashboard/accounts")
  return { success: true, id: formationId }
}
