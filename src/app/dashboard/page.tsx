import { requireSession } from "@/lib/session"
import { getFormationOverviewData } from "@/lib/formation-overview"
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

  return (
    <FormationOverview
      {...data}
      basePath="/dashboard"
      filterStatus={status as ReturnStatus | undefined}
      filterCondition={condition as EquipmentCondition | undefined}
    />
  )
}
