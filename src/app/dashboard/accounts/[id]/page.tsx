import { notFound, redirect } from "next/navigation"

import { requireSession } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { AccountActiveToggle } from "@/components/account-active-toggle"
import { DeleteFormationButton } from "@/components/delete-formation-button"
import { AccountForm } from "./account-form"
import { PrivilegesForm } from "./privileges-form"

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const canManageAccounts = session.user.privileges.includes("MANAGE_ACCOUNTS")
  const canManagePrivileges = session.user.privileges.includes("MANAGE_PRIVILEGES")
  const canManageFormations = session.user.privileges.includes("MANAGE_FORMATIONS")
  if (!canManageAccounts && !canManagePrivileges && !canManageFormations) redirect("/dashboard")

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(id)) notFound()

  const formation = await prisma.formation.findUnique({ where: { id } })
  if (!formation) notFound()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">{formation.name}</h1>
        <p className="text-sm text-muted-foreground">Manage this formation&apos;s account.</p>
      </div>

      {canManageAccounts && (
        <Card>
          <CardHeader className="text-sm font-medium">
            {formation.email ? "Account" : "Set Up Account"}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AccountForm formationId={formation.id} currentEmail={formation.email} />
            {formation.email && formation.id !== session.user.id && (
              <div className="border-t border-border pt-4">
                <AccountActiveToggle formationId={formation.id} isActive={formation.isActive} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canManagePrivileges && (
        <Card>
          <CardHeader className="text-sm font-medium">Privileges</CardHeader>
          <CardContent>
            <PrivilegesForm
              formationId={formation.id}
              assignablePrivileges={session.user.privileges}
              currentPrivileges={formation.privileges}
            />
          </CardContent>
        </Card>
      )}

      {canManageFormations && formation.id !== session.user.id && formation.type !== "ROOT" && (
        <Card className="border-destructive/30">
          <CardHeader className="text-sm font-medium text-destructive">Danger Zone</CardHeader>
          <CardContent>
            <DeleteFormationButton formationId={formation.id} formationName={formation.name} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
