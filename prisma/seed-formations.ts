import "dotenv/config"
import bcrypt from "bcryptjs"
import type { FormationRole, Privilege } from "@prisma/client"

import { prisma } from "../src/lib/prisma"

/**
 * Seeds the NAS order of battle.
 *
 * Idempotent: formations are matched on their login address, so running
 * this twice creates nothing twice. Existing formations are left in place
 * and only reported, never re-parented or re-typed — this script sets up
 * accounts, it does not silently rearrange a live chain of command.
 *
 * Run with:  npx tsx prisma/seed-formations.ts          (report only)
 *            npx tsx prisma/seed-formations.ts --apply  (write)
 */

type Node = {
  /** Short code driving the login address and password. */
  code: string
  name: string
  role?: FormationRole
  children?: Node[]
}

/**
 * Credentials follow the pattern the corps already uses:
 *   51 SB -> 51.sb@army.mil.ng / NAERMS@51
 *   NASS  -> nass@army.mil.ng  / NAERMS@NASS
 * A numbered formation keys its password on the number; a named one on its
 * code.
 */
function credentials(code: string) {
  const email = `${code.toLowerCase().replace(/\s+/g, ".")}@army.mil.ng`
  const number = /^(\d+)/.exec(code)?.[1]
  return { email, password: `NAERMS@${number ?? code.toUpperCase().replace(/\s+/g, "")}` }
}

/**
 * Privileges by level.
 *
 * Commands, brigades and schools get the full set; regiments and brigade
 * signals get only the two that concern their own returns, so a unit can
 * work its register but cannot create formations or reset another
 * formation's login. Scope narrows all of these further: a formation can
 * only ever act on itself and its own subtree.
 */
const FULL: Privilege[] = [
  "MANAGE_FORMATIONS",
  "MANAGE_ACCOUNTS",
  "MANAGE_PRIVILEGES",
  "VERIFY_RETURNS",
  "DELETE_RETURNS",
]
const UNIT_LEVEL: Privilege[] = ["VERIFY_RETURNS", "DELETE_RETURNS"]

function privilegesFor(node: Node): Privilege[] {
  // Formation type is gone, so "is this a headquarters?" is answered by the
  // tree itself: a formation with subordinates commands them and gets the
  // full set; a leaf works its own register only.
  return (node.children?.length ?? 0) > 0 ? FULL : UNIT_LEVEL
}

/**
 * The order of battle, as supplied.
 *
 * Everything hangs off Commander Corps of Signals, which sits under NAS.
 * Deliberately absent: the Defence Space Administration (a tri-service
 * agency reporting to the Ministry of Defence) and Pronto Microsystems
 * Technologies (a private vendor), neither of which is a node in the NAS
 * chain of command.
 */
const TREE: Node = {
  code: "CCS",
  name: "Commander Corps of Signals (CCS)",
  children: [
    { code: "NASS", name: "Nigerian Army School of Signals (NASS)" },

    // Signals Commands, Lagos.
    { code: "55 SC", name: "55 Signals Command" },
    { code: "56 SC", name: "56 Signals Command" },
    { code: "57 SC", name: "57 Signals Command" },
    { code: "58 SC", name: "58 Signals Command" },

    { code: "NASDC", name: "NA System Development Centre (NASDC)" },

    {
      code: "NACWC",
      name: "Nigerian Army Cyber Warfare Command (NACWC)",
      children: [
        { code: "NACWS", name: "Nigerian Army Cyber Warfare School (NACWS)" },
      ],
    },

    // Signal brigades. 57 SB and 57 SC are distinct formations that share a
    // number, which is why the login address carries the type as well.
    { code: "53 SB", name: "53 Signal Brigade" },
    { code: "57 SB", name: "57 Signal Brigade" },

    { code: "540 SR", name: "540 Signal Regiment", role: "OPERATIONAL" },
    { code: "590 SR", name: "590 Signal Regiment", role: "OPERATIONAL" },

    { code: "521 BS", name: "521 Brigade Signals", role: "ATTACHED" },
    { code: "541 BS", name: "541 Brigade Signals", role: "ATTACHED" },

    {
      code: "AHQGSG",
      name: "Army Headquarters Garrison and Signal Group",
      children: [
        {
          code: "LGSR",
          name: "Lagos Garrison Signal Regiment",
          role: "OPERATIONAL",
        },
      ],
    },

    { code: "COSL", name: "Corps of Signals, Lagos" },
  ],
}

const apply = process.argv.includes("--apply")
const created: { name: string; email: string; password: string }[] = []
const skipped: { name: string; email: string; reason: string }[] = []

async function seed(node: Node, parentId: string) {
  const { email, password } = credentials(node.code)

  const existing = await prisma.formation.findUnique({ where: { email } })
  let id: string

  if (existing) {
    // Left exactly as found. Re-parenting or re-typing a formation that is
    // already carrying returns would move real data on a guess.
    skipped.push({ name: node.name, email, reason: `already exists as "${existing.name}"` })
    id = existing.id
  } else if (apply) {
    const formation = await prisma.formation.create({
      data: {
        name: node.name,
        role: node.role ?? null,
        parentId,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        privileges: privilegesFor(node),
        isActive: true,
      },
    })
    created.push({ name: node.name, email, password })
    id = formation.id
  } else {
    created.push({ name: node.name, email, password })
    // Nothing was written, so children have no real parent to hang off.
    // Reported anyway so a dry run shows the whole tree.
    id = "(dry-run)"
  }

  for (const child of node.children ?? []) await seed(child, id)
}

async function main() {
  const root = await prisma.formation.findFirst({ where: { parentId: null } })
  if (!root) {
    console.error("No top-level formation found. Run the main seed first (npm run db:seed).")
    process.exit(1)
  }

  console.log(`Root: ${root.name}`)
  console.log(apply ? "Mode: APPLY (writing)\n" : "Mode: dry run (nothing will be written)\n")

  await seed(TREE, root.id)

  if (created.length > 0) {
    console.log(`${apply ? "Created" : "Would create"} ${created.length} formation(s):\n`)
    console.table(created)
  }
  if (skipped.length > 0) {
    console.log(`\nLeft unchanged (${skipped.length}):`)
    for (const s of skipped) console.log(`  ${s.name} (${s.email}) - ${s.reason}`)
  }
  if (!apply) console.log("\nRe-run with --apply to write these to the database.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
