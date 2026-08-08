-- DropIndex
DROP INDEX "ReturnItem_equipmentSerial_idx";

-- AlterTable
ALTER TABLE "Return" DROP COLUMN "dateIssued",
DROP COLUMN "howDeployed",
DROP COLUMN "purposeOfIssue";

-- AlterTable
ALTER TABLE "ReturnItem" DROP COLUMN "equipmentSerial",
ADD COLUMN     "dateIssued" TIMESTAMP(3),
ADD COLUMN     "howDeployed" TEXT,
ADD COLUMN     "purposeOfIssue" TEXT;

