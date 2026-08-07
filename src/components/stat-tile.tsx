import Link from "next/link"

import { cn } from "@/lib/utils"
import type { StatusTone } from "@/lib/status"

const TONE_TEXT: Record<StatusTone, string> = {
  danger: "text-status-danger",
  warning: "text-status-warning",
  success: "text-status-success",
}

export function StatTile({
  label,
  value,
  tone,
  href,
  active,
}: {
  label: string
  value: number | string
  tone?: StatusTone
  href?: string
  active?: boolean
}) {
  const content = (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-3 transition-colors",
        active ? "border-primary bg-secondary" : "border-border bg-card",
        href && "cursor-pointer hover:border-primary/50 hover:bg-muted/60"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", tone && TONE_TEXT[tone])}>{value}</p>
    </div>
  )

  if (!href) return content

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  )
}
