import { requireSession } from "@/lib/session"
import { getFormationPickerOptions } from "@/lib/formation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FormationForm } from "./formation-form"

export default async function NewFormationPage() {
  const session = await requireSession()
  const options = await getFormationPickerOptions()

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold">Add Formation</h1>
          <p className="text-sm text-muted-foreground">
            Register a new unit, regiment, or brigade. It becomes available everywhere
            formations are listed immediately — no restart needed.
          </p>
        </div>
        <Card>
          <CardHeader className="text-sm text-muted-foreground">
            Any signed-in user can add a formation. Chain of command (parent) is required;
            role and attachment only apply to Signal Regiments and Brigade Signals units.
          </CardHeader>
          <CardContent>
            <FormationForm options={options} defaultParentId={session.user.formationId} />
          </CardContent>
        </Card>
      </main>
    </AppShell>
  )
}
