import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { EquipmentCondition, ReturnStatus } from "@prisma/client"

import type { FormationOverviewData } from "@/lib/formation-overview"
import { countByStatus, sumByCondition } from "@/lib/aggregate"
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
import { RequestReturnButton } from "@/components/request-return-button"
import { toReturnRow } from "@/lib/returns"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

const CONDITIONS = ["SERVICEABLE", "UNSERVICEABLE", "UNDER_REPAIR", "AWAITING_EVACUATION"] as const

const CONDITION_QTY_KEY = {
  SERVICEABLE: "serviceableQty",
  UNSERVICEABLE: "unserviceableQty",
  UNDER_REPAIR: "underRepairQty",
  AWAITING_EVACUATION: "awaitingEvacuationQty",
} as const

// Status and condition filter independently but combine (AND) when both are
// set, so clicking one card never silently drops the other's selection.
function buildFilterHref(
  basePath: string,
  filters: { status?: ReturnStatus; condition?: EquipmentCondition }
) {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.condition) params.set("condition", filters.condition)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function FormationOverview({
  formation,
  returnItems,
  basePath,
  filterStatus,
  filterCondition,
  canRequestReturn,
}: FormationOverviewData & {
  basePath: string
  filterStatus?: ReturnStatus
  filterCondition?: EquipmentCondition
  canRequestReturn?: boolean
}) {
  const statusCounts = countByStatus(returnItems)
  const conditionSums = sumByCondition(returnItems)

  // Condition is a per-item quantity breakdown, not a single value, so
  // "filter by condition" means "items with at least one unit in that
  // bucket" — applied here at the data level (and combined with status, so
  // the registry count reflects both filters together) rather than as a
  // table column filter. Status is additionally applied as a live column
  // filter inside ReturnsTable so the search/sort controls stay in sync.
  const visibleItems = returnItems.filter((item) => {
    if (filterCondition && item[CONDITION_QTY_KEY[filterCondition]] <= 0) return false
    if (filterStatus && item.status !== filterStatus) return false
    return true
  })

  const organicRegiments = formation.children.filter((c) => c.type === "SIGNAL_REGIMENT")
  const attachedSignals = formation.children.filter((c) => c.type === "BRIGADE_SIGNALS")
  const otherChildren = formation.children.filter(
    (c) => c.type !== "SIGNAL_REGIMENT" && c.type !== "BRIGADE_SIGNALS"
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        {canRequestReturn && <RequestReturnButton toFormationId={formation.id} toFormationName={formation.name} />}
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
          By Workflow Status — click a card to filter the registry below
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {RETURN_STATUS_FLOW.map((status) => (
            <StatTile
              key={status}
              label={RETURN_STATUS_LABEL[status]}
              value={statusCounts[status]}
              tone={RETURN_STATUS_TONE[status]}
              href={buildFilterHref(basePath, { status, condition: filterCondition })}
              active={filterStatus === status}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          By Equipment Condition — unit counts, click to filter
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CONDITIONS.map((condition) => (
            <StatTile
              key={condition}
              label={CONDITION_LABEL[condition]}
              value={conditionSums[condition]}
              tone={CONDITION_TONE[condition]}
              href={buildFilterHref(basePath, { status: filterStatus, condition })}
              active={filterCondition === condition}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Returns Registry ({visibleItems.length})
          </p>
          {(filterStatus || filterCondition) && (
            <Link href={basePath} className="text-xs text-primary hover:underline">
              Clear filter
            </Link>
          )}
        </div>
        <ReturnsTable data={visibleItems.map(toReturnRow)} initialStatus={filterStatus} />
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
                  href={`/dashboard/formations/${item.id}`}
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
