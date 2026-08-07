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
        serviceId: { label: "Service ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw)
        if (!parsed.success) return null
        const { serviceId, password } = parsed.data

        const user = await prisma.user.findUnique({
          where: { serviceId },
          include: { formation: { select: { name: true } } },
        })
        if (!user || !user.isActive) return null

        // Locked accounts fail closed regardless of password correctness —
        // don't let a correct password reset the clock early.
        if (user.lockedUntil && user.lockedUntil > new Date()) return null

        const passwordValid = await bcrypt.compare(password, user.passwordHash)
        if (!passwordValid) {
          const attempts = user.failedLoginAttempts + 1
          await prisma.user.update({
            where: { id: user.id },
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

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          })
        }

        return {
          id: user.id,
          serviceId: user.serviceId,
          name: user.fullName,
          rank: user.rank,
          role: user.role,
          formationId: user.formationId,
          formationName: user.formation.name,
        }
      },
    }),
  ],
})
