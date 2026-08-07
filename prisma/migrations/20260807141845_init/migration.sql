-- CreateEnum
CREATE TYPE "FormationType" AS ENUM ('ROOT', 'COMMAND', 'SCHOOL', 'SIGNAL_BRIGADE', 'SIGNAL_REGIMENT', 'BRIGADE_SIGNALS', 'UNIT');

-- CreateEnum
CREATE TYPE "FormationRole" AS ENUM ('OPERATIONAL', 'SUPPORT', 'ATTACHED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('UNIT_CLERK', 'REGIMENT_OFFICER', 'BRIGADE_ADMIN', 'COMMAND_ADMIN', 'NAS_ADMIN');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISCREPANCY', 'RETURNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EquipmentCondition" AS ENUM ('SERVICEABLE', 'UNSERVICEABLE', 'UNDER_REPAIR', 'AWAITING_EVACUATION');

-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FormationType" NOT NULL,
    "role" "FormationRole",
    "parentId" TEXT,
    "attachedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "rank" TEXT,
    "role" "Role" NOT NULL,
    "formationId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentReturn" (
    "id" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "requestRef" TEXT NOT NULL,
    "auth" TEXT,
    "dateIssued" TIMESTAMP(3),
    "formationId" TEXT NOT NULL,
    "howDeployed" TEXT,
    "purposeOfIssue" TEXT,
    "equipmentName" TEXT NOT NULL,
    "equipmentModel" TEXT,
    "band" TEXT,
    "equipmentType" TEXT,
    "equipmentSerial" TEXT NOT NULL,
    "origin" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "condition" "EquipmentCondition",
    "remarks" TEXT,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "fromStatus" "ReturnStatus",
    "toStatus" "ReturnStatus" NOT NULL,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Formation_parentId_idx" ON "Formation"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_serviceId_key" ON "User"("serviceId");

-- CreateIndex
CREATE INDEX "User_formationId_idx" ON "User"("formationId");

-- CreateIndex
CREATE INDEX "EquipmentReturn_formationId_idx" ON "EquipmentReturn"("formationId");

-- CreateIndex
CREATE INDEX "EquipmentReturn_status_idx" ON "EquipmentReturn"("status");

-- CreateIndex
CREATE INDEX "EquipmentReturn_equipmentSerial_idx" ON "EquipmentReturn"("equipmentSerial");

-- CreateIndex
CREATE INDEX "StatusHistory_returnId_idx" ON "StatusHistory"("returnId");

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentReturn" ADD CONSTRAINT "EquipmentReturn_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentReturn" ADD CONSTRAINT "EquipmentReturn_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "EquipmentReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
