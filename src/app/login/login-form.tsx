"use client"

import { useState, useTransition } from "react"
import { z } from "zod"

import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { loginSchema } from "@/lib/validation/auth"
import { authenticate } from "./actions"

export function LoginForm() {
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Form
      errors={errors}
      onFormSubmit={(values) => {
        setFormError(null)
        const result = loginSchema.safeParse(values)
        if (!result.success) {
          setErrors(z.flattenError(result.error).fieldErrors as Record<string, string | string[]>)
          return
        }
        setErrors({})
        startTransition(async () => {
          const res = await authenticate(result.data)
          if (res?.error) setFormError(res.error)
        })
      }}
    >
      <Field name="email">
        <FieldLabel>Email</FieldLabel>
        <Input
          name="email"
          type="email"
          placeholder="email"
          autoComplete="username"
          autoFocus
        />
        <FieldError />
      </Field>
      <Field name="password">
        <FieldLabel>Password</FieldLabel>
        <Input name="password" type="password" autoComplete="current-password" />
        <FieldError />
      </Field>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </Form>
  )
}
