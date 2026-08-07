import { z } from "zod"

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

export const formationFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    type: z.enum(CREATABLE_FORMATION_TYPES),
    parentId: z.string().trim().min(1, "Parent formation is required"),
    // "" (not absent) is what an unset <Select> submits — see returnFormSchema.
    role: z.enum(FORMATION_ROLES).optional().or(z.literal("")),
    attachedTo: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => data.type !== "BRIGADE_SIGNALS" || !!data.attachedTo, {
    message: "Brigade Signals units must record which formation they support.",
    path: ["attachedTo"],
  })

export type FormationFormInput = z.infer<typeof formationFormSchema>
