"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { getDefaultOriginForFormation } from "@/lib/formation"
import { canChangeStatus } from "@/lib/roles"
import { returnFormSchema, statusChangeSchema, type ReturnFormInput } from "@/lib/validation/return"

type ActionResult =
  | { success: true; id?: string }
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }

function toReturnData(input: ReturnFormInput) {
  return {
    requestRef: input.requestRef,
    auth: input.auth || null,
    dateIssued: input.dateIssued ? new Date(input.dateIssued) : null,
    howDeployed: input.howDeployed || null,
    purposeOfIssue: input.purposeOfIssue || null,
    equipmentName: input.equipmentName,
    equipmentModel: input.equipmentModel || null,
    band: input.band || null,
    equipmentType: input.equipmentType || null,
    equipmentSerial: input.equipmentSerial,
    origin: input.origin || null,
    condition: input.condition || null,
    remarks: input.remarks || null,
  }
}

/** Creates a return under the caller's own formation. */
export async function createReturnAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  const parsed = returnFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const formationId = session.user.formationId

  // Register-style serial numbers are sequential per formation. Simple
  // read-then-write; a rare race under concurrent submission from the same
  // unit would need a DB-level sequence, out of scope for this stage.
  const last = await prisma.equipmentReturn.findFirst({
    where: { formationId },
    orderBy: { serialNo: "desc" },
    select: { serialNo: true },
  })

  const origin = parsed.data.origin || (await getDefaultOriginForFormation(formationId)) || null

  const created = await prisma.equipmentReturn.create({
    data: {
      ...toReturnData(parsed.data),
      origin,
      serialNo: (last?.serialNo ?? 0) + 1,
      formationId,
      submittedById: session.user.id,
    },
  })

  revalidatePath("/portal")
  return { success: true, id: created.id }
}

/** Edits a return — only while PENDING, only for the caller's own formation. */
export async function updateReturnAction(returnId: string, values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  const parsed = returnFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const existing = await prisma.equipmentReturn.findUnique({ where: { id: returnId } })
  if (!existing) return { error: "Return not found." }
  if (existing.formationId !== session.user.formationId) {
    return { error: "You can only edit returns submitted by your own formation." }
  }
  if (existing.status !== "PENDING") {
    return { error: "Only pending returns can still be edited." }
  }

  await prisma.equipmentReturn.update({
    where: { id: returnId },
    data: toReturnData(parsed.data),
  })

  revalidatePath("/portal")
  revalidatePath(`/returns/${returnId}`)
  return { success: true }
}

/** Moves a return through the workflow and logs it to StatusHistory. */
export async function changeStatusAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!canChangeStatus(session.user.role)) {
    return { error: "Your role cannot change return status." }
  }

  const parsed = statusChangeSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const existing = await prisma.equipmentReturn.findUnique({ where: { id: parsed.data.returnId } })
  if (!existing) return { error: "Return not found." }

  const visibleIds = await getVisibleFormationIds(session.user.formationId)
  if (!visibleIds.includes(existing.formationId)) {
    return { error: "That return is outside your formation's scope." }
  }

  await prisma.$transaction([
    prisma.equipmentReturn.update({
      where: { id: existing.id },
      data: { status: parsed.data.toStatus },
    }),
    prisma.statusHistory.create({
      data: {
        returnId: existing.id,
        changedById: session.user.id,
        fromStatus: existing.status,
        toStatus: parsed.data.toStatus,
        note: parsed.data.note || null,
      },
    }),
  ])

  revalidatePath("/admin")
  revalidatePath("/portal")
  revalidatePath(`/returns/${existing.id}`)
  return { success: true }
}
