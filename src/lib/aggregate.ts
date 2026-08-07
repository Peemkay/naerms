import type { EquipmentCondition, ReturnStatus } from "@prisma/client"
import { RETURN_STATUS_FLOW } from "@/lib/status"

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

export function countByCondition<T extends { condition: EquipmentCondition | null }>(
  rows: T[]
): Record<EquipmentCondition, number> {
  const counts = Object.fromEntries(CONDITIONS.map((c) => [c, 0])) as Record<
    EquipmentCondition,
    number
  >
  for (const row of rows) if (row.condition) counts[row.condition]++
  return counts
}
