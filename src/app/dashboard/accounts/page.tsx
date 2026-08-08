import Link from "next/link"
import type { Privilege } from "@prisma/client"

import { requireSession } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { prisma } from "@/lib/prisma"
import { PRIVILEGE_LABELS } from "@/lib/privileges"
import { Card, CardContent } from "@/components/ui/card"
import { redirect } from "next/navigation"

// Any one of the three formation-related privileges earns a look at this
// list — previously only MANAGE_ACCOUNTS/MANAGE_PRIVILEGES could see it,
// which meant a formation holding only MANAGE_FORMATIONS (create formations)
// had no way to actually see what it had created, let alone delete one.
const FORMATION_LIST_PRIVILEGES: Privilege[] = ["MANAGE_ACCOUNTS", "MANAGE_PRIVILEGES", "MANAGE_FORMATIONS"]

export default async function AccountsPage() {
  const session = await requireSession()
  const canViewList = FORMATION_LIST_PRIVILEGES.some((p) => session.user.privileges.includes(p))
  if (!canViewList) redirect("/dashboard")

  const visibleIds = await getVisibleFormationIds(session.user.id)
  const formations = await prisma.formation.findMany({
    where: { id: { in: visibleIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, isActive: true, privileges: true },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Formations within your scope ({formations.length}). Set up logins, reset passwords,
          assign privileges, or delete a formation that&apos;s no longer needed.
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Formation</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Privileges</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {formations.map((f) => (
                <tr key={f.id} className={f.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-2.5 font-medium">{f.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {f.email ?? <span className="italic">No account</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {!f.email ? "—" : f.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {f.privileges.length > 0
                      ? f.privileges.map((p) => PRIVILEGE_LABELS[p]).join(", ")
                      : "None"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/dashboard/accounts/${f.id}`} className="text-sm font-medium text-primary hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {formations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No formations in your scope yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
