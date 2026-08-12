"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { deleteReturnAction } from "@/lib/actions/returns"

// Deliberately irreversible and gated behind DELETE_RETURNS (never bundled
// with VERIFY_RETURNS) — a return otherwise stays on file permanently, so
// this is the only way it ever leaves the system. Typing the request ref
// back is the extra friction that fits "permanent delete," matching the
// weight of the action rather than a single misclick.
export function DeleteReturnButton({ returnId, requestRef }: { returnId: string; requestRef: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const canConfirm = confirmText.trim() === requestRef

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setConfirmText("")
          setError(null)
        }
      }}
    >
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" />
        Delete Permanently
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete request {requestRef}?</DialogTitle>
          <DialogDescription>
            This erases the request, every equipment item on it, its full audit trail, and related
            notifications. This cannot be undone (there is no recovery).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label htmlFor="confirm-ref" className="text-sm text-muted-foreground">
            Type <span className="font-medium text-foreground">{requestRef}</span> to confirm.
          </label>
          <Input
            id="confirm-ref"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm || pending}
            onClick={() => {
              setError(null)
              startTransition(async () => {
                const res = await deleteReturnAction(returnId)
                if ("error" in res) {
                  setError(res.error)
                  return
                }
                toast.success("Request deleted permanently.")
                setOpen(false)
                router.push("/dashboard")
                router.refresh()
              })
            }}
          >
            {pending ? "Deleting…" : "Delete Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
