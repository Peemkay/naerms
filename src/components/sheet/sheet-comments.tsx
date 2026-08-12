"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, MessageSquare, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { addSheetCommentAction, resolveSheetCommentAction } from "@/lib/actions/sheet"
import type { SheetComment } from "@/lib/sheet/data"

/**
 * The review channel for a sheet.
 *
 * Superiors read a subordinate's register but never edit it, so this is how
 * a query gets raised: a note against a specific row, visible to the owning
 * formation and to anyone else who can see that row, resolvable by either
 * side once actioned.
 */
export function SheetComments({
  comments,
  selectedRowId,
  selectedRowLabel,
  open,
  onClose,
}: {
  comments: SheetComment[]
  selectedRowId: string | null
  selectedRowLabel: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()
  const [showResolved, setShowResolved] = useState(false)

  const forRow = comments.filter((c) => c.returnItemId === selectedRowId)
  const visible = showResolved ? forRow : forRow.filter((c) => !c.resolvedAt)

  if (!open) return null

  function submit() {
    if (!selectedRowId || !body.trim()) return
    startTransition(async () => {
      const res = await addSheetCommentAction({ returnItemId: selectedRowId, body })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setBody("")
      toast.success("Comment added.")
      router.refresh()
    })
  }

  function toggleResolved(id: string) {
    startTransition(async () => {
      const res = await resolveSheetCommentAction(id)
      if ("error" in res) toast.error(res.error)
      else router.refresh()
    })
  }

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-lg border border-border bg-card lg:w-80">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquare className="size-3.5" />
          Comments
        </p>
        <Button variant="ghost" size="icon-sm" aria-label="Close comments" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      {!selectedRowId ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          Select a row to read or add comments.
        </p>
      ) : (
        <>
          <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
            On: <span className="font-medium text-foreground">{selectedRowLabel}</span>
          </p>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {visible.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">
                {forRow.length > 0 ? "No open comments on this row." : "No comments on this row yet."}
              </p>
            )}
            {visible.map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  "rounded-md border border-border p-2",
                  comment.resolvedAt && "opacity-60"
                )}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-xs font-medium">{comment.authorName}</p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={comment.resolvedAt ? "Reopen comment" : "Resolve comment"}
                    disabled={pending}
                    onClick={() => toggleResolved(comment.id)}
                  >
                    <Check className={cn("size-3.5", comment.resolvedAt && "text-status-success")} />
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleString("en-GB")}
                  {comment.resolvedAt && " (resolved)"}
                </p>
              </div>
            ))}
          </div>

          {forRow.some((c) => c.resolvedAt) && (
            <button
              type="button"
              onClick={() => setShowResolved((v) => !v)}
              className="border-t border-border px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              {showResolved ? "Hide resolved" : `Show resolved (${forRow.filter((c) => c.resolvedAt).length})`}
            </button>
          )}

          <div className="border-t border-border p-2">
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Raise a query on this row…"
              className="mb-2"
            />
            <Button size="sm" className="w-full" disabled={pending || !body.trim()} onClick={submit}>
              {pending ? "Adding…" : "Add Comment"}
            </Button>
          </div>
        </>
      )}
    </aside>
  )
}
