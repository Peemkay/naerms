"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { requestReturnAction } from "@/lib/actions/return-requests"

/**
 * Asks one named formation for a return, from its own overview page.
 *
 * There are no fields left to fill in: the formation is implied by where
 * the button sits, and the reference is generated server-side. So this is a
 * confirm step rather than a form.
 */
export function RequestReturnButton({
  toFormationId,
  toFormationName,
}: {
  toFormationId: string
  toFormationName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function send() {
    setFormError(null)
    startTransition(async () => {
      const res = await requestReturnAction({ toFormationIds: [toFormationId] })
      if ("error" in res) {
        setFormError(res.error)
        return
      }
      toast.success("Request sent.")
      setOpen(false)
      // Straight to that formation's sheet, so the requester can see what
      // they already hold while waiting for the response.
      router.push(`/dashboard/sheet?formation=${toFormationId}`)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Send className="size-3.5" />
        Request Return
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a return from {toFormationName}</DialogTitle>
          <DialogDescription>
            They (and their own subordinates) will be notified to submit a return. A reference is
            generated automatically for both sides to quote.
          </DialogDescription>
        </DialogHeader>
        {formError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formError}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={pending}>
            {pending ? "Sending…" : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
