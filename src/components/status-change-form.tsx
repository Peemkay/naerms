"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ReturnStatus } from "@prisma/client"

import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RETURN_STATUS_FLOW, RETURN_STATUS_LABEL } from "@/lib/status"
import { changeStatusAction } from "@/lib/actions/returns"

export function StatusChangeForm({
  returnId,
  currentStatus,
}: {
  returnId: string
  currentStatus: ReturnStatus
}) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Form
      errors={errors}
      onFormSubmit={(values) => {
        setFormError(null)
        startTransition(async () => {
          const res = await changeStatusAction({ returnId, ...values })
          if ("error" in res) {
            setFormError(res.error)
            if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string | string[]>)
            return
          }
          toast.success("Status updated.")
          router.refresh()
        })
      }}
      className="grid gap-3"
    >
      <Field name="toStatus">
        <FieldLabel>New status</FieldLabel>
        <Select name="toStatus" defaultValue={currentStatus}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {RETURN_STATUS_FLOW.map((status) => (
              <SelectItem key={status} value={status}>
                {RETURN_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError />
      </Field>
      <Field name="note">
        <FieldLabel>Note (optional)</FieldLabel>
        <Textarea name="note" rows={2} placeholder="Reason, reference, or context for this change" />
        <FieldError />
      </Field>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Updating…" : "Update Status"}
      </Button>
    </Form>
  )
}
