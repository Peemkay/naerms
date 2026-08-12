import { requireSession } from "@/lib/session"
import { getFormationOverviewData } from "@/lib/formation-overview"
import { getFormationOptionsInScope } from "@/lib/formation"
import { FormationOverview } from "@/components/formation-overview"
import type { EquipmentCondition, ReturnStatus } from "@prisma/client"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; condition?: string }>
}) {
  const session = await requireSession()
  const { status, condition } = await searchParams
  const data = await getFormationOverviewData(session.user.id)
  const canManageFormations = session.user.privileges.includes("MANAGE_FORMATIONS")
  const parentOptions = canManageFormations
    ? await getFormationOptionsInScope(session.user.id)
    : undefined

  return (
    <FormationOverview
      {...data}
      basePath="/dashboard"
      filterStatus={status as ReturnStatus | undefined}
      filterCondition={condition as EquipmentCondition | undefined}
      canManageFormations={canManageFormations}
      parentOptions={parentOptions}
    />
  )
}
