import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import ws from "ws"
import crypto from "node:crypto"
import bcrypt from "bcryptjs"

neonConfig.webSocketConstructor = ws
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Generates a fresh, unique password for every formation that has a login
// (email set) — run this whenever a shared/default password has been
// exposed and you want the live database's actual credentials to change.
function generatePassword(): string {
  return crypto.randomBytes(9).toString("base64url") // 12 chars, url-safe
}

async function main() {
  const formations = await prisma.formation.findMany({
    where: { email: { not: null } },
    select: { id: true, name: true, email: true },
    orderBy: { email: "asc" },
  })

  if (formations.length === 0) {
    console.log("No formations with an account found (nothing to rotate).")
    return
  }

  const rows: { name: string; email: string | null; password: string }[] = []

  for (const formation of formations) {
    const password = generatePassword()
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.formation.update({
      where: { id: formation.id },
      // Also clear any lockout state so a rotated password isn't
      // immediately blocked by a stale lock from before the rotation.
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    })
    rows.push({ name: formation.name, email: formation.email, password })
  }

  console.log(`Rotated passwords for ${rows.length} account(s). Store these somewhere safe:\n`)
  console.table(rows)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
