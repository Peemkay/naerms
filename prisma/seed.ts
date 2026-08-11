import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import ws from "ws"
import crypto from "node:crypto"
import bcrypt from "bcryptjs"

import { ALL_PRIVILEGES } from "@/lib/privileges"

neonConfig.webSocketConstructor = ws
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function generatePassword(): string {
  return crypto.randomBytes(9).toString("base64url") // 12 chars, url-safe
}

async function main() {
  // Safe to re-run: refuse to double-seed once a ROOT formation exists,
  // rather than fail on a unique constraint partway through.
  const existingRoot = await prisma.formation.findFirst({ where: { type: "ROOT" } })
  if (existingRoot) {
    console.log("A ROOT formation already exists (skipping seed, already seeded).")
    return
  }

  console.log("Seeding NAERMS with two fully-privileged bootstrap formations...")

  const nasPassword = generatePassword()
  const adminPassword = generatePassword()

  const nas = await prisma.formation.create({
    data: {
      name: "Nigerian Army Signals (NAS)",
      type: "ROOT",
      email: "nas@army.mil.ng",
      passwordHash: await bcrypt.hash(nasPassword, 10),
      privileges: [...ALL_PRIVILEGES],
    },
  })

  const admin = await prisma.formation.create({
    data: {
      name: "NAS Systems Administration",
      type: "COMMAND",
      parentId: nas.id,
      email: "admin@army.mil.ng",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      privileges: [...ALL_PRIVILEGES],
    },
  })

  console.log("Seed complete. Every other formation, account, and return is created through the app itself.\n")
  console.table([
    { name: nas.name, email: nas.email, password: nasPassword },
    { name: admin.name, email: admin.email, password: adminPassword },
  ])
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
