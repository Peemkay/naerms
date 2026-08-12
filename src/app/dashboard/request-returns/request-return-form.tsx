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
import { requestReturnAction } from "@/lib/actions/return-requests"
import type { FormationPickerOption } from "@/lib/formation"

const requestReturnSchema = z.object({
  toFormationIds: z.array(z.string()).min(1, "Pick at least one formation"),
  requestRef: z.string().trim().min(1, "Reference is required"),
  message: z.string().trim().optional().or(z.literal("")),
})

export function RequestReturnForm({ options }: { options: FormationPickerOption[] }) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [formKey, setFormKey] = useState(0)
  const [selected, setSelected] = useState<string[]>([])

  const allSelected = options.length > 0 && selected.length === options.length

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <Form
      key={formKey}
      errors={errors}
      onFormSubmit={(values) => {
        setFormError(null)
        const result = requestReturnSchema.safeParse({ ...values, toFormationIds: selected })
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
          toast.success(
            selected.length === 1 ? "Request sent." : `Request sent to ${selected.length} formations.`
          )
          setSelected([])
          setFormKey((k) => k + 1)
          router.refresh()
        })
      }}
      className="grid gap-4"
    >
      <Field name="toFormationIds">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel>Request From</FieldLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={options.length === 0}
            onClick={() => setSelected(allSelected ? [] : options.map((o) => o.id))}
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        </div>
        {/* A scrolling checklist rather than a multi-select dropdown: the
            list is a full chain-of-command path per row, which a native
            multi-select truncates badly, and "ask everyone under me" needs
            to be one click. */}
        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {options.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No formations under you to request from.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {options.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                      checked={selected.includes(o.id)}
                      onChange={() => toggle(o.id)}
                    />
                    <span className="min-w-0 text-sm">{o.path}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FieldDescription>
          Any formation under you, anywhere in your tree (not just direct subordinates). Pick as
          many as you need. {selected.length > 0 && `${selected.length} selected.`}
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
      <Button type="submit" disabled={pending || options.length === 0 || selected.length === 0}>
        {pending
          ? "Sending…"
          : selected.length > 1
            ? `Send Request to ${selected.length} Formations`
            : "Send Request"}
      </Button>
    </Form>
  )
}
