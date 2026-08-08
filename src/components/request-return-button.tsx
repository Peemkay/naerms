"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
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
import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { requestReturnAction } from "@/lib/actions/return-requests"

const requestReturnSchema = z.object({
  requestRef: z.string().trim().min(1, "Reference is required"),
  message: z.string().trim().optional().or(z.literal("")),
})

export function RequestReturnButton({
  toFormationId,
  toFormationName,
}: {
  toFormationId: string
  toFormationName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

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
            They&apos;ll get a notification asking them to submit a return under this reference.
          </DialogDescription>
        </DialogHeader>
        <Form
          errors={errors}
          onFormSubmit={(values) => {
            setFormError(null)
            const result = requestReturnSchema.safeParse(values)
            if (!result.success) {
              setErrors(z.flattenError(result.error).fieldErrors as Record<string, string | string[]>)
              return
            }
            setErrors({})
            startTransition(async () => {
              const res = await requestReturnAction({ ...result.data, toFormationId })
              if ("error" in res) {
                setFormError(res.error)
                if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string | string[]>)
                return
              }
              toast.success("Request sent.")
              setOpen(false)
              router.refresh()
            })
          }}
          className="grid gap-4"
        >
          <Field name="requestRef">
            <FieldLabel>Request Ref</FieldLabel>
            <Input name="requestRef" placeholder="e.g. REQ/2026/014" autoFocus />
            <FieldError />
          </Field>
          <Field name="message">
            <FieldLabel>Message (optional)</FieldLabel>
            <Textarea name="message" rows={3} placeholder="What you need and by when" />
            <FieldError />
          </Field>
          {formError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send Request"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
