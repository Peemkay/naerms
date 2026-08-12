"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Menu, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { FORMATION_TYPE_TAG } from "@/lib/formation-labels"
import type { FormationTreeNode } from "@/lib/formation-tree"
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

function nodeHref(node: FormationTreeNode, rootId: string) {
  return node.id === rootId ? "/dashboard" : `/dashboard/formations/${node.id}`
}

function TreeNode({
  node,
  rootId,
  depth,
  onNavigate,
}: {
  node: FormationTreeNode
  rootId: string
  depth: number
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const href = nodeHref(node, rootId)
  const active = pathname === href

  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
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
            <TreeNode key={child.id} node={child} rootId={rootId} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  )
}

function SidebarContent({
  tree,
  canAddFormation,
  onNavigate,
}: {
  tree: FormationTreeNode
  canAddFormation: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Formations
        </p>
        {canAddFormation && (
          <Link
            href="/dashboard/formations/new"
            onClick={onNavigate}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3" />
            Add
          </Link>
        )}
      </div>
      <ul>
        <TreeNode node={tree} rootId={tree.id} depth={0} onNavigate={onNavigate} />
      </ul>
    </>
  )
}

// Below lg, the tree becomes a drawer opened from a toggle bar above the
// main content — a fixed w-64 sidebar sitting permanently alongside content
// left almost no room for anything else on a phone-width screen.
export function FormationTreeSidebar({
  tree,
  canAddFormation,
}: {
  tree: FormationTreeNode
  canAddFormation: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="border-b border-border px-4 py-2 lg:hidden">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-3.5" />
          Formations
        </Button>
      </div>

      <nav className="hidden w-64 shrink-0 border-r border-border py-4 lg:block">
        <SidebarContent tree={tree} canAddFormation={canAddFormation} />
      </nav>

      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-background py-4 shadow-xl outline-none duration-150 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left"
        >
          <SidebarContent tree={tree} canAddFormation={canAddFormation} onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
