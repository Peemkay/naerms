import { z } from "zod"

export const loginSchema = z.object({
  serviceId: z.string().trim().min(1, "Service ID is required"),
  password: z.string().min(1, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>
