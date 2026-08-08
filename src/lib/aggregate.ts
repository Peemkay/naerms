import type { EquipmentCondition, ReturnStatus } from "@prisma/client"
import { RETURN_STATUS_FLOW } from "@/lib/status"
import type { QtyBreakdown } from "@/lib/condition-breakdown"

const CONDITIONS: EquipmentCondition[] = [
  "SERVICEABLE",
  "UNSERVICEABLE",
  "UNDER_REPAIR",
  "AWAITING_EVACUATION",
]

export function countByStatus<T extends { status: ReturnStatus }>(
  rows: T[]
): Record<ReturnStatus, number> {
  const counts = Object.fromEntries(RETURN_STATUS_FLOW.map((s) => [s, 0])) as Record<
    ReturnStatus,
    number
  >
  for (const row of rows) counts[row.status]++
  return counts
}

/** Sums *units* per condition bucket, not item rows — one row can hold several units across conditions. */
export function sumByCondition<T extends QtyBreakdown>(rows: T[]): Record<EquipmentCondition, number> {
  const sums = Object.fromEntries(CONDITIONS.map((c) => [c, 0])) as Record<EquipmentCondition, number>
  for (const row of rows) {
    sums.SERVICEABLE += row.serviceableQty
    sums.UNSERVICEABLE += row.unserviceableQty
    sums.UNDER_REPAIR += row.underRepairQty
    sums.AWAITING_EVACUATION += row.awaitingEvacuationQty
  }
  return sums
}
