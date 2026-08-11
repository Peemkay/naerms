import { z } from "zod"

// Fails fast with a readable message instead of a cryptic runtime error deep
// inside Prisma or Auth.js the first time a request needs the missing var.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required (generate one with: npx auth secret)"),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n")
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

export const env = parsed.data
