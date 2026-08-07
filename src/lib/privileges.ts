import type { Privilege } from "@prisma/client"

export const ALL_PRIVILEGES: Privilege[] = [
  "MANAGE_FORMATIONS",
  "MANAGE_ACCOUNTS",
  "MANAGE_PRIVILEGES",
  "VERIFY_RETURNS",
]

export const PRIVILEGE_LABELS: Record<Privilege, string> = {
  MANAGE_FORMATIONS: "Manage formations",
  MANAGE_ACCOUNTS: "Manage accounts",
  MANAGE_PRIVILEGES: "Assign privileges",
  VERIFY_RETURNS: "Verify returns",
}

export const PRIVILEGE_DESCRIPTIONS: Record<Privilege, string> = {
  MANAGE_FORMATIONS: "Create new formations/units in the tree",
  MANAGE_ACCOUNTS: "Set up or reset another formation's login",
  MANAGE_PRIVILEGES: "Grant or revoke privileges on another formation",
  VERIFY_RETURNS: "Move a return item through the workflow (verify/flag/close/etc.)",
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
