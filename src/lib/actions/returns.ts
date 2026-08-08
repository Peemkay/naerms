"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { getDefaultOriginForFormation, getFormationAncestors } from "@/lib/formation"
import { returnFormSchema, statusChangeSchema, type ReturnItemInput } from "@/lib/validation/return"

type ActionResult =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }

function toItemData(item: ReturnItemInput, lineNo: number) {
  return {
    lineNo,
    dateIssued: item.dateIssued ? new Date(item.dateIssued) : null,
    howDeployed: item.howDeployed || null,
    purposeOfIssue: item.purposeOfIssue || null,
    equipmentName: item.equipmentName,
    equipmentModel: item.equipmentModel || null,
    band: item.band || null,
    equipmentType: item.equipmentType || null,
    origin: item.origin || null,
    quantity: item.quantity,
    serviceableQty: item.serviceableQty,
    unserviceableQty: item.unserviceableQty,
    underRepairQty: item.underRepairQty,
    awaitingEvacuationQty: item.awaitingEvacuationQty,
    remarks: item.remarks || null,
  }
}

/**
 * Creates a Return (one register submission) with its equipment items, under
 * the caller's own formation. Every formation in the caller's own subtree
 * (its subordinates — never itself, never its superiors) gets notified: a
 * leaf UNIT's request notifies no one, a Brigade's fans out to everything
 * below it.
 */
export async function createReturnAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  const parsed = returnFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const formationId = session.user.id
  const defaultOrigin = await getDefaultOriginForFormation(formationId)

  const created = await prisma.return.create({
    data: {
      requestRef: parsed.data.requestRef,
      auth: parsed.data.auth || null,
      formationId,
      items: {
        create: parsed.data.items.map((item, index) => ({
          ...toItemData(item, index + 1),
          origin: item.origin || defaultOrigin || null,
        })),
      },
    },
  })

  // Notify subordinates — descendants minus the submitter itself.
  const subtree = await getVisibleFormationIds(formationId)
  const downwardRecipients = subtree.filter((id) => id !== formationId)

  // If this requestRef answers an open request addressed to this formation
  // or one of its superiors — requests only ever travel downward (see
  // requestReturnAction), so the original requester is always somewhere up
  // this chain — also notify everyone up the chain of command: everyone who
  // could see the ask gets to see it's been answered, not just whoever
  // happened to make it.
  const ancestors = await getFormationAncestors(formationId) // self first, then upward
  const ancestorIds = ancestors.map((f) => f.id)
  const fulfilledRequest = await prisma.returnRequest.findFirst({
    where: { requestRef: parsed.data.requestRef, toFormationId: { in: ancestorIds } },
    orderBy: { createdAt: "desc" },
  })
  const upwardRecipients = fulfilledRequest ? ancestorIds.filter((id) => id !== formationId) : []

  const notifications = [
    ...downwardRecipients.map((recipientId) => ({
      formationId: recipientId,
      type: "RETURN_SUBMITTED" as const,
      returnId: created.id,
      message: `${session.user.name} submitted request ${parsed.data.requestRef}`,
    })),
    ...(fulfilledRequest
      ? upwardRecipients.map((recipientId) => ({
          formationId: recipientId,
          type: "RETURN_REQUEST_FULFILLED" as const,
          returnId: created.id,
          requestId: fulfilledRequest.id,
          message: `${session.user.name} submitted a return in response to your request — Ref ${parsed.data.requestRef}`,
        }))
      : []),
  ]
  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications })
  }

  revalidatePath("/dashboard")
  return { success: true, id: created.id }
}

/** Edits a return — only while every item is still PENDING, own formation only. */
export async function updateReturnAction(returnId: string, values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  const parsed = returnFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const existing = await prisma.return.findUnique({ where: { id: returnId }, include: { items: true } })
  if (!existing) return { error: "Return not found." }
  if (existing.formationId !== session.user.id) {
    return { error: "You can only edit returns submitted by your own formation." }
  }
  if (existing.items.some((item) => item.status !== "PENDING")) {
    return { error: "Only requests where every item is still pending can be edited." }
  }

  const defaultOrigin = await getDefaultOriginForFormation(session.user.id)

  await prisma.$transaction([
    prisma.return.update({
      where: { id: returnId },
      data: {
        requestRef: parsed.data.requestRef,
        auth: parsed.data.auth || null,
      },
    }),
    prisma.returnItem.deleteMany({ where: { returnId } }),
    ...parsed.data.items.map((item, index) =>
      prisma.returnItem.create({
        data: {
          returnId,
          ...toItemData(item, index + 1),
          origin: item.origin || defaultOrigin || null,
        },
      })
    ),
  ])

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/returns/${returnId}`)
  return { success: true, id: returnId }
}

/** Moves a return item through the workflow and logs it to StatusHistory. */
export async function changeStatusAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session.user.privileges.includes("VERIFY_RETURNS")) {
    return { error: "Your formation cannot change return status." }
  }

  const parsed = statusChangeSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const existing = await prisma.returnItem.findUnique({
    where: { id: parsed.data.returnItemId },
    include: { return: true },
  })
  if (!existing) return { error: "Return item not found." }

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(existing.return.formationId)) {
    return { error: "That return is outside your formation's scope." }
  }

  await prisma.$transaction([
    prisma.returnItem.update({
      where: { id: existing.id },
      data: { status: parsed.data.toStatus },
    }),
    prisma.statusHistory.create({
      data: {
        returnItemId: existing.id,
        changedById: session.user.id,
        fromStatus: existing.status,
        toStatus: parsed.data.toStatus,
        note: parsed.data.note || null,
      },
    }),
  ])

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/returns/${existing.returnId}`)
  return { success: true, id: existing.returnId }
}

/**
 * Permanently erases a return and every equipment item / status history /
 * notification tied to it. Irreversible by design — gated behind the
 * DELETE_RETURNS privilege, which is deliberately separate from
 * VERIFY_RETURNS: moving a return through the workflow is routine, deleting
 * it is not. Until a formation with this privilege deletes it, a return
 * (verified or otherwise) is never removed by anything else in the system —
 * there is no auto-expiry.
 */
export async function deleteReturnAction(returnId: string): Promise<ActionResult> {
  const session = await requireSession()
  if (!session.user.privileges.includes("DELETE_RETURNS")) {
    return { error: "Your formation cannot permanently delete returns." }
  }

  const existing = await prisma.return.findUnique({ where: { id: returnId } })
  if (!existing) return { error: "Return not found." }

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(existing.formationId)) {
    return { error: "That return is outside your formation's scope." }
  }

  // ReturnItem, StatusHistory, and Notification all cascade from Return in
  // the schema, so this one delete removes the entire record cleanly.
  await prisma.return.delete({ where: { id: returnId } })

  revalidatePath("/dashboard")
  return { success: true, id: returnId }
}
