"use server"

import { AuthError } from "next-auth"

import { signIn } from "@/lib/auth"
import { loginSchema } from "@/lib/validation/auth"

export async function authenticate(values: unknown) {
  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Enter a service ID and password." }
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/" })
  } catch (err) {
    // signIn() redirects on success by throwing a special NEXT_REDIRECT
    // error internally — only AuthError instances are real auth failures.
    if (err instanceof AuthError) {
      return { error: "Invalid service ID or password." }
    }
    throw err
  }
}
