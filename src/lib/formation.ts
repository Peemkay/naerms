import { prisma } from "@/lib/prisma"
import { getVisibleFormationIds } from "@/lib/scope"
import type { Formation } from "@prisma/client"

/**
 * Walks a formation's chain of command upward (via `parentId`, i.e. the pure
 * NAS reporting line — never `attachedTo`) from itself to ROOT.
 */
export async function getFormationAncestors(formationId: string): Promise<Formation[]> {
  const rows = await prisma.$queryRaw<Formation[]>`
    WITH RECURSIVE ancestors AS (
      SELECT *, 0 AS depth FROM "Formation" WHERE id = ${formationId}
      UNION ALL
      SELECT f.*, a.depth + 1
      FROM "Formation" f
      INNER JOIN ancestors a ON f.id = a."parentId"
    )
    SELECT * FROM ancestors ORDER BY depth ASC
  `
  return rows
}

/**
 * BS business rule: a return's `origin` defaults to the nearest
 * BRIGADE_SIGNALS ancestor's `attachedTo` (walking self-upward, since a UNIT
 * sitting under a BS detachment inherits its parent's attachment). Returns
 * null for anyone not in a BS lineage — the clerk just types origin in free.
 */
export async function getDefaultOriginForFormation(formationId: string): Promise<string | null> {
  const ancestors = await getFormationAncestors(formationId)
  const bsAncestor = ancestors.find((f) => f.type === "BRIGADE_SIGNALS")
  return bsAncestor?.attachedTo ?? null
}

export type FormationPickerOption = {
  id: string
  name: string
  type: Formation["type"]
  path: string
}

/**
 * Every formation in the system, labeled with its full chain-of-command path
 * (e.g. "Nigerian Army Signals (NAS) / NACWC / 52 Signals Brigade"), for use
 * as a parent-formation picker. New formations show up here immediately —
 * there's no separate cache or hardcoded list to keep in sync.
 */
export async function getFormationPickerOptions(): Promise<FormationPickerOption[]> {
  const formations = await prisma.formation.findMany({
    select: { id: true, name: true, type: true, parentId: true },
  })
  const byId = new Map(formations.map((f) => [f.id, f]))

  function pathFor(formation: (typeof formations)[number]): string {
    const parts = [formation.name]
    let current = formation
    while (current.parentId) {
      const parent = byId.get(current.parentId)
      if (!parent) break
      parts.unshift(parent.name)
      current = parent
    }
    return parts.join(" / ")
  }

  return formations
    .map((f) => ({ id: f.id, name: f.name, type: f.type, path: pathFor(f) }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** Same picker options, restricted to one formation's visible scope. */
export async function getFormationOptionsInScope(rootFormationId: string): Promise<FormationPickerOption[]> {
  const [all, visibleIds] = await Promise.all([
    getFormationPickerOptions(),
    getVisibleFormationIds(rootFormationId),
  ])
  const visible = new Set(visibleIds)
  return all.filter((f) => visible.has(f.id))
}

export type FormationGroup = {
  /** The formation the group hangs off, e.g. "HQ 52 SB". */
  headingId: string
  headingName: string
  /** The head itself first, then everything directly under it. */
  members: { id: string; name: string }[]
}

/**
 * Formations grouped the way the returns register is organised on paper:
 * a headquarters followed by the units that report to it, one blank line
 * between blocks.
 *
 *   HQ 52 SB
 *   510 SR
 *   515 SR
 *   511 BS
 *
 * Each entry is the formation's own name only — no chain-of-command path —
 * because the grouping already says who a unit sits under, and the full
 * path made every row unreadably long in a picker.
 *
 * A formation with no children of its own is still listed, under whichever
 * parent it belongs to, so nothing in scope can go unselectable.
 */
export async function getGroupedFormationsInScope(
  rootFormationId: string
): Promise<FormationGroup[]> {
  const visibleIds = await getVisibleFormationIds(rootFormationId)
  const formations = await prisma.formation.findMany({
    where: { id: { in: visibleIds } },
    select: { id: true, name: true, parentId: true, type: true },
    orderBy: { name: "asc" },
  })

  const byId = new Map(formations.map((f) => [f.id, f]))
  const childrenOf = new Map<string, typeof formations>()
  for (const formation of formations) {
    const key = formation.parentId ?? "__root__"
    const list = childrenOf.get(key) ?? []
    list.push(formation)
    childrenOf.set(key, list)
  }

  // A formation heads a block if it has children in scope. Everything else
  // is a member of its parent's block.
  const groups: FormationGroup[] = []
  const placed = new Set<string>()

  // Walk from the top of the visible tree down, so blocks come out in
  // chain-of-command order rather than alphabetically across the whole set.
  const roots = formations.filter((f) => !f.parentId || !byId.has(f.parentId))

  function addGroup(head: (typeof formations)[number]) {
    const children = childrenOf.get(head.id) ?? []
    if (children.length === 0) return

    groups.push({
      headingId: head.id,
      headingName: head.name,
      members: [
        // The HQ itself can be asked for a return too, so it leads its own
        // block rather than being a heading you can't select.
        { id: head.id, name: head.name },
        ...children.map((c) => ({ id: c.id, name: c.name })),
      ],
    })
    placed.add(head.id)
    for (const child of children) placed.add(child.id)

    // Depth-first: a subordinate HQ's own block follows immediately after
    // the block it appears in, keeping the hierarchy readable top to bottom.
    for (const child of children) addGroup(child)
  }

  for (const root of roots) addGroup(root)

  // Anything with no children and no in-scope parent (a lone unit) still
  // needs to be selectable.
  const orphans = formations.filter((f) => !placed.has(f.id))
  if (orphans.length > 0) {
    groups.push({
      headingId: "__other__",
      headingName: "Other Formations",
      members: orphans.map((f) => ({ id: f.id, name: f.name })),
    })
  }

  return groups
}
