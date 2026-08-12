/**
 * fast-formula-parser ships no type declarations. This describes only the
 * surface src/lib/sheet/formula.ts uses, checked against the installed
 * build (v1.0.19) rather than its README, which differs in places.
 */
declare module "fast-formula-parser" {
  export type FormulaPosition = { row: number; col: number; sheet: string }
  export type CellRef = { row: number; col: number; sheet?: string }
  export type RangeRef = { from: CellRef; to: CellRef; sheet?: string }

  /** Errors surface as objects carrying `_error`, and are also thrown. */
  export type FormulaErrorLike = { _error?: string; result?: unknown }

  export type ParserConfig = {
    onCell?: (ref: CellRef) => number | string | boolean | null
    onRange?: (ref: RangeRef) => (number | string | boolean | null)[][]
    functions?: Record<string, (...args: unknown[]) => unknown>
  }

  export default class FormulaParser {
    constructor(config?: ParserConfig)
    parse(
      formula: string,
      position: FormulaPosition
    ): number | string | boolean | null | FormulaErrorLike
  }
}
