"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { toast } from "sonner"
import { GripVertical, Menu, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import type { FormationTreeNode } from "@/lib/formation-tree"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { moveFormationAction, reorderFormationsAction } from "@/lib/actions/formations"

/** A pending drop, held until the user confirms it. */
type PendingMove = { id: string; name: string; parentId: string | null; parentName: string }

/** Every id at or below `node` — the set a node may not be dropped onto. */
function subtreeIds(node: FormationTreeNode): string[] {
  return [node.id, ...node.children.flatMap(subtreeIds)]
}

function findNode(node: FormationTreeNode, id: string): FormationTreeNode | null {
  if (node.id === id) return node
  for (const child of node.children) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return null
}

function nodeHref(node: FormationTreeNode, rootId: string) {
  return node.id === rootId ? "/dashboard" : `/dashboard/formations/${node.id}`
}

function TreeNode({
  node,
  rootId,
  depth,
  onNavigate,
  drag,
}: {
  node: FormationTreeNode
  rootId: string
  depth: number
  onNavigate?: () => void
  drag?: {
    draggingId: string | null
    forbidden: string[]
    onDragStart: (id: string) => void
    onDragEnd: () => void
    onDrop: (parent: FormationTreeNode) => void
    onDropTopLevel: () => void
    /** True when the dragged formation and this one share a parent. */
    canReorderWith: (node: FormationTreeNode) => boolean
    onDropBefore: (sibling: FormationTreeNode) => void
  }
}) {
  const pathname = usePathname()
  const [over, setOver] = useState(false)
  const [overBefore, setOverBefore] = useState(false)
  const href = nodeHref(node, rootId)
  const active = pathname === href

  // Only the drag handle is draggable, not the whole row: the row is a
  // link, and making a link draggable turns every slightly-off click into a
  // drag instead of a navigation.
  //
  // The topmost visible formation is draggable too. It is only "the root" of
  // this viewer's scope, not of the world — NAS itself is expected to end up
  // under an Army Headquarters — and it can always be dropped on the
  // top-level zone even when no other target is legal.
  const canDrag = !!drag
  const isDragging = drag?.draggingId === node.id
  // A node can't be dropped onto itself or anything beneath it — that would
  // detach the branch from the chain of command. The server refuses these
  // too; refusing them here means no invalid drop is ever offered.
  const canDrop = !!drag?.draggingId && !drag.forbidden.includes(node.id)

  return (
    <li>
      {/* A thin strip above each row reorders siblings instead of
          re-parenting: dropping *onto* a formation puts you under it,
          dropping *between* two puts you beside them. Only shown while
          dragging a sibling, since ordering only means anything within one
          parent's children. */}
      {drag?.draggingId && drag.canReorderWith(node) && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setOverBefore(true)
          }}
          onDragLeave={() => setOverBefore(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOverBefore(false)
            drag.onDropBefore(node)
          }}
          style={{ marginLeft: `${depth * 14 + 10}px` }}
          className={cn(
            "h-1.5 rounded-full transition-colors",
            overBefore ? "bg-primary" : "bg-transparent"
          )}
        />
      )}
      <div
        onDragOver={(e) => {
          if (!canDrop) return
          // preventDefault is what marks this a valid drop target at all;
          // without dropEffect the cursor still reads "not allowed".
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!canDrop) return
          e.preventDefault()
          setOver(false)
          drag?.onDrop(node)
        }}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={cn(
          "flex items-center gap-1 rounded-md pr-2 transition-colors",
          active
            ? "bg-secondary font-medium text-secondary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          isDragging && "opacity-40",
          over && canDrop && "ring-2 ring-primary ring-inset"
        )}
      >
        {canDrag && (
          <span
            draggable
            onDragStart={(e) => {
              // A drag with no data payload is cancelled outright by Chrome
              // and Safari, so the whole gesture silently did nothing. The
              // id is what the drop handlers read back, and setting
              // effectAllowed is what gives the cursor its "move" affordance.
              e.dataTransfer.setData("text/plain", node.id)
              e.dataTransfer.effectAllowed = "move"
              drag?.onDragStart(node.id)
            }}
            onDragEnd={() => drag?.onDragEnd()}
            aria-label={`Drag ${node.name} to a new parent formation`}
            title="Drag onto another formation to move it there"
            className="shrink-0 cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-3" />
          </span>
        )}
        <Link
          href={href}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm"
        >
          <span className="truncate">{node.name}</span>
          {node.children.length > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
              {node.children.length}
            </span>
          )}
        </Link>
      </div>
      {/* A formation holding subordinates is drawn as a bordered group, so
          where one parent's children end and the next begins is visible at a
          glance. The border sits on the list, not the rows, so a child can
          still be dragged out of it onto any other formation. */}
      {node.children.length > 0 && (
        <ul
          className="my-0.5 ml-3 border-l-2 border-border/70 pl-1"
          style={{ marginLeft: `${depth * 14 + 16}px` }}
        >
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              rootId={rootId}
              // Indentation now comes from the group's own left margin, so
              // rows inside a group all sit at the same depth.
              depth={0}
              onNavigate={onNavigate}
              drag={drag}
            />
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
  drag,
}: {
  tree: FormationTreeNode
  canAddFormation: boolean
  onNavigate?: () => void
  drag?: React.ComponentProps<typeof TreeNode>["drag"]
}) {
  const [topOver, setTopOver] = useState(false)

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
      {drag && (
        <p className="px-4 pb-2 text-[11px] text-muted-foreground">
          Drag onto a formation to move it there, or between two to reorder.
        </p>
      )}

      {/* Dropping here detaches a formation to the top level, alongside NAS
          rather than beneath it. Without this the topmost formation would be
          unmovable by definition: everything else is inside its own subtree,
          so every other target is refused as a cycle. */}
      {drag?.draggingId && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setTopOver(true)
          }}
          onDragLeave={() => setTopOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setTopOver(false)
            drag.onDropTopLevel()
          }}
          className={cn(
            "mx-3 mb-2 rounded-md border border-dashed px-2 py-1.5 text-center text-[11px] transition-colors",
            topOver
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground"
          )}
        >
          Drop here to move to the top level
        </div>
      )}

      <ul>
        <TreeNode node={tree} rootId={tree.id} depth={0} onNavigate={onNavigate} drag={drag} />
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
  canMoveFormations = false,
}: {
  tree: FormationTreeNode
  canAddFormation: boolean
  /** MANAGE_FORMATIONS holders can drag a formation to a new parent. */
  canMoveFormations?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingMove | null>(null)
  const [saving, startTransition] = useTransition()

  // Dropping a formation onto itself or one of its own descendants would
  // detach that branch from the root. Computed as the drag starts so the
  // invalid targets simply don't light up.
  const dragged = draggingId ? findNode(tree, draggingId) : null
  const forbidden = dragged ? subtreeIds(dragged) : []

  const drag = canMoveFormations
    ? {
        draggingId,
        forbidden,
        onDragStart: setDraggingId,
        onDragEnd: () => setDraggingId(null),
        onDrop: (parent: FormationTreeNode) => {
          const moving = draggingId ? findNode(tree, draggingId) : null
          setDraggingId(null)
          if (!moving || moving.id === parent.id) return
          // Confirmed rather than applied on drop: a drag is one slip away
          // from silently re-parenting a unit that is carrying returns, and
          // the move changes who can see that unit's whole subtree.
          setPending({ id: moving.id, name: moving.name, parentId: parent.id, parentName: parent.name })
        },
        onDropTopLevel: () => {
          const moving = draggingId ? findNode(tree, draggingId) : null
          setDraggingId(null)
          if (!moving) return
          setPending({
            id: moving.id,
            name: moving.name,
            parentId: null,
            parentName: "the top level",
          })
        },
        canReorderWith: (node: FormationTreeNode) =>
          !!dragged && node.id !== dragged.id && node.parentId === dragged.parentId,
        onDropBefore: (sibling: FormationTreeNode) => {
          const moving = draggingId ? findNode(tree, draggingId) : null
          setDraggingId(null)
          if (!moving || moving.id === sibling.id) return

          // Reordering only rearranges a listing, so unlike a move it is
          // applied straight away: nothing about who can see what changes.
          const parent = moving.parentId ? findNode(tree, moving.parentId) : null
          const siblings = (parent ? parent.children : [tree]).map((c) => c.id)
          const without = siblings.filter((id) => id !== moving.id)
          const at = without.indexOf(sibling.id)
          const orderedIds = [...without.slice(0, at), moving.id, ...without.slice(at)]

          startTransition(async () => {
            const res = await reorderFormationsAction({
              parentId: moving.parentId,
              orderedIds,
            })
            if ("error" in res) toast.error(res.error)
            else router.refresh()
          })
        },
      }
    : undefined

  function confirmMove() {
    if (!pending) return
    startTransition(async () => {
      const res = await moveFormationAction(pending.id, { parentId: pending.parentId })
      if ("error" in res) {
        toast.error(res.error)
        setPending(null)
        return
      }
      toast.success(`${pending.name} now reports to ${pending.parentName}.`)
      setPending(null)
      router.refresh()
    })
  }

  return (
    <>
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
          <SidebarContent tree={tree} canAddFormation={canAddFormation} drag={drag} />
        </nav>

        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Popup
            data-slot="dialog-content"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-background py-4 shadow-xl outline-none duration-150 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left"
          >
            <SidebarContent
              tree={tree}
              canAddFormation={canAddFormation}
              onNavigate={() => setOpen(false)}
              drag={drag}
            />
          </DialogPrimitive.Popup>
        </DialogPortal>
      </Dialog>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {pending?.name}?</DialogTitle>
            <DialogDescription>
              {pending?.name} and everything under it will report to {pending?.parentName}. This
              changes which formations can see and verify its returns.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={confirmMove} disabled={saving}>
              {saving ? "Moving…" : "Move Formation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
