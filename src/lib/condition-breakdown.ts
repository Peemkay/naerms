import type { EquipmentCondition } from "@prisma/client"
import { CONDITION_LABEL } from "@/lib/status"

export type QtyBreakdown = {
  quantity: number
  serviceableQty: number
  unserviceableQty: number
  underRepairQty: number
  awaitingEvacuationQty: number
}

const CONDITION_KEYS: [EquipmentCondition, keyof QtyBreakdown][] = [
  ["SERVICEABLE", "serviceableQty"],
  ["UNSERVICEABLE", "unserviceableQty"],
  ["UNDER_REPAIR", "underRepairQty"],
  ["AWAITING_EVACUATION", "awaitingEvacuationQty"],
]

/** Compact human summary, e.g. "5 Serviceable, 2 Under Repair". */
export function conditionBreakdownText(item: QtyBreakdown): string {
  const parts = CONDITION_KEYS.filter(([, key]) => item[key] > 0).map(
    ([condition, key]) => `${item[key]} ${CONDITION_LABEL[condition]}`
  )
  return parts.length > 0 ? parts.join(", ") : "N/A"
}

/** The condition holding the most units — used only to pick a badge tone. */
export function dominantCondition(item: QtyBreakdown): EquipmentCondition | null {
  let best: EquipmentCondition | null = null
  let bestQty = 0
  for (const [condition, key] of CONDITION_KEYS) {
    if (item[key] > bestQty) {
      best = condition
      bestQty = item[key]
    }
  }
  return best
}
