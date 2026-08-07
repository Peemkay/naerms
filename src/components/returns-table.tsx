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
} from "@tanstack/react-table"
import { ArrowUpDown, Search } from "lucide-react"
import type { EquipmentCondition, ReturnStatus } from "@prisma/client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import {
  CONDITION_LABEL,
  CONDITION_TONE,
  RETURN_STATUS_LABEL,
  RETURN_STATUS_TONE,
} from "@/lib/status"
import { cn } from "@/lib/utils"

export type ReturnRow = {
  id: string
  serialNo: number
  requestRef: string
  formationName: string
  equipmentName: string
  equipmentModel: string | null
  equipmentSerial: string
  band: string | null
  status: ReturnStatus
  condition: EquipmentCondition | null
  dateIssued: string | null // ISO "yyyy-MM-dd" — sorts correctly as plain text
  submittedByName: string
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
  helper.accessor("serialNo", {
    header: "Serial",
    cell: (info) => <span className="tabular-nums text-muted-foreground">{info.getValue()}</span>,
  }),
  helper.accessor("requestRef", { header: "Request Ref" }),
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
  helper.accessor("equipmentSerial", { header: "Equipment Serial" }),
  helper.accessor("band", {
    header: "Band",
    cell: (info) => info.getValue() ?? <span className="text-muted-foreground">—</span>,
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
  helper.accessor("condition", {
    header: "Condition",
    cell: (info) => {
      const value = info.getValue()
      return value ? (
        <StatusBadge tone={CONDITION_TONE[value]}>{CONDITION_LABEL[value]}</StatusBadge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    },
  }),
  helper.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <Link
        href={`/returns/${info.row.original.id}`}
        className="text-sm font-medium text-primary hover:underline"
      >
        View
      </Link>
    ),
  }),
])

export function ReturnsTable({ data }: { data: ReturnRow[] }) {
  const [globalFilter, setGlobalFilter] = useState("")
  const stableData = useMemo(() => data, [data])

  const table = useTable(
    {
      features,
      columns,
      data: stableData,
      state: { globalFilter },
      onGlobalFilterChange: setGlobalFilter,
      globalFilterFn: "includesString",
      getColumnCanGlobalFilter: (column) =>
        ["requestRef", "formationName", "equipmentName", "equipmentSerial"].includes(column.id),
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
            placeholder="Search ref, equipment, unit, serial…"
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
          {table.getRowModel().rows.length} of {data.length} returns
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
                  <td key={cell.id} className="px-3 py-2 align-top">
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
