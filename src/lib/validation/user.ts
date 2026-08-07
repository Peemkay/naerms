import { z } from "zod"

export const ROLES = [
  "UNIT_CLERK",
  "REGIMENT_OFFICER",
  "BRIGADE_ADMIN",
  "COMMAND_ADMIN",
  "NAS_ADMIN",
] as const

export const userFormSchema = z.object({
  serviceId: z.string().trim().min(1, "Service ID is required"),
  fullName: z.string().trim().min(1, "Full name is required"),
  rank: z.string().trim().optional().or(z.literal("")),
  role: z.enum(ROLES),
  formationId: z.string().trim().min(1, "Formation is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export type UserFormInput = z.infer<typeof userFormSchema>
