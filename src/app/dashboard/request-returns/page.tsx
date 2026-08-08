import { requireSession } from "@/lib/session"
import { getFormationOptionsInScope } from "@/lib/formation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { RequestReturnForm } from "./request-return-form"

export default async function RequestReturnsPage() {
  const session = await requireSession()
  const options = (await getFormationOptionsInScope(session.user.id)).filter(
    (o) => o.id !== session.user.id
  )

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Request Returns from Formations</h1>
        <p className="text-sm text-muted-foreground">
          Ask any formation under you — anywhere in your tree, not just direct subordinates — to
          submit a return. They and their own subordinates are notified; when they respond under
          the same Request Ref, you and everyone above you are notified back.
        </p>
      </div>
      <Card>
        <CardHeader className="text-sm text-muted-foreground">
          {options.length === 0
            ? "No formations under you yet."
            : "Pick who you're asking and the reference they should submit under."}
        </CardHeader>
        <CardContent>
          <RequestReturnForm options={options} />
        </CardContent>
      </Card>
    </div>
  )
}
