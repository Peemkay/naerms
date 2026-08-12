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

/**
 * Permanently removes a formation — only ever a genuinely unused node
 * (no subordinates, no returns on file, no status-change history, no
 * return requests sent or received). Blocked rather than cascaded in every
 * other case: a subtree getting silently orphaned (the DB's ON DELETE
 * SET NULL for parentId) or a return disappearing as a side effect of
 * deleting the formation that filed it would both undermine guarantees
 * this system otherwise makes on purpose (returns are a permanent record
 * until explicitly deleted one at a time; audit trails don't lose the
 * identity of who made a change). Its own notifications (its inbox, not
 * anyone else's record) are cleaned up as part of the same delete.
 */
export async function deleteFormationAction(formationId: string): Promise<ActionResult> {
  const session = await requirePrivilege("MANAGE_FORMATIONS")

  if (formationId === session.user.id) {
    return { error: "You cannot delete your own formation." }
  }

  const target = await prisma.formation.findUnique({ where: { id: formationId } })
  if (!target) return { error: "Formation not found." }
  if (target.type === "ROOT") {
    return { error: "The root formation cannot be deleted." }
  }

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(formationId)) {
    return { error: "That formation is outside your scope." }
  }

  const [childCount, returnCount, statusChangeCount, requestCount] = await Promise.all([
    prisma.formation.count({ where: { parentId: formationId } }),
    // Filed returns only. An unsubmitted draft is scratch work, not a
    // register entry, so it shouldn't block deleting the formation — the
    // cascade below clears it along with everything else.
    prisma.return.count({ where: { formationId, isDraft: false } }),
    prisma.statusHistory.count({ where: { changedById: formationId } }),
    prisma.returnRequest.count({
      where: { OR: [{ fromFormationId: formationId }, { toFormationId: formationId }] },
    }),
  ])

  if (childCount > 0) {
    return {
      error: `This formation has ${childCount} subordinate formation${childCount === 1 ? "" : "s"}. Delete or reassign them first.`,
    }
  }
  if (returnCount > 0) {
    return {
      error: `This formation has ${returnCount} return${returnCount === 1 ? "" : "s"} on file. Delete those individually first if you want to remove this formation.`,
    }
  }
  if (statusChangeCount > 0) {
    return {
      error: `This formation has made ${statusChangeCount} status change${statusChangeCount === 1 ? "" : "s"} on record elsewhere in the system and cannot be removed without breaking that audit trail.`,
    }
  }
  if (requestCount > 0) {
    return {
      error: `This formation has ${requestCount} return request${requestCount === 1 ? "" : "s"} on file (sent or received). Those need to be resolved first.`,
    }
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { formationId } }),
    // Drafts don't block deletion (they're not register entries), but
    // Return has no cascade from Formation, so they must go explicitly or
    // the delete below fails on a foreign-key constraint. Only drafts are
    // ever removed here: the guard above already proved there are no filed
    // returns left.
    prisma.return.deleteMany({ where: { formationId, isDraft: true } }),
    prisma.formation.delete({ where: { id: formationId } }),
  ])

  revalidatePath("/dashboard", "layout")
  return { success: true, id: formationId }
}
