import { prisma } from "@/lib/prisma"
import { getVisibleFormationIds } from "@/lib/scope"
import type { Formation } from "@prisma/client"

export type FormationTreeNode = Formation & { children: FormationTreeNode[] }

/** The admin's visible scope, shaped as a tree rooted at their own formation. */
export async function getVisibleFormationTree(rootFormationId: string): Promise<FormationTreeNode> {
  const ids = await getVisibleFormationIds(rootFormationId)
  const formations = await prisma.formation.findMany({ where: { id: { in: ids } } })

  const byId = new Map<string, FormationTreeNode>(
    formations.map((f) => [f.id, { ...f, children: [] }])
  )

  let root: FormationTreeNode | undefined
  for (const node of byId.values()) {
    if (node.id === rootFormationId) {
      root = node
      continue
    }
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    parent?.children.push(node)
  }

  if (!root) throw new Error("Root formation missing from its own visible set")
  return root
}
