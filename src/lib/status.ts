import type { EquipmentCondition, ReturnStatus } from "@prisma/client"

export type StatusTone = "danger" | "warning" | "success"

export const RETURN_STATUS_TONE: Record<ReturnStatus, StatusTone> = {
  DISCREPANCY: "danger",
  PENDING: "warning",
  VERIFIED: "success",
  RETURNED: "success",
  CLOSED: "success",
}

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  DISCREPANCY: "Discrepancy",
  RETURNED: "Returned",
  CLOSED: "Closed",
}

export const CONDITION_TONE: Record<EquipmentCondition, StatusTone> = {
  UNSERVICEABLE: "danger",
  UNDER_REPAIR: "warning",
  AWAITING_EVACUATION: "warning",
  SERVICEABLE: "success",
}

export const CONDITION_LABEL: Record<EquipmentCondition, string> = {
  SERVICEABLE: "Serviceable",
  UNSERVICEABLE: "Unserviceable",
  UNDER_REPAIR: "Under Repair",
  AWAITING_EVACUATION: "Awaiting Evacuation",
}

// The linear workflow a return moves through. DISCREPANCY is a side branch
// off PENDING/VERIFIED rather than a dead end — it can still be worked back
// toward VERIFIED once resolved.
export const RETURN_STATUS_FLOW: ReturnStatus[] = [
  "PENDING",
  "VERIFIED",
  "DISCREPANCY",
  "RETURNED",
  "CLOSED",
]
