import { prisma } from "@/lib/prisma"

/**
 * Resolves the set of formation IDs a user can see: their own formation plus
 * every descendant in the tree, walked recursively via `parentId`.
 *
 * This is deliberately the *only* place scope is computed. It knows nothing
 * about roles or formation types — a UNIT_CLERK's formation has no children,
 * so this naturally returns just their own unit; NAS_ADMIN sits at ROOT, so
 * this naturally returns every formation in the system. No formation list is
 * ever hardcoded.
 *
 * Prisma has no native recursive-CTE support, hence the raw query.
 */
export async function getVisibleFormationIds(rootFormationId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id FROM "Formation" WHERE id = ${rootFormationId}
      UNION ALL
      SELECT f.id
      FROM "Formation" f
      INNER JOIN descendants d ON f."parentId" = d.id
    )
    SELECT id FROM descendants
  `
  return rows.map((r) => r.id)
}

/** Convenience check: is `targetFormationId` within `rootFormationId`'s scope? */
export async function isFormationVisible(
  rootFormationId: string,
  targetFormationId: string
): Promise<boolean> {
  if (rootFormationId === targetFormationId) return true
  const visible = await getVisibleFormationIds(rootFormationId)
  return visible.includes(targetFormationId)
}
