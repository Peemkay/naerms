import type { FormationRole, FormationType } from "@prisma/client"

export const FORMATION_TYPE_TAG: Record<FormationType, string> = {
  ROOT: "NAS",
  COMMAND: "COMD",
  SCHOOL: "SCHOOL",
  SIGNAL_BRIGADE: "BDE",
  SIGNAL_REGIMENT: "SR",
  BRIGADE_SIGNALS: "BS",
  UNIT: "UNIT",
}

export const FORMATION_ROLE_LABEL: Record<FormationRole, string> = {
  OPERATIONAL: "Operational",
  SUPPORT: "Support",
  ATTACHED: "Attached",
}

export const FORMATION_TYPE_LABEL: Record<FormationType, string> = {
  ROOT: "NAS (root)",
  COMMAND: "Command",
  SCHOOL: "School",
  SIGNAL_BRIGADE: "Signal Brigade",
  SIGNAL_REGIMENT: "Signal Regiment (SR)",
  BRIGADE_SIGNALS: "Brigade Signals (BS)",
  UNIT: "Unit",
}
