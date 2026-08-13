/**
 * Creates Army Headquarters (AHQ) as a top-level formation and, unless
 * told otherwise, places Nigerian Army Signals beneath it.
 *
 * AHQ sits above the corps: NAS answers to it, so it cannot be a child of
 * anything already in the tree. That is why formations may sit at the top
 * level in the first place — see moveFormationAction.
 *
 * Idempotent and dry-run by default:
 *   npx tsx prisma/seed-ahq.ts            (report only)
 *   npx tsx prisma/seed-ahq.ts --apply    (write)
 *   npx tsx prisma/seed-ahq.ts --apply --no-reparent   (create AHQ only)
 */
import "dotenv/config"
import bcrypt from "bcryptjs"
import type { Privilege } from "@prisma/client"

import { prisma } from "../src/lib/prisma"

const apply = process.argv.includes("--apply")
const reparent = !process.argv.includes("--no-reparent")

const EMAIL = "ahq@army.mil.ng"
const PASSWORD = "NAERMS@AHQ"
const NAME = "Army Headquarters (AHQ)"

// AHQ sits at the top of the chain, so it holds everything. Scope still
// applies: privileges only ever reach its own subtree, which is now the
// whole tree precisely because it is the top.
const ALL: Privilege[] = [
  "MANAGE_FORMATIONS",
  "MANAGE_ACCOUNTS",
  "MANAGE_PRIVILEGES",
  "VERIFY_RETURNS",
  "DELETE_RETURNS",
]

async function main() {
  console.log(apply ? "Mode: APPLY (writing)\n" : "Mode: dry run (nothing will be written)\n")

  const existing = await prisma.formation.findUnique({ where: { email: EMAIL } })
  if (existing) {
    console.log(`${existing.name} already exists (${EMAIL}). Nothing to create.`)
  } else if (!apply) {
    console.log(`Would create: ${NAME}  ${EMAIL}  ${PASSWORD}  (top level, all privileges)`)
  }

  const ahq =
    existing ??
    (apply
      ? await prisma.formation.create({
          data: {
            name: NAME,
            parentId: null,
            email: EMAIL,
            passwordHash: await bcrypt.hash(PASSWORD, 10),
            privileges: ALL,
            isActive: true,
          },
        })
      : null)

  if (ahq && !existing) {
    console.log(`Created: ${NAME}  ${EMAIL}  ${PASSWORD}`)
  }

  if (!reparent) {
    console.log("\n--no-reparent given: leaving the rest of the tree alone.")
    return
  }

  // Move NAS under AHQ. Identified by having no parent rather than by name,
  // so this works whatever the corps root is called, and skips AHQ itself.
  const topLevel = await prisma.formation.findMany({
    where: { parentId: null },
    select: { id: true, name: true },
  })
  const nas = topLevel.find((f) => f.id !== ahq?.id)

  if (!nas) {
    console.log("\nNo other top-level formation found, so nothing to re-parent.")
    return
  }

  if (!apply) {
    console.log(`Would move: ${nas.name} -> under ${NAME}`)
    console.log("\nRe-run with --apply to write these.")
    return
  }

  await prisma.formation.update({ where: { id: nas.id }, data: { parentId: ahq!.id } })
  console.log(`Moved: ${nas.name} -> under ${NAME}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
