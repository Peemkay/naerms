import type { Privilege } from "@prisma/client"

// `as const satisfies` keeps this both a literal tuple (so z.enum() in
// validation/formation.ts can derive proper literal types from it) and
// checked against Privilege (so a typo here fails to compile).
export const ALL_PRIVILEGES = [
  "MANAGE_FORMATIONS",
  "MOVE_FORMATIONS",
  "MANAGE_ACCOUNTS",
  "MANAGE_PRIVILEGES",
  "VERIFY_RETURNS",
  "DELETE_RETURNS",
] as const satisfies readonly Privilege[]

export const PRIVILEGE_LABELS: Record<Privilege, string> = {
  MANAGE_FORMATIONS: "Manage formations",
  MOVE_FORMATIONS: "Move formations",
  MANAGE_ACCOUNTS: "Manage accounts",
  MANAGE_PRIVILEGES: "Assign privileges",
  VERIFY_RETURNS: "Verify returns",
  DELETE_RETURNS: "Delete returns",
}

export const PRIVILEGE_DESCRIPTIONS: Record<Privilege, string> = {
  MANAGE_FORMATIONS: "Create new formations/units in the tree",
  MOVE_FORMATIONS: "Drag formations to a new parent, or reorder them",
  MANAGE_ACCOUNTS: "Set up or reset another formation's login",
  MANAGE_PRIVILEGES: "Grant or revoke privileges on another formation",
  VERIFY_RETURNS: "Move a return item through the workflow (verify/flag/close/etc.)",
  DELETE_RETURNS: "Permanently erase a return (irreversible, kept separate from Verify)",
}

export function hasPrivilege(privileges: Privilege[], privilege: Privilege): boolean {
  return privileges.includes(privilege)
}

/**
 * A formation can only grant privileges it holds itself, and only if it
 * holds MANAGE_PRIVILEGES — never grant more power than you have.
 */
export function canGrant(granterPrivileges: Privilege[], toGrant: Privilege[]): boolean {
  if (!hasPrivilege(granterPrivileges, "MANAGE_PRIVILEGES")) return false
  return toGrant.every((p) => granterPrivileges.includes(p))
}
