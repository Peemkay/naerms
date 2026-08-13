-- Backfill: anyone who could already restructure the tree keeps that
-- ability. Before this split, MANAGE_FORMATIONS covered moving as well, so
-- without this every existing admin would silently lose the ability to move
-- formations the moment the new privilege started being enforced.
--
-- Separate migration from the ADD VALUE above because Postgres refuses to
-- use a new enum value in the same transaction that created it.
UPDATE "Formation"
SET "privileges" = "privileges" || ARRAY['MOVE_FORMATIONS']::"Privilege"[]
WHERE 'MANAGE_FORMATIONS' = ANY("privileges")
  AND NOT ('MOVE_FORMATIONS' = ANY("privileges"));
