import type { FormationRole } from "@prisma/client"

// Formation type was removed from the model: it forced a classification on
// every formation while changing nothing about how the system behaves.
// Position in the tree is the classification now. Role survives as an
// optional descriptor.
export const FORMATION_ROLE_LABEL: Record<FormationRole, string> = {
  OPERATIONAL: "Operational",
  SUPPORT: "Support",
  ATTACHED: "Attached",
}
