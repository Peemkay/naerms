-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RETURN_SUBMITTED', 'RETURN_REQUESTED');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'RETURN_SUBMITTED',
ALTER COLUMN "returnId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReturnItem" DROP COLUMN "condition",
ADD COLUMN     "awaitingEvacuationQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "serviceableQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "underRepairQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unserviceableQty" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "requestRef" TEXT NOT NULL,
    "message" TEXT,
    "fromFormationId" TEXT NOT NULL,
    "toFormationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReturnRequest_toFormationId_idx" ON "ReturnRequest"("toFormationId");

-- CreateIndex
CREATE INDEX "ReturnRequest_fromFormationId_idx" ON "ReturnRequest"("fromFormationId");

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_fromFormationId_fkey" FOREIGN KEY ("fromFormationId") REFERENCES "Formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_toFormationId_fkey" FOREIGN KEY ("toFormationId") REFERENCES "Formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

