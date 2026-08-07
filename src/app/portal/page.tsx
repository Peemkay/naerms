import Link from "next/link"
import { Plus } from "lucide-react"

import { requireSession } from "@/lib/session"
import { getVisibleReturns, toReturnRow } from "@/lib/returns"
import { countByStatus } from "@/lib/aggregate"
import { RETURN_STATUS_FLOW, RETURN_STATUS_LABEL, RETURN_STATUS_TONE } from "@/lib/status"
import { StatTile } from "@/components/stat-tile"
import { ReturnsTable } from "@/components/returns-table"
import { Button } from "@/components/ui/button"

export default async function PortalPage() {
  const session = await requireSession()
  const returns = await getVisibleReturns(session.user.formationId)
  const counts = countByStatus(returns)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{session.user.formationName}</h1>
          <p className="text-sm text-muted-foreground">
            Equipment returns submitted by your formation.
          </p>
        </div>
        <Button
          render={
            <Link href="/portal/new">
              <Plus className="size-4" />
              New Return
            </Link>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {RETURN_STATUS_FLOW.map((status) => (
          <StatTile
            key={status}
            label={RETURN_STATUS_LABEL[status]}
            value={counts[status]}
            tone={RETURN_STATUS_TONE[status]}
          />
        ))}
      </div>

      <ReturnsTable data={returns.map(toReturnRow)} />
    </div>
  )
}
