import { redirect } from "next/navigation"

import { requireSession } from "@/lib/session"

export default async function RootPage() {
  await requireSession()
  redirect("/dashboard")
}
