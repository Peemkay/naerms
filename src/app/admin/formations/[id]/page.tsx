import { notFound } from "next/navigation"

import { requireRole } from "@/lib/session"
import { getVisibleFormationIds } from "@/lib/scope"
import { getFormationOverviewData } from "@/lib/formation-overview"
import { FormationOverview } from "@/components/formation-overview"
import { ADMIN_ROLES } from "@/lib/roles"

export default async function FormationDrilldownPage({
  params,
}: PageProps<"/admin/formations/[id]">) {
  const { id } = await params
  const session = await requireRole(ADMIN_ROLES)

  const visibleIds = await getVisibleFormationIds(session.user.formationId)
  if (!visibleIds.includes(id)) notFound()

  const data = await getFormationOverviewData(id)
  return <FormationOverview {...data} />
}
