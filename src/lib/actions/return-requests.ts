"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"

const requestReturnSchema = z.object({
  // One ask can now name several formations at once (the common case being
  // "every unit under me"), so this is a list rather than a single id. One
  // ReturnRequest row is still created per recipient, keeping the fulfilment
  // lookup in createReturnAction unchanged.
  toFormationIds: z.array(z.string().min(1)).min(1, "Pick at least one formation"),
  requestRef: z.string().trim().min(1, "Reference is required"),
  message: z.string().trim().max(500).optional().or(z.literal("")),
})

type ActionResult =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }

/**
 * Any formation can ask any formation under it — anywhere in its own
 * subtree, not just direct children — to submit a return. The notification
 * fans out the same way a Return submission does: to the asked formation
 * *and* its entire subtree, not just the one formation named — any of them
 * could plausibly be the one to actually submit the response.
 */
export async function requestReturnAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  const parsed = requestReturnSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  // De-duplicated: the picker offers "select all", and a formation named
  // twice must not receive two identical asks.
  const targetIds = [...new Set(parsed.data.toFormationIds)]

  if (targetIds.includes(session.user.id)) {
    return { error: "You can't request a return from yourself." }
  }

  const visibleIds = await getVisibleFormationIds(session.user.id)
  const outOfScope = targetIds.filter((id) => !visibleIds.includes(id))
  if (outOfScope.length > 0) {
    return { error: "One or more of those formations are not under you." }
  }

  // One request row per named formation, so each is independently
  // answerable and the existing per-formation fulfilment lookup still works.
  const requests = await prisma.$transaction(
    targetIds.map((toFormationId) =>
      prisma.returnRequest.create({
        data: {
          requestRef: parsed.data.requestRef,
          message: parsed.data.message || null,
          fromFormationId: session.user.id,
          toFormationId,
        },
      })
    )
  )

  // Each named formation's whole subtree is notified, same fan-out as
  // before. Subtrees can overlap when both a parent and its child are
  // named, so notifications are de-duplicated per formation: one ask should
  // never produce two bell entries for the same recipient.
  const perRequestRecipients = await Promise.all(
    requests.map(async (request) => ({
      requestId: request.id,
      recipients: await getVisibleFormationIds(request.toFormationId),
    }))
  )

  const seen = new Set<string>()
  const notifications: {
    formationId: string
    type: "RETURN_REQUESTED"
    requestId: string
    message: string
  }[] = []
  for (const { requestId, recipients } of perRequestRecipients) {
    for (const formationId of recipients) {
      if (seen.has(formationId)) continue
      seen.add(formationId)
      notifications.push({
        formationId,
        type: "RETURN_REQUESTED" as const,
        requestId,
        message: `${session.user.name} requested a return (Ref ${parsed.data.requestRef})`,
      })
    }
  }

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications })
  }

  revalidatePath("/dashboard", "layout")
  return { success: true, id: requests[0].id }
}
