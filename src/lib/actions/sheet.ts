"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { getSheetAccess } from "@/lib/sheet/data"
import { CONDITION_FROM_SHEET_LABEL, SHEET_COLUMN_BY_KEY, isExtraColumn } from "@/lib/sheet/columns"
import type { Prisma, ReturnStatus } from "@prisma/client"

type ActionResult = { success: true } | { error: string }

/**
 * Columns that write back to the register itself. Everything else in the
 * sheet is either derived (Serial, Fmn/Unit), or presentation living in
 * SheetCell — those never touch a holding.
 */
const EDITABLE_ITEM_COLUMNS = new Set([
  "letterOfRequest",
  "authority",
  "dateIssued",
  "fmnUnitIssued",
  "howDeployed",
  "purposeOfIssue",
  "equipmentName",
  "equipmentModel",
  "band",
  "equipmentType",
  "equipmentSerial",
  "origin",
  "remarks",
  "condition",
  "workflow",
  "quantity",
  "serviceableQty",
  "unserviceableQty",
  "underRepairQty",
  "awaitingEvacuationQty",
])

/**
 * Resolves who may write to the row a cell belongs to.
 *
 * Every mutation goes through this: the sheet UI hides controls from
 * read-only viewers, but a hand-crafted request must be refused here too.
 */
type RowGuard =
  | { ok: false; error: string }
  | { ok: true; session: Awaited<ReturnType<typeof requireSession>> }

async function requireRowOwner(returnItemId: string): Promise<RowGuard> {
  const session = await requireSession()
  const item = await prisma.returnItem.findUnique({
    where: { id: returnItemId },
    select: { id: true, return: { select: { formationId: true } } },
  })
  if (!item) return { ok: false, error: "That row no longer exists." }

  const access = await getSheetAccess(session.user.id, item.return.formationId)
  if (access !== "owner") {
    return {
      ok: false,
      error:
        access === "reader"
          ? "This sheet belongs to another formation. You can comment on it, but not edit it."
          : "That sheet is outside your scope.",
    }
  }
  return { ok: true, session }
}

const cellEditSchema = z.object({
  returnItemId: z.string().min(1),
  columnKey: z.string().min(1),
  /** Raw cell input. Interpreted per the column's kind. */
  value: z.string(),
})

/**
 * Writes one cell.
 *
 * Register columns update the ReturnItem; free columns and anything
 * formula-bearing land in SheetCell. A leading "=" always means a formula,
 * matching the spreadsheet convention the clerks already know.
 */
export async function updateSheetCellAction(input: unknown): Promise<ActionResult> {
  const parsed = cellEditSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid cell edit." }
  const { returnItemId, columnKey, value } = parsed.data

  const guard = await requireRowOwner(returnItemId)
  if (!guard.ok) return { error: guard.error }

  const column = SHEET_COLUMN_BY_KEY.get(columnKey)
  const isExtra = isExtraColumn(columnKey)
  if (!column && !isExtra) return { error: "Unknown column." }
  if (column?.readOnly) return { error: "That column is calculated and can't be edited." }

  // Formulas are presentation, never register data: a holding must be a
  // stated figure, not something that silently changes when another cell
  // does. So a formula in a register column is stored alongside the cell
  // rather than replacing the value it computes from.
  const isFormula = value.startsWith("=")

  if (isExtra || isFormula) {
    await prisma.sheetCell.upsert({
      where: { returnItemId_columnKey: { returnItemId, columnKey } },
      create: {
        returnItemId,
        columnKey,
        value: isFormula ? null : value,
        formula: isFormula ? value : null,
      },
      update: {
        value: isFormula ? null : value,
        formula: isFormula ? value : null,
      },
    })
    revalidatePath("/dashboard/sheet")
    return { success: true }
  }

  if (!EDITABLE_ITEM_COLUMNS.has(columnKey)) return { error: "That column can't be edited." }

  const data: Prisma.ReturnItemUpdateInput = {}
  const trimmed = value.trim()

  switch (columnKey) {
    case "dateIssued": {
      if (trimmed === "") {
        data.dateIssued = null
      } else {
        const date = new Date(trimmed)
        if (Number.isNaN(date.getTime())) return { error: "That isn't a date we can read." }
        data.dateIssued = date
      }
      break
    }
    case "condition": {
      // The sheet's Status column is the physical condition. Setting it
      // moves the whole quantity into that bucket, which is what picking a
      // single value on a paper register means. A mixed breakdown is edited
      // through the per-condition quantity columns instead.
      const condition = CONDITION_FROM_SHEET_LABEL[trimmed.toUpperCase()]
      if (!condition && trimmed !== "") return { error: "Unknown status value." }
      const current = await prisma.returnItem.findUniqueOrThrow({
        where: { id: returnItemId },
        select: { quantity: true },
      })
      const qty = current.quantity
      data.serviceableQty = condition === "SERVICEABLE" ? qty : 0
      data.unserviceableQty = condition === "UNSERVICEABLE" ? qty : 0
      data.underRepairQty = condition === "UNDER_REPAIR" ? qty : 0
      data.awaitingEvacuationQty = condition === "AWAITING_EVACUATION" ? qty : 0
      break
    }
    case "workflow": {
      const allowed: ReturnStatus[] = ["PENDING", "VERIFIED", "DISCREPANCY", "RETURNED", "CLOSED"]
      if (!allowed.includes(trimmed as ReturnStatus)) return { error: "Unknown workflow value." }
      // Workflow transitions are a privileged, audited action elsewhere;
      // the sheet must not become a way around that gate.
      if (!guard.session.user.privileges.includes("VERIFY_RETURNS")) {
        return { error: "Your formation cannot change workflow status." }
      }
      data.status = trimmed as ReturnStatus
      break
    }
    case "quantity":
    case "serviceableQty":
    case "unserviceableQty":
    case "underRepairQty":
    case "awaitingEvacuationQty": {
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 0) return { error: "That needs to be a number." }
      const floor = columnKey === "quantity" ? 1 : 0
      ;(data as Record<string, number>)[columnKey] = Math.max(floor, Math.trunc(n))
      break
    }
    default: {
      // Remaining columns are free text; "" clears them to null so they read
      // as empty rather than as an empty string in exports.
      ;(data as Record<string, string | null>)[columnKey] = trimmed === "" ? null : trimmed
    }
  }

  await prisma.returnItem.update({ where: { id: returnItemId }, data })
  revalidatePath("/dashboard/sheet")
  revalidatePath("/dashboard")
  return { success: true }
}

const formatSchema = z.object({
  returnItemId: z.string().min(1),
  columnKey: z.string().min(1),
  bold: z.boolean().nullable().optional(),
  italic: z.boolean().nullable().optional(),
  fillColor: z.string().nullable().optional(),
  textColor: z.string().nullable().optional(),
  numberFormat: z.string().nullable().optional(),
})

/** Cell styling. Never touches register data, so it has its own action. */
export async function formatSheetCellAction(input: unknown): Promise<ActionResult> {
  const parsed = formatSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid formatting." }
  const { returnItemId, columnKey, ...format } = parsed.data

  const guard = await requireRowOwner(returnItemId)
  if (!guard.ok) return { error: guard.error }

  await prisma.sheetCell.upsert({
    where: { returnItemId_columnKey: { returnItemId, columnKey } },
    create: { returnItemId, columnKey, ...format },
    update: format,
  })
  revalidatePath("/dashboard/sheet")
  return { success: true }
}

const commentSchema = z.object({
  returnItemId: z.string().min(1),
  columnKey: z.string().nullable().optional(),
  body: z.string().trim().min(1, "Write something first.").max(2000),
})

/**
 * Adds a note to a row. Available to the owning formation *and* to superiors
 * reading the sheet: this is the review channel that replaces editing from
 * above.
 */
export async function addSheetCommentAction(input: unknown): Promise<ActionResult> {
  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) return { error: "Write something first." }

  const session = await requireSession()
  const item = await prisma.returnItem.findUnique({
    where: { id: parsed.data.returnItemId },
    select: { return: { select: { formationId: true } } },
  })
  if (!item) return { error: "That row no longer exists." }

  // Reader access is enough here, unlike every other action in this file.
  const access = await getSheetAccess(session.user.id, item.return.formationId)
  if (access === "none") return { error: "That sheet is outside your scope." }

  await prisma.sheetComment.create({
    data: {
      returnItemId: parsed.data.returnItemId,
      columnKey: parsed.data.columnKey ?? null,
      authorId: session.user.id,
      body: parsed.data.body,
    },
  })

  // The owning formation is told when someone above them comments, so a
  // query on their register doesn't sit unseen.
  if (access === "reader") {
    await prisma.notification.create({
      data: {
        formationId: item.return.formationId,
        type: "RETURN_SUBMITTED",
        message: `${session.user.name} commented on your returns sheet`,
      },
    })
  }

  revalidatePath("/dashboard/sheet")
  return { success: true }
}

/** Marks a comment actioned. Either the row's owner or the author may do it. */
export async function resolveSheetCommentAction(commentId: string): Promise<ActionResult> {
  const session = await requireSession()
  const comment = await prisma.sheetComment.findUnique({
    where: { id: commentId },
    select: {
      authorId: true,
      resolvedAt: true,
      returnItem: { select: { return: { select: { formationId: true } } } },
    },
  })
  if (!comment) return { error: "That comment no longer exists." }

  const isOwner = comment.returnItem.return.formationId === session.user.id
  const isAuthor = comment.authorId === session.user.id
  if (!isOwner && !isAuthor) return { error: "You can't resolve that comment." }

  await prisma.sheetComment.update({
    where: { id: commentId },
    data: { resolvedAt: comment.resolvedAt ? null : new Date() },
  })
  revalidatePath("/dashboard/sheet")
  return { success: true }
}

const settingsSchema = z.object({
  columnWidths: z.record(z.string(), z.number()).optional(),
  hiddenColumns: z.array(z.string()).optional(),
})

/** Column widths and hidden columns, per formation. Own sheet only. */
export async function saveSheetSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid sheet settings." }

  const session = await requireSession()
  const formationId = session.user.id

  await prisma.sheetSettings.upsert({
    where: { formationId },
    create: { formationId, ...parsed.data },
    update: parsed.data,
  })
  return { success: true }
}

/**
 * Adds a blank line to the formation's own sheet.
 *
 * A register grows by someone writing the next line on it, so the sheet has
 * to be able to do that directly rather than sending the clerk to the New
 * Return form. The line joins the most recent return when there is one, so
 * it shares that entry's Request Ref; otherwise a new entry is opened,
 * referenced by today's date.
 */
export async function addSheetRowAction(): Promise<ActionResult & { id?: string }> {
  const session = await requireSession()
  const formationId = session.user.id

  const latest = await prisma.return.findFirst({
    where: { formationId, isDraft: false },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  })

  if (latest) {
    const created = await prisma.returnItem.create({
      data: {
        returnId: latest.id,
        lineNo: latest._count.items + 1,
        equipmentName: "",
        quantity: 1,
        serviceableQty: 1,
      },
    })
    revalidatePath("/dashboard/sheet")
    revalidatePath("/dashboard")
    return { success: true, id: created.id }
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const created = await prisma.return.create({
    data: {
      requestRef: `SHEET/${stamp}`,
      formationId,
      isDraft: false,
      items: { create: [{ lineNo: 1, equipmentName: "", quantity: 1, serviceableQty: 1 }] },
    },
    include: { items: true },
  })

  revalidatePath("/dashboard/sheet")
  revalidatePath("/dashboard")
  return { success: true, id: created.items[0].id }
}

/** Deletes a row (and its formatting/comments, by cascade). Owner only. */
export async function deleteSheetRowAction(returnItemId: string): Promise<ActionResult> {
  const guard = await requireRowOwner(returnItemId)
  if (!guard.ok) return { error: guard.error }

  const item = await prisma.returnItem.findUniqueOrThrow({
    where: { id: returnItemId },
    select: { returnId: true },
  })

  // A Return with no items left is an empty register entry, so it goes too
  // rather than lingering as a headerless row in the registry.
  const siblings = await prisma.returnItem.count({ where: { returnId: item.returnId } })
  if (siblings <= 1) {
    await prisma.return.delete({ where: { id: item.returnId } })
  } else {
    await prisma.returnItem.delete({ where: { id: returnItemId } })
  }

  revalidatePath("/dashboard/sheet")
  revalidatePath("/dashboard")
  return { success: true }
}
