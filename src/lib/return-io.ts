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
  { header: "SER", key: "lineNo" },
  { header: "Letter of Request", key: "letterOfRequest" },
  { header: "Authority", key: "authority" },
  { header: "Date Issued", key: "dateIssued" },
  { header: "Fmn/Unit Issuied", key: "fmnUnitIssued" },
  { header: "How Depl", key: "howDeployed" },
  { header: "Purpose of Issuied", key: "purposeOfIssue" },
  { header: "Eqpt Name", key: "equipmentName" },
  { header: "Eqpt Model", key: "equipmentModel" },
  { header: "Band", key: "band" },
  { header: "Eqpt Type", key: "equipmentType" },
  { header: "Eqpt Serial", key: "equipmentSerial" },
  { header: "Origin", key: "origin" },
  { header: "Qty", key: "quantity" },
  { header: "Serviceable", key: "serviceableQty" },
  { header: "Unserviceable", key: "unserviceableQty" },
  { header: "Under Repair", key: "underRepairQty" },
  { header: "Awaiting Evacuation", key: "awaitingEvacuationQty" },
  { header: "Remarks", key: "remarks" },
] as const

export type IoColumnKey = (typeof IO_COLUMNS)[number]["key"]

/** Header row, also used as the downloadable blank template. */
export const IO_HEADERS = IO_COLUMNS.map((c) => c.header)

const NUMERIC_KEYS = new Set<string>([
  "quantity",
  "serviceableQty",
  "unserviceableQty",
  "underRepairQty",
  "awaitingEvacuationQty",
])

/** Normalises a header for matching: case, spacing and punctuation agnostic. */
function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

const HEADER_LOOKUP = new Map(
  IO_COLUMNS.map((c) => [normalizeHeader(c.header), c.key as string])
)

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
  const quantity = Math.max(1, Math.trunc(toNumberCell(row.quantity)) || 1)

  const serviceableQty = Math.max(0, Math.trunc(toNumberCell(row.serviceableQty)))
  const unserviceableQty = Math.max(0, Math.trunc(toNumberCell(row.unserviceableQty)))
  const underRepairQty = Math.max(0, Math.trunc(toNumberCell(row.underRepairQty)))
  const awaitingEvacuationQty = Math.max(0, Math.trunc(toNumberCell(row.awaitingEvacuationQty)))

  const breakdownTotal =
    serviceableQty + unserviceableQty + underRepairQty + awaitingEvacuationQty

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
    equipmentName: String(row.equipmentName ?? "").trim(),
    equipmentModel: String(row.equipmentModel ?? "").trim(),
    band: String(row.band ?? "").trim(),
    equipmentType: String(row.equipmentType ?? "").trim(),
    equipmentSerial: String(row.equipmentSerial ?? "").trim(),
    origin: String(row.origin ?? "").trim(),
    quantity,
    // A sheet with no condition columns filled in (common: the paper form
    // only records a total) puts everything in Serviceable so the item is
    // immediately valid. A partially-filled breakdown is left exactly as
    // typed, so the form's own "N units unassigned" warning can catch it.
    serviceableQty: breakdownTotal === 0 ? quantity : serviceableQty,
    unserviceableQty,
    underRepairQty,
    awaitingEvacuationQty,
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
