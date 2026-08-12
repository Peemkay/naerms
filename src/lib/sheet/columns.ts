import type { EquipmentCondition, ReturnStatus } from "@prisma/client"

/**
 * The register's column layout, taken from Sheet2 of the unit's own
 * rtns.xlsx so the on-screen sheet reads exactly like the file it replaces.
 *
 * The first 15 columns are that sheet verbatim, in its order. The remaining
 * ones carry data the database tracks but the paper form folds into prose
 * (a line reading "32 X RF 5800 Btys" is quantity 32) — they are hidden by
 * default and can be switched on, rather than being dropped, because the
 * dashboard tallies and the printed condition breakdown are computed from
 * them.
 */

export type SheetColumnKind = "text" | "number" | "date" | "enum" | "computed"

export type SheetColumn = {
  key: string
  header: string
  kind: SheetColumnKind
  width: number
  /** Not on the paper sheet: hidden until the user opts in. */
  secondary?: boolean
  /** Never editable (derived or system-owned). */
  readOnly?: boolean
  options?: readonly string[]
}

/** Sheet2's "Status" column holds SVC/UNSVC, i.e. the physical condition. */
export const CONDITION_SHEET_LABEL: Record<EquipmentCondition, string> = {
  SERVICEABLE: "SVC",
  UNSERVICEABLE: "UNSVC",
  UNDER_REPAIR: "UNDER REPAIR",
  AWAITING_EVACUATION: "AWAITING EVAC",
}

export const CONDITION_FROM_SHEET_LABEL: Record<string, EquipmentCondition> = {
  SVC: "SERVICEABLE",
  SERVICEABLE: "SERVICEABLE",
  UNSVC: "UNSERVICEABLE",
  UNSERVICEABLE: "UNSERVICEABLE",
  "UNDER REPAIR": "UNDER_REPAIR",
  "AWAITING EVAC": "AWAITING_EVACUATION",
  "AWAITING EVACUATION": "AWAITING_EVACUATION",
}

export const WORKFLOW_OPTIONS = [
  "PENDING",
  "VERIFIED",
  "DISCREPANCY",
  "RETURNED",
  "CLOSED",
] as const satisfies readonly ReturnStatus[]

export const SHEET_COLUMNS: readonly SheetColumn[] = [
  // --- Sheet2, verbatim -------------------------------------------------
  { key: "serial", header: "Serial", kind: "computed", width: 60, readOnly: true },
  { key: "letterOfRequest", header: "Letter of Request", kind: "text", width: 140 },
  { key: "authority", header: "Authority", kind: "text", width: 140 },
  { key: "dateIssued", header: "Date Issued", kind: "date", width: 110 },
  // Editable free text, not the owning formation's name: on the real sheets
  // a register headed "51 SB" carries lines reading "NISIGS ESSMGB" — the
  // sub-unit or detachment the equipment went to, which is often not a
  // formation in the tree at all.
  { key: "fmnUnitIssued", header: "Fmn/Unit Issued", kind: "text", width: 150 },
  { key: "howDeployed", header: "How Depl", kind: "text", width: 120 },
  { key: "purposeOfIssue", header: "Purpose of Issue", kind: "text", width: 150 },
  { key: "equipmentName", header: "Eqpt Name", kind: "text", width: 220 },
  { key: "equipmentModel", header: "Eqpt Model", kind: "text", width: 150 },
  { key: "band", header: "Band", kind: "text", width: 90 },
  { key: "equipmentType", header: "Eqpt Type", kind: "text", width: 150 },
  { key: "equipmentSerial", header: "Eqpt Serial", kind: "text", width: 130 },
  { key: "origin", header: "Origin", kind: "text", width: 120 },
  {
    key: "condition",
    header: "Status",
    kind: "enum",
    width: 130,
    options: Object.values(CONDITION_SHEET_LABEL),
  },
  { key: "remarks", header: "Remarks", kind: "text", width: 200 },
] as const

export const SHEET_COLUMN_BY_KEY = new Map(SHEET_COLUMNS.map((c) => [c.key, c]))

// Cells stored against a column key that is no longer displayed (from the
// spare working columns the sheet used to carry). Kept as a predicate so
// old SheetCell rows are ignored rather than crashing a render.
export const isExtraColumn = (key: string) => key.startsWith("extra:")

/**
 * The sheet is exactly the register's own 15 columns, nothing more.
 *
 * There are deliberately no extra or hidden-by-default columns: this sheet
 * has to match the workbook the units already keep, both on screen and for
 * an imported file to line up against. Quantity and the per-condition
 * breakdown stay in the database (the dashboard tallies and the printed
 * condition text are computed from them) but are not columns here — on the
 * paper register that information lives in the equipment name
 * ("32 X RF 5800 Btys") and in this single Status column.
 */
export function allColumns(): SheetColumn[] {
  return [...SHEET_COLUMNS]
}

/** Spreadsheet-style reference (A1, B7) for the formula engine. */
export function columnLetter(index: number): string {
  let n = index + 1
  let letter = ""
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}
