-- Formation type is removed. Classifying every formation as BRIGADE /
-- REGIMENT / SCHOOL added a required field to every form while changing
-- nothing about behaviour: scope, notifications and returns are all
-- computed from parentId alone, so position in the tree is the only
-- classification that ever mattered.
--
-- Nothing is lost that the tree does not already say, and the type was
-- never referenced by any other table.
ALTER TABLE "Formation" DROP COLUMN "type";

DROP TYPE "FormationType";

-- Manual ordering among siblings, set by dragging in the tree. Defaults to
-- 0 so existing formations keep sorting by name until someone reorders
-- them.
ALTER TABLE "Formation" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
