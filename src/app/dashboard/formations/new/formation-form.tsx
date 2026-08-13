"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"
import type { Privilege } from "@prisma/client"

import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FORMATION_ROLES, formationFormSchema } from "@/lib/validation/formation"
import { FORMATION_ROLE_LABEL } from "@/lib/formation-labels"
import { PRIVILEGE_DESCRIPTIONS, PRIVILEGE_LABELS } from "@/lib/privileges"
import { createFormationAction } from "@/lib/actions/formations"
import type { FormationPickerOption } from "@/lib/formation"

export function FormationForm({
  options,
  defaultParentId,
  assignablePrivileges,
}: {
  options: FormationPickerOption[]
  defaultParentId: string
  assignablePrivileges: Privilege[]
}) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [privileges, setPrivileges] = useState<Privilege[]>([])
  const [formKey, setFormKey] = useState(0)

  return (
    <Form
      key={formKey}
      errors={errors}
      onFormSubmit={(values) => {
        setFormError(null)
        const result = formationFormSchema.safeParse({ ...values, privileges })
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
          setPrivileges([])
          setFormKey((k) => k + 1)
          router.refresh()
        })
      }}
      className="grid gap-5"
    >
      <Field name="name">
        <FieldLabel>Formation/Unit Name</FieldLabel>
        <Input name="name" placeholder="e.g. 522 Signal Regiment" required />
        <FieldError />
      </Field>

      <Field name="parentId">
        <FieldLabel>Parent Formation</FieldLabel>
        <Select name="parentId" defaultValue={defaultParentId}>
          <SelectTrigger className="w-full">
            {/* Base UI hands the raw value to Value, so without this the
                trigger shows a cuid instead of the formation's name. */}
            <SelectValue placeholder="Select parent formation">
              {(value: string) => options.find((o) => o.id === value)?.path ?? "Select parent formation"}
            </SelectValue>
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
          Chain of command (this is who the new formation reports to, not an operational
          attachment). It can be changed later by dragging in the tree.
        </FieldDescription>
        <FieldError />
      </Field>

      {/* Role and attachment are optional descriptors, always offered rather
          than revealed by a type: there is no formation type any more, so
          nothing to key their visibility off. */}
      <Field name="role">
        <FieldLabel>Role (optional)</FieldLabel>
        <Select name="role">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No role" />
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

      <Field name="attachedTo">
        <FieldLabel>Attached To (optional)</FieldLabel>
        <Input name="attachedTo" placeholder="e.g. 4 Mechanised Infantry Brigade" />
        <FieldDescription>
          A (often non-Signals) formation this unit operationally supports. Kept separate from
          the chain of command above.
        </FieldDescription>
        <FieldError />
      </Field>

      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <Field name="email">
          <FieldLabel>Email (optional)</FieldLabel>
          <Input name="email" type="email" placeholder="email" />
          <FieldError />
        </Field>
        <Field name="password">
          <FieldLabel>Initial Password</FieldLabel>
          <Input name="password" type="password" placeholder="password" />
          <FieldDescription>Leave both blank to create the formation without a login yet.</FieldDescription>
          <FieldError />
        </Field>
      </div>

      {assignablePrivileges.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">Privileges</p>
          <p className="mb-3 text-xs text-muted-foreground">
            You can only grant privileges you hold yourself.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {assignablePrivileges.map((p) => (
              <label key={p} className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox
                  checked={privileges.includes(p)}
                  onCheckedChange={(checked) =>
                    setPrivileges((prev) => (checked ? [...prev, p] : prev.filter((x) => x !== p)))
                  }
                />
                <span>
                  <span className="font-medium">{PRIVILEGE_LABELS[p]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {PRIVILEGE_DESCRIPTIONS[p]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
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
