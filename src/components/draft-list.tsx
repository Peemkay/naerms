"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileClock, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { deleteDraftAction } from "@/lib/actions/returns"

export type DraftSummary = {
  id: string
  requestRef: string
  itemCount: number
  updatedAt: string
}

/**
 * Saved-but-unsubmitted returns, offered for resuming. These are private to
 * the formation that saved them and are not in the register — nothing here
 * counts toward any dashboard tally until it is submitted.
 */
export function DraftList({ drafts }: { drafts: DraftSummary[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function discard(id: string, requestRef: string) {
    startTransition(async () => {
      const res = await deleteDraftAction(id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Draft ${requestRef} discarded.`)
      router.refresh()
    })
  }

  return (
    <div className="mb-6 rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <FileClock className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">
          Saved drafts ({drafts.length})
        </p>
      </div>
      <ul className="divide-y divide-border">
        {drafts.map((draft) => (
          <li key={draft.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{draft.requestRef}</p>
              <p className="text-xs text-muted-foreground">
                {draft.itemCount} item{draft.itemCount === 1 ? "" : "s"} (last saved{" "}
                {new Date(draft.updatedAt).toLocaleString("en-GB")})
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/dashboard/new-return?draft=${draft.id}`}>Resume</Link>}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Discard draft ${draft.requestRef}`}
                disabled={pending}
                onClick={() => discard(draft.id, draft.requestRef)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
