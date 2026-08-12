-- Drafts: a work-in-progress Return the clerk saved to resume later.
-- Existing rows are all real submissions, so they default to false and the
-- column can be NOT NULL without a backfill step.
ALTER TABLE "Return" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;

-- Drafts are always fetched as "this formation's drafts", never globally.
CREATE INDEX "Return_formationId_isDraft_idx" ON "Return"("formationId", "isDraft");
