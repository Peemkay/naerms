"use client"

import { Printer } from "lucide-react"

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
    >
      <Printer className="size-4" />
      Print
    </button>
  )
}
