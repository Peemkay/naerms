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

/** Same picker options, restricted to one admin's visible scope (for user creation). */
export async function getFormationOptionsInScope(rootFormationId: string): Promise<FormationPickerOption[]> {
  const [all, visibleIds] = await Promise.all([
    getFormationPickerOptions(),
    getVisibleFormationIds(rootFormationId),
  ])
  const visible = new Set(visibleIds)
  return all.filter((f) => visible.has(f.id))
}
