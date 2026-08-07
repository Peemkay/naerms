"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { FORMATION_TYPE_TAG } from "@/lib/formation-labels"
import type { FormationTreeNode } from "@/lib/formation-tree"

function nodeHref(node: FormationTreeNode, rootId: string) {
  return node.id === rootId ? "/admin" : `/admin/formations/${node.id}`
}

function TreeNode({
  node,
  rootId,
  depth,
}: {
  node: FormationTreeNode
  rootId: string
  depth: number
}) {
  const pathname = usePathname()
  const href = nodeHref(node, rootId)
  const active = pathname === href

  return (
    <li>
      <Link
        href={href}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={cn(
          "flex items-center gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors",
          active
            ? "bg-secondary font-medium text-secondary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span className="rounded border border-border px-1 text-[10px] tracking-wide text-muted-foreground uppercase">
          {FORMATION_TYPE_TAG[node.type]}
        </span>
        <span className="truncate">{node.name}</span>
      </Link>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} rootId={rootId} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function FormationTreeSidebar({ tree }: { tree: FormationTreeNode }) {
  return (
    <nav className="w-64 shrink-0 border-r border-border py-4">
      <div className="flex items-center justify-between px-4 pb-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Formations
        </p>
        <Link
          href="/formations/new"
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3" />
          Add
        </Link>
      </div>
      <ul>
        <TreeNode node={tree} rootId={tree.id} depth={0} />
      </ul>
    </nav>
  )
}
