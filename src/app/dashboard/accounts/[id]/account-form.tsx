"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"

import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { accountFormSchema } from "@/lib/validation/formation"
import { setAccountAction } from "@/lib/actions/formations"

export function AccountForm({ formationId, currentEmail }: { formationId: string; currentEmail: string | null }) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Form
      errors={errors}
      onFormSubmit={(values) => {
        setFormError(null)
        const result = accountFormSchema.safeParse(values)
        if (!result.success) {
          setErrors(z.flattenError(result.error).fieldErrors as Record<string, string | string[]>)
          return
        }
        setErrors({})
        startTransition(async () => {
          const res = await setAccountAction(formationId, result.data)
          if ("error" in res) {
            setFormError(res.error)
            if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string | string[]>)
            return
          }
          toast.success(currentEmail ? "Password reset." : "Account created.")
          router.refresh()
        })
      }}
      className="grid gap-4"
    >
      <Field name="email">
        <FieldLabel>Email</FieldLabel>
        <Input name="email" type="email" defaultValue={currentEmail ?? ""} placeholder="email" />
        <FieldError />
      </Field>
      <Field name="password">
        <FieldLabel>{currentEmail ? "New Password" : "Password"}</FieldLabel>
        <Input name="password" type="password" placeholder="password" />
        <FieldDescription>At least 8 characters. Share it with the formation directly.</FieldDescription>
        <FieldError />
      </Field>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Saving…" : currentEmail ? "Reset Password" : "Create Account"}
      </Button>
    </Form>
  )
}
