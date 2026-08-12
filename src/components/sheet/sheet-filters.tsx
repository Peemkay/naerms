"use client"

import { Filter, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SHEET_COLUMNS } from "@/lib/sheet/columns"
import type { SheetRow } from "@/lib/sheet/data"

export type SheetFilterState = {
  /** Matches any column, so a serial or a unit name both find their rows. */
  search: string
  /** Selected values per column key; empty means "no filter on this column". */
  columns: Record<string, string[]>
}

export const EMPTY_FILTERS: SheetFilterState = { search: "", columns: {} }

/** Columns worth filtering on: the ones that repeat across rows. */
const FILTERABLE = ["fmnUnitIssued", "condition", "band", "equipmentType", "howDeployed", "authority", "origin"]

/** Distinct values present in the loaded rows, for one column. */
function valuesFor(rows: SheetRow[], key: string): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const value = String(row.values[key] ?? "").trim()
    if (value) seen.add(value)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/**
 * Applies the current filters to the loaded rows.
 *
 * Filtering is client-side over the rows already fetched: a register is
 * hundreds of lines, not millions, so narrowing is instant and costs no
 * round trip. A row must match every active column filter (AND across
 * columns, OR within one), which is how a spreadsheet's own filters behave.
 */
export function applySheetFilters(rows: SheetRow[], filters: SheetFilterState): SheetRow[] {
  const needle = filters.search.trim().toLowerCase()
  const active = Object.entries(filters.columns).filter(([, values]) => values.length > 0)

  if (!needle && active.length === 0) return rows

  return rows.filter((row) => {
    if (needle) {
      const hit = Object.values(row.values).some((v) => String(v ?? "").toLowerCase().includes(needle))
      if (!hit) return false
    }
    for (const [key, values] of active) {
      if (!values.includes(String(row.values[key] ?? "").trim())) return false
    }
    return true
  })
}

export function SheetFilters({
  rows,
  filters,
  onChange,
  matchCount,
}: {
  rows: SheetRow[]
  filters: SheetFilterState
  onChange: (next: SheetFilterState) => void
  matchCount: number
}) {
  const activeCount = Object.values(filters.columns).filter((v) => v.length > 0).length
  const hasFilters = activeCount > 0 || filters.search.trim() !== ""

  function toggle(key: string, value: string) {
    const current = filters.columns[key] ?? []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...filters, columns: { ...filters.columns, [key]: next } })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search the register…"
          className="h-8 w-56 pl-8 text-xs"
        />
      </div>

      {FILTERABLE.map((key) => {
        const column = SHEET_COLUMNS.find((c) => c.key === key)
        if (!column) return null
        const values = valuesFor(rows, key)
        if (values.length === 0) return null
        const selected = filters.columns[key] ?? []

        return (
          <DropdownMenu key={key}>
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant={selected.length > 0 ? "secondary" : "ghost"}>
                  {column.header}
                  {selected.length > 0 && ` (${selected.length})`}
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>{column.header}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {values.map((value) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={selected.includes(value)}
                  onCheckedChange={() => toggle(key, value)}
                >
                  {value}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}

      {hasFilters && (
        <>
          <Button size="sm" variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
            <X className="size-3.5" />
            Clear
          </Button>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="size-3" />
            {matchCount} of {rows.length}
          </span>
        </>
      )}
    </div>
  )
}
