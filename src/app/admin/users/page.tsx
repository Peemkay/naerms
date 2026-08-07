import Link from "next/link"
import { Plus } from "lucide-react"

import { requireRole } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { getUsersForFormations } from "@/lib/users"
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UserActiveToggle } from "@/components/user-active-toggle"

export default async function UsersPage() {
  const session = await requireRole(ADMIN_ROLES)
  const visibleIds = await getVisibleFormationIds(session.user.formationId)
  const users = await getUsersForFormations(visibleIds)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Accounts within your formation scope ({users.length}).
          </p>
        </div>
        <Button
          render={
            <Link href="/admin/users/new">
              <Plus className="size-4" />
              Create Account
            </Link>
          }
        />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Service ID</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Formation</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className={user.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-2.5">
                    {user.rank ? `${user.rank} ` : ""}
                    {user.fullName}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{user.serviceId}</td>
                  <td className="px-4 py-2.5">{ROLE_LABELS[user.role]}</td>
                  <td className="px-4 py-2.5">{user.formation.name}</td>
                  <td className="px-4 py-2.5">{user.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <UserActiveToggle userId={user.id} isActive={user.isActive} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No users in your scope yet.
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
