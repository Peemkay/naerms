"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { formationFormSchema } from "@/lib/validation/formation"

type ActionResult =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string[] | undefined> }

/**
 * Any authenticated user may register a new formation/unit — the tree is
 * meant to grow from the field as new units stand up, not be centrally
 * gatekept. The only structural rule enforced here is that the chosen
 * parent must exist; everything else (name, type, role, attachment) is the
 * submitter's call.
 */
export async function createFormationAction(values: unknown): Promise<ActionResult> {
  await requireSession()

  const parsed = formationFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const parent = await prisma.formation.findUnique({ where: { id: parsed.data.parentId } })
  if (!parent) {
    return { error: "The selected parent formation no longer exists." }
  }

  const created = await prisma.formation.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      parentId: parsed.data.parentId,
      role: parsed.data.role || null,
      attachedTo: parsed.data.type === "BRIGADE_SIGNALS" ? parsed.data.attachedTo || null : null,
    },
  })

  // Both trees read from the same table, and either could have the new
  // formation as a visible descendant somewhere in their sidebar/dropdowns.
  revalidatePath("/admin", "layout")
  revalidatePath("/portal", "layout")
  revalidatePath("/formations/new")

  return { success: true, id: created.id }
}
