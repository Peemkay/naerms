import FormulaParser from "fast-formula-parser"

/**
 * Spreadsheet formula evaluation for the sheet view.
 *
 * Runs entirely in the browser against the rows already loaded: a formula is
 * presentation, so the server never needs to compute one, and a bad formula
 * can't cost a round trip or wedge a save.
 *
 * fast-formula-parser (MIT) does the parsing and the function library. The
 * two candidates with richer engines were both unusable here on licensing
 * grounds — HyperFormula is GPL-3.0-only and Handsontable is commercial —
 * which matters for software delivered to the Nigerian Army.
 */

export type CellAddress = { row: number; col: number }

/** A1 / $B$7 -> zero-based indices. Returns null for anything unparseable. */
export function parseA1(ref: string): CellAddress | null {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(ref.trim())
  if (!match) return null
  const [, letters, digits] = match
  let col = 0
  for (const char of letters.toUpperCase()) {
    col = col * 26 + (char.charCodeAt(0) - 64)
  }
  const row = Number(digits)
  if (!Number.isFinite(row) || row < 1) return null
  return { row: row - 1, col: col - 1 }
}

/**
 * Numbers stay numbers, everything else passes through as text. Blank cells
 * evaluate to 0 in arithmetic, matching Excel rather than producing an error
 * for a sheet that is legitimately half-filled.
 */
function coerce(raw: string | number | null | undefined): number | string {
  if (raw === null || raw === undefined || raw === "") return 0
  if (typeof raw === "number") return raw
  const n = Number(raw)
  return Number.isFinite(n) && raw.trim() !== "" ? n : raw
}

export type GridReader = (address: CellAddress) => string | number | null

/**
 * Builds an evaluator over a grid.
 *
 * `readCell` is asked for displayed values, so a formula referencing another
 * formula sees that one's result. Cycles are handled by the depth guard in
 * evaluateAll below rather than here.
 */
export function createEvaluator(readCell: GridReader) {
  const parser = new FormulaParser({
    onCell: (ref: { row: number; col: number }) =>
      coerce(readCell({ row: ref.row - 1, col: ref.col - 1 })),
    onRange: (ref: { from: { row: number; col: number }; to: { row: number; col: number } }) => {
      const rows: (number | string)[][] = []
      for (let row = ref.from.row; row <= ref.to.row; row++) {
        const cells: (number | string)[] = []
        for (let col = ref.from.col; col <= ref.to.col; col++) {
          cells.push(coerce(readCell({ row: row - 1, col: col - 1 })))
        }
        rows.push(cells)
      }
      return rows
    },
  })

  return function evaluate(formula: string, at: CellAddress): string {
    const source = formula.startsWith("=") ? formula.slice(1) : formula
    try {
      const result = parser.parse(source, { row: at.row + 1, col: at.col + 1, sheet: "Sheet1" })
      if (result === null || result === undefined) return ""
      if (typeof result === "object") {
        // FormulaError carries its tag on `_error` ("#DIV/0!", "#VALUE!").
        // Verified against the installed build rather than assumed: the
        // public field name is not what the README implies.
        const tagged = result as { _error?: string; result?: unknown }
        if (tagged._error) return tagged._error
        return String(tagged.result ?? "")
      }
      return String(result)
    } catch (error) {
      // Unknown functions and malformed input *throw* here rather than
      // returning an error object, so this catch is load-bearing, not
      // defensive. Excel shows the error in the cell rather than refusing
      // the edit, and so do we: the clerk can see what they typed and fix it.
      const tag = (error as { _error?: string })?._error
      return typeof tag === "string" ? tag : "#ERROR!"
    }
  }
}

/**
 * Resolves every formula in a grid to a displayed value.
 *
 * Formulas are evaluated lazily and memoised as they are reached, so a chain
 * (C1 = B1 * 2, B1 = A1 + 1) resolves in one pass regardless of order. The
 * depth guard turns a circular reference into #CYCLE! instead of a hung tab
 * — worth having, since a shared register sheet will eventually contain one.
 */
export function evaluateGrid({
  rowCount,
  colCount,
  rawValue,
}: {
  rowCount: number
  colCount: number
  /** Literal cell contents, formulas included (with the leading "="). */
  rawValue: (address: CellAddress) => string | number | null
}): Map<string, string> {
  const resolved = new Map<string, string>()
  const inProgress = new Set<string>()
  const keyOf = (a: CellAddress) => `${a.row}:${a.col}`

  const read: GridReader = (address) => {
    if (address.row < 0 || address.col < 0 || address.row >= rowCount || address.col >= colCount) {
      return null
    }
    const key = keyOf(address)
    if (resolved.has(key)) return resolved.get(key)!

    const raw = rawValue(address)
    if (typeof raw !== "string" || !raw.startsWith("=")) {
      return raw
    }

    if (inProgress.has(key)) return "#CYCLE!"
    inProgress.add(key)
    const value = evaluate(raw, address)
    inProgress.delete(key)
    resolved.set(key, value)
    return value
  }

  const evaluate = createEvaluator(read)

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const raw = rawValue({ row, col })
      if (typeof raw === "string" && raw.startsWith("=")) {
        read({ row, col })
      }
    }
  }

  return resolved
}

/** Applies a number format to a computed value. Excel-ish, not exhaustive. */
export function applyNumberFormat(value: string, format: string | null): string {
  if (!format) return value
  const n = Number(value)
  if (!Number.isFinite(n)) return value

  const decimals = /\.(0+)/.exec(format)?.[1].length ?? 0
  const grouped = format.includes(",")
  const formatted = n.toFixed(decimals)
  if (!grouped) return formatted

  const [whole, fraction] = formatted.split(".")
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return fraction ? `${withSeparators}.${fraction}` : withSeparators
}
