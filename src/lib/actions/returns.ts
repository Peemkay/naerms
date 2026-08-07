"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { getDefaultOriginForFormation } from "@/lib/formation"
import { returnFormSchema, statusChangeSchema, type ReturnItemInput } from "@/lib/validation/return"

type ActionResult =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }

function toItemData(item: ReturnItemInput, lineNo: number) {
  return {
    lineNo,
    equipmentName: item.equipmentName,
    equipmentModel: item.equipmentModel || null,
    band: item.band || null,
    equipmentType: item.equipmentType || null,
    equipmentSerial: item.equipmentSerial,
    origin: item.origin || null,
    condition: item.condition || null,
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
      dateIssued: parsed.data.dateIssued ? new Date(parsed.data.dateIssued) : null,
      formationId,
      howDeployed: parsed.data.howDeployed || null,
      purposeOfIssue: parsed.data.purposeOfIssue || null,
      items: {
        create: parsed.data.items.map((item, index) => ({
          ...toItemData(item, index + 1),
          origin: item.origin || defaultOrigin || null,
        })),
      },
    },
  })

  // Notify subordinates only — descendants minus the submitter itself.
  const subtree = await getVisibleFormationIds(formationId)
  const recipients = subtree.filter((id) => id !== formationId)
  if (recipients.length > 0) {
    await prisma.notification.createMany({
      data: recipients.map((recipientId) => ({
        formationId: recipientId,
        returnId: created.id,
        message: `${session.user.name} submitted request ${parsed.data.requestRef}`,
      })),
    })
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
        dateIssued: parsed.data.dateIssued ? new Date(parsed.data.dateIssued) : null,
        howDeployed: parsed.data.howDeployed || null,
        purposeOfIssue: parsed.data.purposeOfIssue || null,
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
