import { requireSession } from "@/lib/session"
import { getDefaultOriginForFormation } from "@/lib/formation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ReturnForm } from "./return-form"

export default async function NewReturnPage() {
  const session = await requireSession()
  const defaultOrigin = await getDefaultOriginForFormation(session.user.id)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">New Return</h1>
        <p className="text-sm text-muted-foreground">
          Submitting on behalf of {session.user.name}. Add as many equipment items as this
          request covers.
        </p>
      </div>
      <Card>
        <CardHeader className="text-sm text-muted-foreground">
          Fields map to the Sigs returns register — Fmn/Unit is filled in automatically from
          your session.
        </CardHeader>
        <CardContent>
          <ReturnForm mode="create" defaultOrigin={defaultOrigin} />
        </CardContent>
      </Card>
    </div>
  )
}
