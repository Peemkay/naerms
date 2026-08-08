import { notFound } from "next/navigation"
import type { EquipmentCondition, ReturnStatus } from "@prisma/client"

import { requireSession } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { getFormationOverviewData } from "@/lib/formation-overview"
import { FormationOverview } from "@/components/formation-overview"

export default async function FormationDrilldownPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string; condition?: string }>
}) {
  const { id } = await params
  const { status, condition } = await searchParams
  const session = await requireSession()

  const visibleIds = await getVisibleFormationIds(session.user.id)
  if (!visibleIds.includes(id)) notFound()

  const data = await getFormationOverviewData(id)
  return (
    <FormationOverview
      {...data}
      basePath={`/dashboard/formations/${id}`}
      filterStatus={status as ReturnStatus | undefined}
      filterCondition={condition as EquipmentCondition | undefined}
      canRequestReturn={id !== session.user.id}
    />
  )
}
