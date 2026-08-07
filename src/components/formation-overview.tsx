import Link from "next/link"
import { ChevronRight } from "lucide-react"

import type { FormationOverviewData } from "@/lib/formation-overview"
import { countByCondition, countByStatus } from "@/lib/aggregate"
import {
  CONDITION_LABEL,
  CONDITION_TONE,
  RETURN_STATUS_FLOW,
  RETURN_STATUS_LABEL,
  RETURN_STATUS_TONE,
} from "@/lib/status"
import { FORMATION_ROLE_LABEL, FORMATION_TYPE_TAG } from "@/lib/formation-labels"
import { StatTile } from "@/components/stat-tile"
import { ReturnsTable } from "@/components/returns-table"
import { toReturnRow } from "@/lib/returns"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

const CONDITIONS = ["SERVICEABLE", "UNSERVICEABLE", "UNDER_REPAIR", "AWAITING_EVACUATION"] as const

export function FormationOverview({ formation, returns }: FormationOverviewData) {
  const statusCounts = countByStatus(returns)
  const conditionCounts = countByCondition(returns)

  const organicRegiments = formation.children.filter((c) => c.type === "SIGNAL_REGIMENT")
  const attachedSignals = formation.children.filter((c) => c.type === "BRIGADE_SIGNALS")
  const otherChildren = formation.children.filter(
    (c) => c.type !== "SIGNAL_REGIMENT" && c.type !== "BRIGADE_SIGNALS"
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{formation.name}</h1>
          <span className="rounded border border-border px-1.5 py-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">
            {FORMATION_TYPE_TAG[formation.type]}
          </span>
          {formation.role && (
            <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {FORMATION_ROLE_LABEL[formation.role]}
            </span>
          )}
        </div>
        {formation.attachedTo && (
          <p className="mt-1 text-sm text-muted-foreground">
            Operationally supporting <span className="font-medium">{formation.attachedTo}</span>
          </p>
        )}
      </div>

      {formation.type === "SIGNAL_BRIGADE" && (organicRegiments.length > 0 || attachedSignals.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormationList
            title="Organic Regiments (SR)"
            description="Under this brigade's operational chain of command."
            items={organicRegiments}
          />
          <FormationList
            title="Attached Brigade Signals (BS)"
            description="NAS chain of command, operationally detached elsewhere."
            items={attachedSignals}
          />
        </div>
      )}

      {formation.type !== "SIGNAL_BRIGADE" && otherChildren.length > 0 && (
        <FormationList
          title="Subordinate Formations"
          description="Drill into any formation in your scope."
          items={otherChildren}
        />
      )}

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          By Workflow Status
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {RETURN_STATUS_FLOW.map((status) => (
            <StatTile
              key={status}
              label={RETURN_STATUS_LABEL[status]}
              value={statusCounts[status]}
              tone={RETURN_STATUS_TONE[status]}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          By Equipment Condition
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CONDITIONS.map((condition) => (
            <StatTile
              key={condition}
              label={CONDITION_LABEL[condition]}
              value={conditionCounts[condition]}
              tone={CONDITION_TONE[condition]}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Returns Registry ({returns.length})
        </p>
        <ReturnsTable data={returns.map(toReturnRow)} />
      </div>
    </div>
  )
}

function FormationList({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: FormationOverviewData["formation"]["children"]
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="pt-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/formations/${item.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span>{item.name}</span>
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
