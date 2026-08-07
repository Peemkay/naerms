import { StatusBadge } from "@/components/status-badge"
import { RETURN_STATUS_LABEL, RETURN_STATUS_TONE } from "@/lib/status"
import type { ReturnStatus } from "@prisma/client"

type HistoryEntry = {
  id: string
  fromStatus: ReturnStatus | null
  toStatus: ReturnStatus
  note: string | null
  changedAt: Date
  changedBy: { fullName: string; rank: string | null; role: string }
}

export function StatusTimeline({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
  }

  return (
    <ol className="relative flex flex-col gap-5 border-l border-border pl-5">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute top-1 -left-[27px] size-2.5 rounded-full border-2 border-background bg-primary" />
          <div className="flex flex-wrap items-center gap-2">
            {entry.fromStatus && (
              <>
                <StatusBadge tone={RETURN_STATUS_TONE[entry.fromStatus]}>
                  {RETURN_STATUS_LABEL[entry.fromStatus]}
                </StatusBadge>
                <span className="text-muted-foreground">&rarr;</span>
              </>
            )}
            <StatusBadge tone={RETURN_STATUS_TONE[entry.toStatus]}>
              {RETURN_STATUS_LABEL[entry.toStatus]}
            </StatusBadge>
          </div>
          {entry.note && <p className="mt-1 text-sm">{entry.note}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {entry.changedBy.rank ? `${entry.changedBy.rank} ` : ""}
            {entry.changedBy.fullName} &middot;{" "}
            {entry.changedAt.toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </li>
      ))}
    </ol>
  )
}
