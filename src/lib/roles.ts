import type { Role } from "@prisma/client"

// The five roles collapse into two UI tiers. Portal is where returns get
// submitted and tracked at unit/regiment level; Admin is the rollup/oversight
// dashboard for brigade and above. Keep this list as the single source of
// truth — middleware and page guards both read from it.
export const ADMIN_ROLES: Role[] = ["BRIGADE_ADMIN", "COMMAND_ADMIN", "NAS_ADMIN"]
export const PORTAL_ROLES: Role[] = ["UNIT_CLERK", "REGIMENT_OFFICER"]

export function isAdminTier(role: Role): boolean {
  return ADMIN_ROLES.includes(role)
}

export function homeRouteForRole(role: Role): string {
  return isAdminTier(role) ? "/admin" : "/portal"
}

// Roles allowed to move a return through the workflow (verify / flag /
// mark returned / close). Unit clerks may submit and edit but not
// self-verify — verification always comes from the next level up.
export const STATUS_CHANGE_ROLES: Role[] = [
  "REGIMENT_OFFICER",
  "BRIGADE_ADMIN",
  "COMMAND_ADMIN",
  "NAS_ADMIN",
]

export function canChangeStatus(role: Role): boolean {
  return STATUS_CHANGE_ROLES.includes(role)
}

export const ROLE_LABELS: Record<Role, string> = {
  UNIT_CLERK: "Unit Clerk",
  REGIMENT_OFFICER: "Regiment Officer",
  BRIGADE_ADMIN: "Brigade Admin",
  COMMAND_ADMIN: "Command Admin",
  NAS_ADMIN: "NAS Admin",
}

// A ranked order so "can assign at or below my own level" is one comparison,
// not a hand-maintained table per role.
const ROLE_RANK: Record<Role, number> = {
  UNIT_CLERK: 0,
  REGIMENT_OFFICER: 1,
  BRIGADE_ADMIN: 2,
  COMMAND_ADMIN: 3,
  NAS_ADMIN: 4,
}

/** Roles an admin is allowed to hand out — never higher than their own, to block privilege escalation. */
export function getAssignableRoles(actorRole: Role): Role[] {
  return (Object.keys(ROLE_RANK) as Role[]).filter((r) => ROLE_RANK[r] <= ROLE_RANK[actorRole])
}
