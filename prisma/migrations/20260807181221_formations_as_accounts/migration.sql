-- CreateEnum
CREATE TYPE "Privilege" AS ENUM ('MANAGE_FORMATIONS', 'MANAGE_ACCOUNTS', 'MANAGE_PRIVILEGES', 'VERIFY_RETURNS');

-- DropForeignKey
ALTER TABLE "EquipmentReturn" DROP CONSTRAINT "EquipmentReturn_formationId_fkey";

-- DropForeignKey
ALTER TABLE "EquipmentReturn" DROP CONSTRAINT "EquipmentReturn_submittedById_fkey";

-- DropForeignKey
ALTER TABLE "StatusHistory" DROP CONSTRAINT "StatusHistory_changedById_fkey";

-- DropForeignKey
ALTER TABLE "StatusHistory" DROP CONSTRAINT "StatusHistory_returnId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_formationId_fkey";

-- DropIndex
DROP INDEX "StatusHistory_returnId_idx";

-- AlterTable
ALTER TABLE "Formation" ADD COLUMN     "email" TEXT,
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "privileges" "Privilege"[];

-- AlterTable
ALTER TABLE "StatusHistory" DROP COLUMN "returnId",
ADD COLUMN     "returnItemId" TEXT NOT NULL;

-- DropTable
DROP TABLE "EquipmentReturn";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "requestRef" TEXT NOT NULL,
    "auth" TEXT,
    "dateIssued" TIMESTAMP(3),
    "formationId" TEXT NOT NULL,
    "howDeployed" TEXT,
    "purposeOfIssue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "equipmentName" TEXT NOT NULL,
    "equipmentModel" TEXT,
    "band" TEXT,
    "equipmentType" TEXT,
    "equipmentSerial" TEXT NOT NULL,
    "origin" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "condition" "EquipmentCondition",
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Return_formationId_idx" ON "Return"("formationId");

-- CreateIndex
CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ReturnItem_status_idx" ON "ReturnItem"("status");

-- CreateIndex
CREATE INDEX "ReturnItem_equipmentSerial_idx" ON "ReturnItem"("equipmentSerial");

-- CreateIndex
CREATE INDEX "Notification_formationId_isRead_idx" ON "Notification"("formationId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Formation_email_key" ON "Formation"("email");

-- CreateIndex
CREATE INDEX "StatusHistory_returnItemId_idx" ON "StatusHistory"("returnItemId");

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

