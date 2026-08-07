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
}: {
  label: string
  value: number | string
  tone?: StatusTone
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", tone && TONE_TEXT[tone])}>{value}</p>
    </div>
  )
}
