import { requireRole } from "@/lib/session"
import { getFormationOptionsInScope } from "@/lib/formation"
import { ADMIN_ROLES, ROLE_LABELS, getAssignableRoles } from "@/lib/roles"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { UserForm } from "@/app/admin/users/user-form"

export default async function NewUserPage() {
  const session = await requireRole(ADMIN_ROLES)
  const formationOptions = await getFormationOptionsInScope(session.user.formationId)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Create Account</h1>
        <p className="text-sm text-muted-foreground">
          Grants login access to a formation within your scope.
        </p>
      </div>
      <Card>
        <CardHeader className="text-sm text-muted-foreground">
          You can assign roles up to your own level ({ROLE_LABELS[session.user.role]}).
        </CardHeader>
        <CardContent>
          <UserForm
            formationOptions={formationOptions}
            assignableRoles={getAssignableRoles(session.user.role)}
            defaultFormationId={session.user.formationId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
