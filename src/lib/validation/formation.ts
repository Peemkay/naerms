import { z } from "zod"

import { ALL_PRIVILEGES } from "@/lib/privileges"

// ROOT is excluded — there is exactly one (NAS), seeded once, never user-created.
export const CREATABLE_FORMATION_TYPES = [
  "COMMAND",
  "SCHOOL",
  "SIGNAL_BRIGADE",
  "SIGNAL_REGIMENT",
  "BRIGADE_SIGNALS",
  "UNIT",
] as const

export const FORMATION_ROLES = ["OPERATIONAL", "SUPPORT", "ATTACHED"] as const

// Derived from ALL_PRIVILEGES (the single source of truth in src/lib/privileges.ts)
// rather than duplicated here — a hardcoded copy previously drifted out of sync
// when DELETE_RETURNS was added, silently rejecting it in this schema.
export const PRIVILEGE_VALUES = ALL_PRIVILEGES

export const formationFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    type: z.enum(CREATABLE_FORMATION_TYPES),
    parentId: z.string().trim().min(1, "Parent formation is required"),
    // "" (not absent) is what an unset <Select> submits — see returnFormSchema.
    role: z.enum(FORMATION_ROLES).optional().or(z.literal("")),
    attachedTo: z.string().trim().optional().or(z.literal("")),
    // Optional account setup, done in the same step as creating the formation.
    email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
    password: z.string().min(8, "At least 8 characters").optional().or(z.literal("")),
    privileges: z.array(z.enum(PRIVILEGE_VALUES)).default([]),
  })
  .refine((data) => data.type !== "BRIGADE_SIGNALS" || !!data.attachedTo, {
    message: "Brigade Signals units must record which formation they support.",
    path: ["attachedTo"],
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

/** Renaming and re-typing an existing formation, without touching its place in the tree. */
export const renameFormationSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(CREATABLE_FORMATION_TYPES),
  role: z.enum(FORMATION_ROLES).optional().or(z.literal("")),
  attachedTo: z.string().trim().optional().or(z.literal("")),
})

export type RenameFormationInput = z.infer<typeof renameFormationSchema>

/** Re-parenting: moving a formation (and everything under it) elsewhere in the tree. */
export const moveFormationSchema = z.object({
  parentId: z.string().trim().min(1, "Pick the formation it should report to"),
})
