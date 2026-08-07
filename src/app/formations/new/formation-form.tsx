"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"

import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CREATABLE_FORMATION_TYPES,
  FORMATION_ROLES,
  formationFormSchema,
} from "@/lib/validation/formation"
import { FORMATION_ROLE_LABEL, FORMATION_TYPE_LABEL } from "@/lib/formation-labels"
import { createFormationAction } from "@/lib/actions/formations"
import type { FormationPickerOption } from "@/lib/formation"

export function FormationForm({
  options,
  defaultParentId,
}: {
  options: FormationPickerOption[]
  defaultParentId: string
}) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<string | undefined>(undefined)
  const [formKey, setFormKey] = useState(0)

  return (
    <Form
      key={formKey}
      errors={errors}
      onFormSubmit={(values) => {
        setFormError(null)
        const result = formationFormSchema.safeParse(values)
        if (!result.success) {
          setErrors(z.flattenError(result.error).fieldErrors as Record<string, string | string[]>)
          return
        }
        setErrors({})
        startTransition(async () => {
          const res = await createFormationAction(result.data)
          if ("error" in res) {
            setFormError(res.error)
            if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string | string[]>)
            return
          }
          toast.success(`"${result.data.name}" added to the formation tree.`)
          setType(undefined)
          setFormKey((k) => k + 1)
          router.refresh()
        })
      }}
      className="grid gap-5"
    >
      <Field name="name">
        <FieldLabel>Formation Name</FieldLabel>
        <Input name="name" placeholder="e.g. 522 Signal Regiment" required />
        <FieldError />
      </Field>

      <Field name="type">
        <FieldLabel>Type</FieldLabel>
        <Select name="type" onValueChange={(v) => setType(v as string)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select formation type" />
          </SelectTrigger>
          <SelectContent>
            {CREATABLE_FORMATION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {FORMATION_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError />
      </Field>

      <Field name="parentId">
        <FieldLabel>Parent Formation</FieldLabel>
        <Select name="parentId" defaultValue={defaultParentId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select parent formation" />
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
          Chain of command — this is who the new formation reports to, not an operational
          attachment.
        </FieldDescription>
        <FieldError />
      </Field>

      {(type === "SIGNAL_REGIMENT" || type === "BRIGADE_SIGNALS") && (
        <Field name="role">
          <FieldLabel>Role</FieldLabel>
          <Select name="role">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {FORMATION_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {FORMATION_ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError />
        </Field>
      )}

      {type === "BRIGADE_SIGNALS" && (
        <Field name="attachedTo">
          <FieldLabel>Attached To</FieldLabel>
          <Input name="attachedTo" placeholder="e.g. 4 Mechanised Infantry Brigade" />
          <FieldDescription>
            The (often non-Signals) corps brigade this unit operationally supports. Kept
            separate from the chain of command above.
          </FieldDescription>
          <FieldError />
        </Field>
      )}

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add Formation"}
        </Button>
      </div>
    </Form>
  )
}
