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
import { deleteFormationAction } from "@/lib/actions/formations"

// Only ever succeeds for a genuinely unused formation — the action itself
// blocks (with a specific reason) anything with subordinates, returns,
// audit history, or return requests attached. Typing the name back is the
// same "weight the friction to the action" pattern as DeleteReturnButton.
export function DeleteFormationButton({ formationId, formationName }: { formationId: string; formationName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const canConfirm = confirmText.trim() === formationName

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
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" />
        Delete Formation
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete {formationName}?</DialogTitle>
          <DialogDescription>
            Only possible if it has no subordinate formations, no returns on file, no status-change
            history, and no return requests. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label htmlFor="confirm-name" className="text-sm text-muted-foreground">
            Type <span className="font-medium text-foreground">{formationName}</span> to confirm.
          </label>
          <Input
            id="confirm-name"
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
                const res = await deleteFormationAction(formationId)
                if ("error" in res) {
                  setError(res.error)
                  return
                }
                toast.success("Formation deleted permanently.")
                setOpen(false)
                router.push("/dashboard/accounts")
                router.refresh()
              })
            }}
          >
            {pending ? "Deleting…" : "Delete Formation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
