import { requireRole } from "@/lib/session"
import { getFormationOverviewData } from "@/lib/formation-overview"
import { FormationOverview } from "@/components/formation-overview"
import { ADMIN_ROLES } from "@/lib/roles"

export default async function AdminPage() {
  const session = await requireRole(ADMIN_ROLES)
  const data = await getFormationOverviewData(session.user.formationId)
  return <FormationOverview {...data} />
}
