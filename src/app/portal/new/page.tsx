import { requireSession } from "@/lib/session"
import { getDefaultOriginForFormation } from "@/lib/formation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ReturnForm } from "@/app/portal/return-form"

export default async function NewReturnPage() {
  const session = await requireSession()
  const defaultOrigin = await getDefaultOriginForFormation(session.user.formationId)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">New Return</h1>
        <p className="text-sm text-muted-foreground">
          Submitting on behalf of {session.user.formationName}.
        </p>
      </div>
      <Card>
        <CardHeader className="text-sm text-muted-foreground">
          Fields map directly to the Sigs returns register — Serial and Fmn/Unit are
          filled in automatically from your session.
        </CardHeader>
        <CardContent>
          <ReturnForm mode="create" defaultOrigin={defaultOrigin} />
        </CardContent>
      </Card>
    </div>
  )
}
