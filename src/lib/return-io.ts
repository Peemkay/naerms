import type { ReturnItemDraft } from "@/lib/validation/return"

/**
 * The one place the register's column layout is defined. Import and export,
 * CSV and Excel, all read it from here — so a spreadsheet exported from
 * NAERMS can be edited and imported straight back without the two sides
 * drifting apart.
 *
 * Header text matches the printed register sheet, since the people filling
 * these in are working from the paper form.
 */
export const IO_COLUMNS = [
  { header: "Serial", key: "lineNo" },
  { header: "Letter of Request", key: "letterOfRequest" },
  { header: "Authority", key: "authority" },
  { header: "Date Issued", key: "dateIssued" },
  { header: "Fmn/Unit Issued", key: "fmnUnitIssued" },
  { header: "How Depl", key: "howDeployed" },
  { header: "Purpose of Issue", key: "purposeOfIssue" },
  { header: "Eqpt Name", key: "equipmentName" },
  { header: "Eqpt Model", key: "equipmentModel" },
  { header: "Band", key: "band" },
  { header: "Eqpt Type", key: "equipmentType" },
  { header: "Eqpt Serial", key: "equipmentSerial" },
  { header: "Origin", key: "origin" },
  // The register's single condition column. SVC/UNSVC/etc, not the
  // workflow state, and not a four-way quantity breakdown.
  { header: "Status", key: "condition" },
  { header: "Remarks", key: "remarks" },
] as const

export type IoColumnKey = (typeof IO_COLUMNS)[number]["key"]

/** Header row, also used as the downloadable blank template. */
export const IO_HEADERS = IO_COLUMNS.map((c) => c.header)

const NUMERIC_KEYS = new Set<string>(["lineNo"])

/**
 * Leading multiplier in an equipment name: "32 X RF 5800 Btys" -> 32.
 *
 * The register writes quantity into the name rather than a column of its
 * own, so this is where a line's count comes from on import. Returns 1 when
 * there's no multiplier, which is what a bare name means.
 */
export function quantityFromName(name: string): number {
  const match = /^\s*(\d+)\s*[xX×]\s+/.exec(name)
  if (!match) return 1
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1
}

/** Sheet Status text -> the condition bucket it fills. */
const CONDITION_BY_LABEL: Record<string, "svc" | "unsvc" | "repair" | "evac"> = {
  SVC: "svc",
  SERVICEABLE: "svc",
  UNSVC: "unsvc",
  UNSERVICEABLE: "unsvc",
  "UNDER REPAIR": "repair",
  REPAIR: "repair",
  "AWAITING EVAC": "evac",
  "AWAITING EVACUATION": "evac",
}

/** Normalises a header for matching: case, spacing and punctuation agnostic. */
function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Header spellings seen in the units' own workbooks, beyond the canonical
 * ones above. The real files carry "Issuied" for "Issued", a doubled space
 * in "Letter of  Request", and older sheets name some columns differently
 * ("Equipment" for "Eqpt Name"). Matching is already case- and
 * punctuation-insensitive, so only genuinely different words need listing.
 */
const HEADER_ALIASES: Record<string, string> = {
  ser: "lineNo",
  serialno: "lineNo",
  sn: "lineNo",
  equipment: "equipmentName",
  equipmentitem: "equipmentName",
  eqpt: "equipmentName",
  eqptname: "equipmentName",
  equipmentname: "equipmentName",
  model: "equipmentModel",
  equipmentmodel: "equipmentModel",
  type: "equipmentType",
  equipmenttype: "equipmentType",
  eqptserial: "equipmentSerial",
  equipmentserial: "equipmentSerial",
  serialnumber: "equipmentSerial",
  // "Issuied" is the spelling in the live registers.
  fmnunitissuied: "fmnUnitIssued",
  fmnunit: "fmnUnitIssued",
  purposeofissuied: "purposeOfIssue",
  purpose: "purposeOfIssue",
  howdepl: "howDeployed",
  howdeployed: "howDeployed",
  letterofrequest: "letterOfRequest",
  auth: "authority",
  status: "condition",
  condition: "condition",
  remark: "remarks",
}

const HEADER_LOOKUP = new Map<string, string>([
  ...IO_COLUMNS.map((c) => [normalizeHeader(c.header), c.key as string] as const),
  ...Object.entries(HEADER_ALIASES),
])

/**
 * Maps a sheet's header row onto our column keys. Unknown columns map to
 * null and are ignored rather than rejected: a unit's own spreadsheet often
 * carries extra working columns, and refusing the whole file over one of
 * them would push people back to re-typing by hand.
 */
export function mapHeaderRow(headers: string[]): (string | null)[] {
  return headers.map((h) => HEADER_LOOKUP.get(normalizeHeader(String(h ?? ""))) ?? null)
}

/**
 * Finds the header row in a sheet, rather than assuming it is the first.
 *
 * The units' workbooks title each block with the formation ("51 SB") on the
 * row above the headings, and some carry a blank or a report title above
 * that. Assuming row 1 was the header made every one of those files fail
 * with "no Equipment column", which is what a clerk sees as "import is
 * broken".
 *
 * Scans the first 20 rows and takes the one mapping the most known columns,
 * requiring an equipment-name column since a row without one cannot be the
 * header of a returns register.
 */
export function findHeaderRow(rows: unknown[][]): number {
  const blocks = findHeaderRows(rows)
  return blocks.length > 0 ? blocks[0].headerIndex : -1
}

/** True when a row reads as a column-heading row for the register. */
function isHeaderRow(row: unknown[]): boolean {
  const keys = mapHeaderRow((row ?? []).map((c) => String(c ?? "")))
  return keys.includes("equipmentName") && keys.filter(Boolean).length >= 3
}

export type SheetBlock = {
  /** Row index of this block's column headings. */
  headerIndex: number
  /** Row indices carrying data, up to the next block's title. */
  dataRows: number[]
  /**
   * The formation this block belongs to, taken from the single-cell title
   * row above the headings ("51 SB"). Null when there is no such title.
   */
  title: string | null
}

/**
 * Splits a sheet into register blocks.
 *
 * NAS keeps every subordinate formation's returns on one sheet, each block
 * titled with the formation and carrying its own header row — so a file can
 * hold nineteen headers, not one. Treating only the first as real imported
 * one unit's holdings and silently discarded the rest, which on an
 * equipment register is a serious loss.
 *
 * Scans the whole sheet (not just the first rows) and returns every block
 * in order, with the title above each header where one exists.
 */
export function findHeaderRows(rows: unknown[][]): SheetBlock[] {
  const headerIndices: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (isHeaderRow(rows[i] ?? [])) headerIndices.push(i)
  }

  return headerIndices.map((headerIndex, n) => {
    const end = n + 1 < headerIndices.length ? headerIndices[n + 1] : rows.length
    const dataRows: number[] = []
    for (let r = headerIndex + 1; r < end; r++) {
      const row = rows[r] ?? []
      // A title row for the *next* block sits between blocks: one filled
      // cell and nothing else. Stop before it rather than importing it.
      const filled = row.filter((c) => String(c ?? "").trim() !== "").length
      if (filled === 0) continue
      if (filled === 1 && r === end - 1) continue
      dataRows.push(r)
    }

    // The block's title is the nearest non-empty row above the headings.
    // Usually that row holds just the formation ("52 SB"), but Excel's
    // "format as table" leaves the first block's title alongside generated
    // names ("51 SB | Column1 | Column2 | ..."), so those are stripped and
    // the first real cell taken.
    let title: string | null = null
    for (let r = headerIndex - 1; r >= 0 && r > headerIndex - 4; r--) {
      const filled = (rows[r] ?? []).map((c) => String(c ?? "").trim()).filter(Boolean)
      if (filled.length === 0) continue
      const meaningful = filled.filter((c) => !/^column\d+$/i.test(c))
      if (meaningful.length > 0 && meaningful.length <= 2) title = meaningful[0]
      break
    }

    return { headerIndex, dataRows, title }
  })
}

/**
 * Excel dates arrive as Date objects, CSV dates as whatever was typed.
 * Everything becomes the yyyy-mm-dd that <input type="date"> requires;
 * anything unparseable becomes "" rather than an invalid date.
 */
function toIsoDateCell(value: unknown): string {
  if (value == null || value === "") return ""
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const text = String(value).trim()
  // Already ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  // dd/mm/yyyy and dd-mm-yyyy, the formats the paper register uses. Parsed
  // explicitly rather than via Date(), which would read them as US m/d/y.
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10)
}

function toNumberCell(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const n = Number(String(value ?? "").trim())
  return Number.isFinite(n) ? n : 0
}

/**
 * Turns one spreadsheet row into a form item. Deliberately lenient: this
 * feeds the New Return form, where the clerk reviews and fixes everything
 * before submitting, so a partially-filled row is useful and a hard
 * validation failure here is not.
 */
export function rowToItem(row: Record<string, unknown>): ReturnItemDraft {
  const equipmentName = String(row.equipmentName ?? "").trim()

  // Quantity comes from the equipment name's leading multiplier, since the
  // register has no quantity column. An explicit Qty column is still
  // honoured if a unit's own sheet happens to carry one.
  const explicitQty = Math.trunc(toNumberCell(row.quantity))
  const quantity = explicitQty > 0 ? explicitQty : quantityFromName(equipmentName)

  // The single Status column decides the whole line's condition, which is
  // what one value against one row means on paper. Anything unrecognised
  // (or blank) falls to Serviceable so the row is valid on arrival and the
  // clerk can correct it before submitting.
  const statusText = String(row.condition ?? "").trim().toUpperCase()
  const bucket = CONDITION_BY_LABEL[statusText] ?? "svc"

  return {
    letterOfRequest: String(row.letterOfRequest ?? "").trim(),
    authority: String(row.authority ?? "").trim(),
    dateIssued: toIsoDateCell(row.dateIssued),
    fmnUnitIssued: String(row.fmnUnitIssued ?? "").trim(),
    // Free text in the sheet, a fixed enum in the form. An unrecognised
    // value is dropped to "" so the select renders empty rather than
    // holding a value the schema will later reject.
    howDeployed: (String(row.howDeployed ?? "").trim() || "") as ReturnItemDraft["howDeployed"],
    purposeOfIssue: String(row.purposeOfIssue ?? "").trim(),
    equipmentName,
    equipmentModel: String(row.equipmentModel ?? "").trim(),
    band: String(row.band ?? "").trim(),
    equipmentType: String(row.equipmentType ?? "").trim(),
    equipmentSerial: String(row.equipmentSerial ?? "").trim(),
    origin: String(row.origin ?? "").trim(),
    quantity,
    // The whole quantity lands in the one bucket the Status column names,
    // so the breakdown always sums to the quantity and the item is valid.
    serviceableQty: bucket === "svc" ? quantity : 0,
    unserviceableQty: bucket === "unsvc" ? quantity : 0,
    underRepairQty: bucket === "repair" ? quantity : 0,
    awaitingEvacuationQty: bucket === "evac" ? quantity : 0,
    remarks: String(row.remarks ?? "").trim(),
  }
}

/** True when a row carries nothing worth importing (blank spacer rows). */
export function isBlankRow(row: Record<string, unknown>): boolean {
  return Object.entries(row).every(([key, value]) => {
    if (NUMERIC_KEYS.has(key)) return !value || toNumberCell(value) === 0
    return String(value ?? "").trim() === ""
  })
}

/** RFC 4180 quoting: wrap in quotes and double any internal quote. */
function csvCell(value: unknown): string {
  const text = String(value ?? "")
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: (string | number)[][]): string {
  // A BOM so Excel opens UTF-8 correctly on Windows, which is what these
  // files are opened in. Without it, non-ASCII text renders as mojibake.
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
}

/**
 * Minimal CSV parser handling quoted fields, escaped quotes and embedded
 * newlines. Small enough to own outright rather than take a dependency for.
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\r") {
      // Swallowed: the \n that follows ends the row.
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }

  // Whatever is buffered when input ends is a final row without a trailing
  // newline, which most editors produce.
  if (cell !== "" || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}
