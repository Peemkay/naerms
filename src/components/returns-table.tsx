"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { ArrowUpDown, Search } from "lucide-react"
import type { ReturnStatus, EquipmentCondition } from "@prisma/client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { RETURN_STATUS_LABEL, RETURN_STATUS_TONE, CONDITION_TONE } from "@/lib/status"
import { cn } from "@/lib/utils"

export type ReturnRow = {
  id: string // ReturnItem id
  returnId: string // parent Return id — links go here
  lineNo: number
  requestRef: string
  formationName: string
  equipmentName: string
  equipmentModel: string | null
  band: string | null
  status: ReturnStatus
  quantity: number
  conditionSummary: string // e.g. "5 Serviceable, 2 Under Repair"
  conditionTone: EquipmentCondition | null // dominant bucket, for badge color only
  dateIssued: string | null // ISO "yyyy-MM-dd" — sorts correctly as plain text
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
})

const helper = createColumnHelper<typeof features, ReturnRow>()

const columns = helper.columns([
  helper.accessor("requestRef", {
    header: "Request Ref",
    cell: (info) => (
      <div>
        <div className="font-medium">{info.getValue()}</div>
        <div className="text-xs text-muted-foreground">Line {info.row.original.lineNo}</div>
      </div>
    ),
  }),
  helper.accessor("formationName", { header: "Fmn/Unit" }),
  helper.accessor("equipmentName", {
    header: "Equipment",
    cell: (info) => (
      <div>
        <div className="font-medium">{info.getValue()}</div>
        {info.row.original.equipmentModel && (
          <div className="text-xs text-muted-foreground">{info.row.original.equipmentModel}</div>
        )}
      </div>
    ),
  }),
  helper.accessor("band", {
    header: "Band",
    cell: (info) => info.getValue() ?? <span className="text-muted-foreground">—</span>,
  }),
  helper.accessor("quantity", {
    header: "Qty",
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  helper.accessor("dateIssued", {
    header: "Date Issued",
    cell: (info) => info.getValue() ?? <span className="text-muted-foreground">—</span>,
  }),
  helper.accessor("status", {
    header: "Status",
    filterFn: "equalsString",
    cell: (info) => (
      <StatusBadge tone={RETURN_STATUS_TONE[info.getValue()]}>
        {RETURN_STATUS_LABEL[info.getValue()]}
      </StatusBadge>
    ),
  }),
  helper.accessor("conditionSummary", {
    header: "Condition",
    cell: (info) => {
      const tone = info.row.original.conditionTone
      return tone ? (
        <StatusBadge tone={CONDITION_TONE[tone]}>{info.getValue()}</StatusBadge>
      ) : (
        <span className="text-muted-foreground">{info.getValue()}</span>
      )
    },
  }),
  helper.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <Link
        href={`/dashboard/returns/${info.row.original.returnId}`}
        className="text-sm font-medium text-primary hover:underline"
      >
        View
      </Link>
    ),
  }),
])

export function ReturnsTable({
  data,
  initialStatus,
}: {
  data: ReturnRow[]
  initialStatus?: ReturnStatus
}) {
  const [globalFilter, setGlobalFilter] = useState("")
  const stableData = useMemo(() => data, [data])
  const initialColumnFilters: ColumnFiltersState = initialStatus
    ? [{ id: "status", value: initialStatus }]
    : []

  // Controlled (not just `initialState`) so that clicking a different status
  // card while this table is already mounted actually re-filters it —
  // `initialState` in TanStack Table only seeds state on first mount, so a
  // client-side nav to a new `?status=` value was previously a no-op here.
  // Synced from the prop during render (React's "adjusting state when a
  // prop changes" pattern: react.dev/learn/you-might-not-need-an-effect)
  // rather than in a useEffect, which would cost an extra render pass and
  // trip the set-state-in-effect lint rule.
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters)
  const [prevInitialStatus, setPrevInitialStatus] = useState(initialStatus)
  if (prevInitialStatus !== initialStatus) {
    setPrevInitialStatus(initialStatus)
    setColumnFilters(initialColumnFilters)
  }

  const table = useTable(
    {
      features,
      columns,
      data: stableData,
      state: { globalFilter, columnFilters },
      onGlobalFilterChange: setGlobalFilter,
      onColumnFiltersChange: setColumnFilters,
      globalFilterFn: "includesString",
      getColumnCanGlobalFilter: (column) =>
        ["requestRef", "formationName", "equipmentName"].includes(column.id),
    },
    (state) => ({ sorting: state.sorting, globalFilter: state.globalFilter, columnFilters: state.columnFilters })
  )

  const statusColumn = table.getColumn("status")

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search ref, equipment, unit…"
            className="pl-8"
          />
        </div>
        <Select
          value={(statusColumn?.getFilterValue() as string) ?? "all"}
          onValueChange={(value) => statusColumn?.setFilterValue(value === "all" ? undefined : value)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(RETURN_STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {table.getRowModel().rows.length} of {data.length} items
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      className="whitespace-nowrap px-3 py-2 text-left font-medium"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <table.FlexRender header={header} />
                          <ArrowUpDown
                            className={cn(
                              "size-3",
                              header.column.getIsSorted() ? "opacity-100" : "opacity-30"
                            )}
                          />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/40">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-top whitespace-nowrap">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  No returns match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
