-- Register columns present on the paper sheet (rtns.xlsx, Sheet2) that the
-- data model didn't carry yet. All nullable: existing rows predate them and
-- plenty of real lines legitimately leave them blank.
ALTER TABLE "ReturnItem" ADD COLUMN "equipmentSerial" TEXT;
ALTER TABLE "ReturnItem" ADD COLUMN "letterOfRequest" TEXT;
ALTER TABLE "ReturnItem" ADD COLUMN "authority" TEXT;

-- Presentation layer for the spreadsheet view. Kept apart from ReturnItem
-- so formatting can never corrupt a holding: dropping these two tables
-- would lose styling and spare-column notes, nothing of record.
CREATE TABLE "SheetCell" (
    "id" TEXT NOT NULL,
    "returnItemId" TEXT NOT NULL,
    "columnKey" TEXT NOT NULL,
    "value" TEXT,
    "formula" TEXT,
    "bold" BOOLEAN,
    "italic" BOOLEAN,
    "fillColor" TEXT,
    "textColor" TEXT,
    "numberFormat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetCell_pkey" PRIMARY KEY ("id")
);

-- Cells are addressed by (item, column), never by row index, so inserting
-- or re-sorting rows can't shift formatting onto the wrong equipment.
CREATE UNIQUE INDEX "SheetCell_returnItemId_columnKey_key" ON "SheetCell"("returnItemId", "columnKey");
CREATE INDEX "SheetCell_returnItemId_idx" ON "SheetCell"("returnItemId");

-- Superiors read subordinate sheets but never edit them; commenting is the
-- reviewing channel instead.
CREATE TABLE "SheetComment" (
    "id" TEXT NOT NULL,
    "returnItemId" TEXT NOT NULL,
    "columnKey" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SheetComment_returnItemId_idx" ON "SheetComment"("returnItemId");
CREATE INDEX "SheetComment_authorId_idx" ON "SheetComment"("authorId");

CREATE TABLE "SheetSettings" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "columnWidths" JSONB,
    "hiddenColumns" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SheetSettings_formationId_key" ON "SheetSettings"("formationId");

-- Cascade on both: a deleted item's formatting and a deleted formation's
-- sheet preferences have no meaning once their owner is gone.
ALTER TABLE "SheetCell" ADD CONSTRAINT "SheetCell_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetComment" ADD CONSTRAINT "SheetComment_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetComment" ADD CONSTRAINT "SheetComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetSettings" ADD CONSTRAINT "SheetSettings_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
