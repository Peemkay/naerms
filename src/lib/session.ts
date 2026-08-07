import { redirect } from "next/navigation"
import type { Privilege } from "@prisma/client"

import { auth } from "@/lib/auth"

/** Server Component / Server Action guard: require a logged-in formation. */
export async function requireSession() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return session
}

/** Same as `requireSession`, but also gates on holding a privilege. */
export async function requirePrivilege(privilege: Privilege) {
  const session = await requireSession()
  if (!session.user.privileges.includes(privilege)) redirect("/")
  return session
}
