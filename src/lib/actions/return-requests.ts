"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"

const requestReturnSchema = z.object({
  toFormationId: z.string().min(1),
  requestRef: z.string().trim().min(1, "Reference is required"),
  message: z.string().trim().max(500).optional().or(z.literal("")),
})

type ActionResult =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }

/**
 * Any formation can ask any formation under it — anywhere in its own
 * subtree, not just direct children — to submit a return. This is the
 * inverse of submitting a Return (which fans notifications out downward
 * from wherever it was submitted): a request notifies only the specific
 * formation being asked, not its whole subtree too.
 */
export async function requestReturnAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  const parsed = requestReturnSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  if (parsed.data.toFormationId === session.user.id) {
    return { error: "You can't request a return from yourself." }
  }

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(parsed.data.toFormationId)) {
    return { error: "That formation is not under you." }
  }

  const request = await prisma.returnRequest.create({
    data: {
      requestRef: parsed.data.requestRef,
      message: parsed.data.message || null,
      fromFormationId: session.user.id,
      toFormationId: parsed.data.toFormationId,
    },
  })

  await prisma.notification.create({
    data: {
      formationId: parsed.data.toFormationId,
      type: "RETURN_REQUESTED",
      requestId: request.id,
      message: `${session.user.name} requested a return (Ref ${parsed.data.requestRef})`,
    },
  })

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/formations/${parsed.data.toFormationId}`)
  return { success: true, id: request.id }
}
