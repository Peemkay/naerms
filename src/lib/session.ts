import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"

import { auth } from "@/lib/auth"

/** Server Component / Server Action guard: require a logged-in session. */
export async function requireSession() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return session
}

/** Same as `requireSession`, but also gates on an allowed role list. */
export async function requireRole(roles: Role[]) {
  const session = await requireSession()
  if (!roles.includes(session.user.role)) redirect("/portal")
  return session
}
