"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"

import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { requestReturnAction } from "@/lib/actions/return-requests"
import type { FormationPickerOption } from "@/lib/formation"

const requestReturnSchema = z.object({
  toFormationId: z.string().trim().min(1, "Pick who you're asking"),
  requestRef: z.string().trim().min(1, "Reference is required"),
  message: z.string().trim().optional().or(z.literal("")),
})

export function RequestReturnForm({ options }: { options: FormationPickerOption[] }) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [formKey, setFormKey] = useState(0)

  return (
    <Form
      key={formKey}
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
          const res = await requestReturnAction(result.data)
          if ("error" in res) {
            setFormError(res.error)
            if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string | string[]>)
            return
          }
          toast.success("Request sent.")
          setFormKey((k) => k + 1)
          router.refresh()
        })
      }}
      className="grid gap-4"
    >
      <Field name="toFormationId">
        <FieldLabel>Request From</FieldLabel>
        <Select name="toFormationId">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a formation under you" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          Any formation under you, anywhere in your tree (not just direct subordinates).
        </FieldDescription>
        <FieldError />
      </Field>
      <Field name="requestRef">
        <FieldLabel>Request Ref</FieldLabel>
        <Input name="requestRef" placeholder="e.g. REQ/2026/014" />
        <FieldDescription>They (and you) will use this same reference to link the response back.</FieldDescription>
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
      <Button type="submit" disabled={pending || options.length === 0}>
        {pending ? "Sending…" : "Send Request"}
      </Button>
    </Form>
  )
}
