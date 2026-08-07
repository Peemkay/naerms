import { redirect } from "next/navigation"

import { requireSession } from "@/lib/session"
import { homeRouteForRole } from "@/lib/roles"

export default async function RootPage() {
  const session = await requireSession()
  redirect(homeRouteForRole(session.user.role))
}
