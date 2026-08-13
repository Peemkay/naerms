import { z } from "zod"

import { ALL_PRIVILEGES } from "@/lib/privileges"

// Formation type is gone: it was a required classification on every form
// that no behaviour depended on. Where a formation sits in the tree is what
// determines scope, notifications and visibility, so the tree is the
// classification.

export const FORMATION_ROLES = ["OPERATIONAL", "SUPPORT", "ATTACHED"] as const

// Derived from ALL_PRIVILEGES (the single source of truth in src/lib/privileges.ts)
// rather than duplicated here — a hardcoded copy previously drifted out of sync
// when DELETE_RETURNS was added, silently rejecting it in this schema.
export const PRIVILEGE_VALUES = ALL_PRIVILEGES

export const formationFormSchema = z
  .object({
    name: z.string().trim().min(1, "Formation/Unit name is required"),
    // "" means top level (no parent), which is how NAS itself sits.
    parentId: z.string().trim().optional().or(z.literal("")),
    // "" (not absent) is what an unset <Select> submits — see returnFormSchema.
    role: z.enum(FORMATION_ROLES).optional().or(z.literal("")),
    attachedTo: z.string().trim().optional().or(z.literal("")),
    // Optional account setup, done in the same step as creating the formation.
    email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
    password: z.string().min(8, "At least 8 characters").optional().or(z.literal("")),
    privileges: z.array(z.enum(PRIVILEGE_VALUES)).default([]),
  })
  .refine((data) => !data.email === !data.password, {
    message: "Provide both an email and a password, or leave both blank.",
    path: ["password"],
  })

export type FormationFormInput = z.infer<typeof formationFormSchema>

// For managing an *existing* formation's account separately from creation.
export const accountFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
})

export type AccountFormInput = z.infer<typeof accountFormSchema>

export const privilegesFormSchema = z.object({
  privileges: z.array(z.enum(PRIVILEGE_VALUES)).default([]),
})

/** Renaming an existing formation, without touching its place in the tree. */
export const renameFormationSchema = z.object({
  name: z.string().trim().min(1, "Formation/Unit name is required"),
  role: z.enum(FORMATION_ROLES).optional().or(z.literal("")),
  attachedTo: z.string().trim().optional().or(z.literal("")),
})

export type RenameFormationInput = z.infer<typeof renameFormationSchema>

/**
 * Re-parenting: moving a formation (and everything under it) elsewhere.
 *
 * `parentId` may be null, meaning "move to the top level". That is what
 * makes every formation movable, NAS included — with a single fixed root
 * there would be nowhere for the root itself to go.
 */
export const moveFormationSchema = z.object({
  parentId: z.string().trim().nullable().optional(),
})

/** Reordering siblings by dragging: the ids in their new order. */
export const reorderFormationsSchema = z.object({
  parentId: z.string().trim().nullable().optional(),
  orderedIds: z.array(z.string().min(1)).min(1),
})
