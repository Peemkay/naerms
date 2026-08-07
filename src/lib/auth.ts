import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { authConfig } from "@/lib/auth.config"
import { loginSchema } from "@/lib/validation/auth"

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw)
        if (!parsed.success) return null
        const { email, password } = parsed.data

        const formation = await prisma.formation.findUnique({ where: { email } })
        // No account set up yet, deactivated, or never given a password.
        if (!formation || !formation.isActive || !formation.passwordHash) return null

        if (formation.lockedUntil && formation.lockedUntil > new Date()) return null

        const passwordValid = await bcrypt.compare(password, formation.passwordHash)
        if (!passwordValid) {
          const attempts = formation.failedLoginAttempts + 1
          await prisma.formation.update({
            where: { id: formation.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil:
                attempts >= MAX_FAILED_ATTEMPTS
                  ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
                  : null,
            },
          })
          return null
        }

        if (formation.failedLoginAttempts > 0 || formation.lockedUntil) {
          await prisma.formation.update({
            where: { id: formation.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          })
        }

        return {
          id: formation.id,
          email: formation.email!,
          name: formation.name,
          privileges: formation.privileges,
        }
      },
    }),
  ],
})
