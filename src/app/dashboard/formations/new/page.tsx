import { requirePrivilege } from "@/lib/session"
import { getFormationPickerOptions } from "@/lib/formation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FormationForm } from "./formation-form"

export default async function NewFormationPage() {
  const session = await requirePrivilege("MANAGE_FORMATIONS")
  const options = await getFormationPickerOptions()

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Add Formation</h1>
        <p className="text-sm text-muted-foreground">
          Register a new unit, regiment, or brigade. It becomes available everywhere
          formations are listed immediately.
        </p>
      </div>
      <Card>
        <CardHeader className="text-sm text-muted-foreground">
          Only the name and the parent are required. Role and attachment are optional
          descriptors, and the parent can be changed later by dragging in the tree.
        </CardHeader>
        <CardContent>
          <FormationForm
            options={options}
            defaultParentId={session.user.id}
            assignablePrivileges={session.user.privileges}
          />
        </CardContent>
      </Card>
    </div>
  )
}
