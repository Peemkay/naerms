import { requireSession } from "@/lib/session"
import { getGroupedFormationsInScope } from "@/lib/formation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { RequestReturnForm } from "./request-return-form"

export default async function RequestReturnsPage() {
  const session = await requireSession()
  // You can't ask yourself, so drop your own formation from every block and
  // then any block that leaves empty.
  const groups = (await getGroupedFormationsInScope(session.user.id))
    .map((group) => ({
      ...group,
      members: group.members.filter((m) => m.id !== session.user.id),
    }))
    .filter((group) => group.members.length > 0)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Request Returns from Formations</h1>
        <p className="text-sm text-muted-foreground">
          Ask any formation under you (anywhere in your tree, not just direct subordinates) to
          submit a return. They and their own subordinates are notified; when they respond under
          the same Request Ref, you and everyone above you are notified back.
        </p>
      </div>
      <Card>
        <CardHeader className="text-sm text-muted-foreground">
          {groups.length === 0
            ? "No formations under you yet."
            : "Pick who you're asking. A reference is generated automatically."}
        </CardHeader>
        <CardContent>
          <RequestReturnForm groups={groups} />
        </CardContent>
      </Card>
    </div>
  )
}
