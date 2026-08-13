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
  moveFormationSchema,
  reorderFormationsSchema,
  privilegesFormSchema,
  renameFormationSchema,
} from "@/lib/validation/formation"

type ActionResult =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }

/**
 * Renames a formation and updates its role and attachment.
 *
 * Its place in the tree is untouched — moving is a separate, more dangerous
 * operation (see moveFormationAction).
 */
export async function renameFormationAction(
  formationId: string,
  values: unknown
): Promise<ActionResult> {
  const session = await requirePrivilege("MANAGE_FORMATIONS")

  const parsed = renameFormationSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const target = await prisma.formation.findUnique({
    where: { id: formationId },
    select: { id: true },
  })
  if (!target) return { error: "That formation no longer exists." }

  // Scope: you can only rename within your own subtree, same rule as every
  // other formation action.
  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(formationId)) {
    return { error: "That formation is outside your scope." }
  }

  await prisma.formation.update({
    where: { id: formationId },
    data: {
      name: parsed.data.name,
      role: parsed.data.role || null,
      attachedTo: parsed.data.attachedTo || null,
    },
  })

  revalidatePath("/dashboard", "layout")
  return { success: true, id: formationId }
}

/**
 * Reorders siblings under one parent, from a drag in the tree.
 *
 * Purely cosmetic: sortOrder affects listing order and nothing else, so
 * this needs none of the cycle guards a move does. The ids must all be
 * actual children of the given parent, so a crafted request can't reorder
 * (and thereby touch) formations elsewhere in the tree.
 */
export async function reorderFormationsAction(values: unknown): Promise<ActionResult> {
  const session = await requirePrivilege("MOVE_FORMATIONS")

  const parsed = reorderFormationsSchema.safeParse(values)
  if (!parsed.success) return { error: "Invalid ordering." }
  const { parentId, orderedIds } = parsed.data

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (orderedIds.some((id) => !visibleIds.includes(id))) {
    return { error: "Those formations are outside your scope." }
  }

  const siblings = await prisma.formation.findMany({
    where: { parentId: parentId ?? null },
    select: { id: true },
  })
  const siblingIds = new Set(siblings.map((s) => s.id))
  if (orderedIds.some((id) => !siblingIds.has(id))) {
    return { error: "Those formations do not share a parent." }
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.formation.update({ where: { id }, data: { sortOrder: index } })
    )
  )

  revalidatePath("/dashboard", "layout")
  return { success: true, id: orderedIds[0] }
}

/**
 * Moves a formation — and everything beneath it — under a different parent.
 *
 * This is the most destructive non-deleting operation in the system:
 * `parentId` is what scope is computed from, so re-parenting silently
 * changes who can see and verify an entire subtree's returns. Hence the
 * guards below, each of which prevents a specific way of corrupting the
 * tree:
 *
 *   - moving into your own subtree would detach that branch entirely,
 *     leaving its returns visible to nobody;
 *   - both formations must be in the caller's scope, so a brigade cannot
 *     reach outside its own command to rearrange someone else's units.
 *
 * A null parent means "top level". Every formation is movable, NAS
 * included: with a single fixed root, the root was unmovable by definition
 * (everything else is beneath it, so every target was its own descendant).
 * Allowing several top-level formations removes that special case.
 */
export async function moveFormationAction(
  formationId: string,
  values: unknown
): Promise<ActionResult> {
  const session = await requirePrivilege("MOVE_FORMATIONS")

  const parsed = moveFormationSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Pick the formation it should report to." }
  }
  // "" from an unset <Select> means the same as absent: the top level.
  const parentId = parsed.data.parentId ? parsed.data.parentId : null

  const target = await prisma.formation.findUnique({
    where: { id: formationId },
    select: { id: true, name: true, parentId: true },
  })
  if (!target) return { error: "That formation no longer exists." }

  if (formationId === parentId) {
    return { error: "A formation cannot report to itself." }
  }
  if (target.parentId === parentId) {
    return {
      error: parentId
        ? `${target.name} already reports to that formation.`
        : `${target.name} is already at the top level.`,
    }
  }

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(formationId)) {
    return { error: "That formation is outside your scope." }
  }

  let newParentName = "the top level"
  if (parentId) {
    const newParent = await prisma.formation.findUnique({
      where: { id: parentId },
      select: { id: true, name: true },
    })
    if (!newParent) return { error: "That parent formation no longer exists." }

    // The new parent normally has to be in scope too. The exception is a
    // formation that currently sits at the top level: it has no superior to
    // answer to, so placing it under one (NAS moving under an Army
    // Headquarters, say) is a legitimate act that by definition targets
    // something outside its own subtree. The cycle guard below still
    // applies, so this cannot be used to detach a branch.
    const movingFromTopLevel = target.parentId === null
    if (!visibleIds.includes(parentId) && !movingFromTopLevel) {
      return { error: "Both formations must be within your scope." }
    }
    newParentName = newParent.name

    // The cycle guard. Moving a formation under one of its own descendants
    // would cut that whole branch loose: it would still exist, but no scope
    // query from the top could reach it, so its returns would vanish from
    // every dashboard while remaining on file. Moving to the top level can
    // never cycle, so this only applies when there is a parent.
    const subtree = await getVisibleFormationIds(formationId)
    if (subtree.includes(parentId)) {
      return {
        error: `${newParentName} sits under ${target.name}, so moving it there would detach the branch from the chain of command.`,
      }
    }
  }

  await prisma.formation.update({
    where: { id: formationId },
    data: { parentId },
  })

  revalidatePath("/dashboard", "layout")
  return { success: true, id: formationId }
}

/** Only formations holding MANAGE_FORMATIONS may add new formations. */
export async function createFormationAction(values: unknown): Promise<ActionResult> {
  const session = await requirePrivilege("MANAGE_FORMATIONS")

  const parsed = formationFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  // No parent means a top-level formation, which is how NAS itself sits.
  const parentId = parsed.data.parentId ? parsed.data.parentId : null
  if (parentId) {
    const parent = await prisma.formation.findUnique({ where: { id: parentId } })
    if (!parent) {
      return { error: "The selected parent formation no longer exists." }
    }
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
      parentId,
      role: parsed.data.role || null,
      attachedTo: parsed.data.attachedTo || null,
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

  // The last top-level formation can't be deleted: the tree would have no
  // entry point, and nothing below it would be reachable. Replaces the old
  // "ROOT cannot be deleted" rule now that top level is a position rather
  // than a type.
  if (target.parentId === null) {
    const topLevelCount = await prisma.formation.count({ where: { parentId: null } })
    if (topLevelCount <= 1) {
      return { error: "This is the only top-level formation, so it cannot be deleted." }
    }
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
