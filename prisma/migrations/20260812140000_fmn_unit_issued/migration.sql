-- "Fmn/Unit Issuied" from the paper register. Distinct from the owning
-- formation: a sheet headed "51 SB" carries lines reading "NISIGS ESSMGB",
-- naming the sub-unit or detachment the equipment actually went to, which
-- is frequently not a formation in the tree at all. Nullable, so existing
-- rows fall back to the owning formation's name when displayed.
ALTER TABLE "ReturnItem" ADD COLUMN "fmnUnitIssued" TEXT;
