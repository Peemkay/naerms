import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import ws from "ws"
import bcrypt from "bcryptjs"

neonConfig.webSocketConstructor = ws
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Every seeded login shares this password so the "log in as different
// roles" smoke test only requires remembering one credential.
const SEED_PASSWORD = "naerms123"

async function main() {
  // Safe to re-run: this seed has no natural unique key to upsert against
  // (Formation ids are generated, not chosen), so rather than fake an
  // upsert, just refuse to double-seed once the sample tree already exists.
  const existingRoot = await prisma.formation.findFirst({ where: { type: "ROOT" } })
  if (existingRoot) {
    console.log("A ROOT formation already exists — skipping seed (already seeded).")
    return
  }

  console.log("Seeding NAERMS sample NAS tree...")
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)

  // --- Formation tree --------------------------------------------------
  const nas = await prisma.formation.create({
    data: { name: "Nigerian Army Signals (NAS)", type: "ROOT" },
  })

  const nacwc = await prisma.formation.create({
    data: { name: "NACWC", type: "COMMAND", parentId: nas.id },
  })

  const brigade = await prisma.formation.create({
    data: { name: "52 Signals Brigade", type: "SIGNAL_BRIGADE", parentId: nacwc.id },
  })

  const sr520 = await prisma.formation.create({
    data: {
      name: "520 Signal Regiment",
      type: "SIGNAL_REGIMENT",
      role: "OPERATIONAL",
      parentId: brigade.id,
    },
  })

  const bs521 = await prisma.formation.create({
    data: {
      name: "521 Brigade Signals",
      type: "BRIGADE_SIGNALS",
      role: "ATTACHED",
      parentId: brigade.id, // chain of command stays NAS
      attachedTo: "4 Mechanised Infantry Brigade", // operational support only
    },
  })

  const unitA = await prisma.formation.create({
    data: { name: "520 SR Unit A", type: "UNIT", parentId: sr520.id },
  })

  const unitBsDet = await prisma.formation.create({
    data: { name: "521 BS Detachment", type: "UNIT", parentId: bs521.id },
  })

  // --- Users: one per role, plus a second clerk under the BS chain -----
  const [nasAdmin, commandAdmin, brigadeAdmin, regimentOfficer, clerkSr, clerkBs] =
    await Promise.all([
      prisma.user.create({
        data: {
          serviceId: "NA/10001",
          fullName: "A. Balogun",
          rank: "Maj Gen",
          role: "NAS_ADMIN",
          formationId: nas.id,
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          serviceId: "NA/10002",
          fullName: "K. Suleiman",
          rank: "Brig Gen",
          role: "COMMAND_ADMIN",
          formationId: nacwc.id,
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          serviceId: "NA/10003",
          fullName: "T. Okonkwo",
          rank: "Col",
          role: "BRIGADE_ADMIN",
          formationId: brigade.id,
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          serviceId: "NA/10004",
          fullName: "M. Danladi",
          rank: "Lt Col",
          role: "REGIMENT_OFFICER",
          formationId: sr520.id,
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          serviceId: "NA/20001",
          fullName: "I. Yusuf",
          rank: "Sgt",
          role: "UNIT_CLERK",
          formationId: unitA.id,
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          serviceId: "NA/20002",
          fullName: "E. Nwosu",
          rank: "Cpl",
          role: "UNIT_CLERK",
          formationId: unitBsDet.id,
          passwordHash,
        },
      }),
    ])

  // --- Sample equipment returns -----------------------------------------
  const returnA1 = await prisma.equipmentReturn.create({
    data: {
      serialNo: 1,
      requestRef: "REQ/520SR/2026/001",
      auth: "HQ 52 Sigs Bde 001",
      dateIssued: new Date("2026-01-15"),
      formationId: unitA.id,
      howDeployed: "Field Exercise",
      purposeOfIssue: "Comms support for Ex Iron Fist",
      equipmentName: "Tactical VHF Radio",
      equipmentModel: "PRC-152",
      band: "VHF",
      equipmentType: "Radio",
      equipmentSerial: "PRC152-00981",
      origin: "520 Signal Regiment",
      status: "VERIFIED",
      condition: "SERVICEABLE",
      submittedById: clerkSr.id,
    },
  })

  const returnA2 = await prisma.equipmentReturn.create({
    data: {
      serialNo: 2,
      requestRef: "REQ/520SR/2026/002",
      auth: "HQ 52 Sigs Bde 002",
      dateIssued: new Date("2026-03-02"),
      formationId: unitA.id,
      howDeployed: "Static - HQ",
      purposeOfIssue: "Base station comms",
      equipmentName: "HF Base Station",
      equipmentModel: "PRC-1099",
      band: "HF",
      equipmentType: "Radio",
      equipmentSerial: "HF1099-00452",
      origin: "520 Signal Regiment",
      status: "PENDING",
      condition: "UNDER_REPAIR",
      remarks: "Power supply unit intermittent, sent to workshop",
      submittedById: clerkSr.id,
    },
  })

  const returnBs1 = await prisma.equipmentReturn.create({
    data: {
      serialNo: 1,
      requestRef: "REQ/521BS/2026/001",
      auth: "HQ 52 Sigs Bde 014",
      dateIssued: new Date("2026-02-10"),
      formationId: unitBsDet.id,
      howDeployed: "Attached Ops",
      purposeOfIssue: "Comms det for 4 Mech Inf Bde field ops",
      equipmentName: "Man-pack VHF Radio",
      equipmentModel: "PRC-77",
      band: "VHF",
      equipmentType: "Radio",
      equipmentSerial: "PRC77-01123",
      // BS return: origin defaults from attachedTo, per the app's business rule.
      origin: bs521.attachedTo,
      status: "DISCREPANCY",
      condition: "UNSERVICEABLE",
      remarks: "Returned with cracked housing, not on original issue voucher",
      submittedById: clerkBs.id,
    },
  })

  const returnBs2 = await prisma.equipmentReturn.create({
    data: {
      serialNo: 2,
      requestRef: "REQ/521BS/2026/002",
      auth: "HQ 52 Sigs Bde 015",
      dateIssued: new Date("2026-04-20"),
      formationId: unitBsDet.id,
      howDeployed: "Attached Ops",
      purposeOfIssue: "Convoy comms",
      equipmentName: "VHF Antenna Kit",
      band: "VHF",
      equipmentType: "Antenna",
      equipmentSerial: "ANT-VHF-00219",
      origin: bs521.attachedTo,
      status: "CLOSED",
      condition: "SERVICEABLE",
      submittedById: clerkBs.id,
    },
  })

  // --- Audit trail for the returns that have actually moved -------------
  await prisma.statusHistory.createMany({
    data: [
      {
        returnId: returnA1.id,
        changedById: regimentOfficer.id,
        fromStatus: "PENDING",
        toStatus: "VERIFIED",
        note: "Confirmed against unit ledger.",
      },
      {
        returnId: returnBs1.id,
        changedById: brigadeAdmin.id,
        fromStatus: "PENDING",
        toStatus: "DISCREPANCY",
        note: "Serial not found on original issue voucher; flagged for follow-up.",
      },
      {
        returnId: returnBs2.id,
        changedById: brigadeAdmin.id,
        fromStatus: "PENDING",
        toStatus: "VERIFIED",
        note: "Verified on receipt.",
      },
      {
        returnId: returnBs2.id,
        changedById: commandAdmin.id,
        fromStatus: "VERIFIED",
        toStatus: "RETURNED",
        note: "Equipment physically handed in to QM stores.",
      },
      {
        returnId: returnBs2.id,
        changedById: nasAdmin.id,
        fromStatus: "RETURNED",
        toStatus: "CLOSED",
        note: "Reconciled and closed out.",
      },
    ],
  })

  console.log("Seed complete.")
  console.table(
    [
      { serviceId: "NA/10001", role: "NAS_ADMIN", formation: nas.name },
      { serviceId: "NA/10002", role: "COMMAND_ADMIN", formation: nacwc.name },
      { serviceId: "NA/10003", role: "BRIGADE_ADMIN", formation: brigade.name },
      { serviceId: "NA/10004", role: "REGIMENT_OFFICER", formation: sr520.name },
      { serviceId: "NA/20001", role: "UNIT_CLERK", formation: unitA.name },
      { serviceId: "NA/20002", role: "UNIT_CLERK", formation: unitBsDet.name },
    ].map((r) => ({ ...r, password: SEED_PASSWORD }))
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
