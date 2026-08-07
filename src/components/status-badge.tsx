import { cn } from "@/lib/utils"
import type { StatusTone } from "@/lib/status"

const TONE_CLASSES: Record<StatusTone, string> = {
  danger: "bg-status-danger-bg text-status-danger border-status-danger/30",
  warning: "bg-status-warning-bg text-status-warning border-status-warning/30",
  success: "bg-status-success-bg text-status-success border-status-success/30",
}

function StatusDot({ tone }: { tone: StatusTone }) {
  const dotClasses: Record<StatusTone, string> = {
    danger: "bg-status-danger",
    warning: "bg-status-warning",
    success: "bg-status-success",
  }
  return <span className={cn("size-1.5 rounded-full", dotClasses[tone])} aria-hidden />
}

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  )
}
