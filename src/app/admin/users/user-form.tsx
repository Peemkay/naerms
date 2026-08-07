"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"
import type { Role } from "@prisma/client"

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
import { userFormSchema } from "@/lib/validation/user"
import { ROLE_LABELS } from "@/lib/roles"
import { createUserAction } from "@/lib/actions/users"
import type { FormationPickerOption } from "@/lib/formation"

export function UserForm({
  formationOptions,
  assignableRoles,
  defaultFormationId,
}: {
  formationOptions: FormationPickerOption[]
  assignableRoles: Role[]
  defaultFormationId: string
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
        const result = userFormSchema.safeParse(values)
        if (!result.success) {
          setErrors(z.flattenError(result.error).fieldErrors as Record<string, string | string[]>)
          return
        }
        setErrors({})
        startTransition(async () => {
          const res = await createUserAction(result.data)
          if ("error" in res) {
            setFormError(res.error)
            if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string | string[]>)
            return
          }
          toast.success(`Account created for ${result.data.fullName}.`)
          router.push("/admin/users")
          router.refresh()
        })
      }}
      className="grid gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="serviceId">
          <FieldLabel>Service ID</FieldLabel>
          <Input name="serviceId" placeholder="NA/00000" required />
          <FieldError />
        </Field>
        <Field name="fullName">
          <FieldLabel>Full Name</FieldLabel>
          <Input name="fullName" required />
          <FieldError />
        </Field>
        <Field name="rank">
          <FieldLabel>Rank</FieldLabel>
          <Input name="rank" placeholder="e.g. Sgt" />
          <FieldError />
        </Field>
        <Field name="role">
          <FieldLabel>Role</FieldLabel>
          <Select name="role">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError />
        </Field>
      </div>

      <Field name="formationId">
        <FieldLabel>Formation</FieldLabel>
        <Select name="formationId" defaultValue={defaultFormationId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select formation" />
          </SelectTrigger>
          <SelectContent>
            {formationOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>Restricted to formations within your own scope.</FieldDescription>
        <FieldError />
      </Field>

      <Field name="password">
        <FieldLabel>Temporary Password</FieldLabel>
        <Input name="password" type="password" required />
        <FieldDescription>At least 8 characters. Share this with the user directly.</FieldDescription>
        <FieldError />
      </Field>

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create Account"}
        </Button>
      </div>
    </Form>
  )
}
