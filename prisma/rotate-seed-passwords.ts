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

// Generates a fresh, unique, memorable-ish password per seeded account —
// run this whenever the shared `naerms123` seed default has been exposed
// (e.g. after documenting it in a README) and you want the live database's
// actual credentials to no longer match the public documentation.
function generatePassword(): string {
  return crypto.randomBytes(9).toString("base64url") // 12 chars, url-safe
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, serviceId: true, fullName: true, role: true },
    orderBy: { serviceId: "asc" },
  })

  if (users.length === 0) {
    console.log("No users found — nothing to rotate.")
    return
  }

  const rows: { serviceId: string; role: string; password: string }[] = []

  for (const user of users) {
    const password = generatePassword()
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      // Also clear any lockout state so a rotated password isn't
      // immediately blocked by a stale lock from before the rotation.
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    })
    rows.push({ serviceId: user.serviceId, role: user.role, password })
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
