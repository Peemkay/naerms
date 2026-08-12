import Link from "next/link"
import { Building2, Network } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Switches between a formation's own register and the consolidated sheet
 * covering everything under it.
 *
 * Only rendered for formations that actually have subordinates, so a unit
 * at the bottom of the tree isn't offered a view identical to the one it is
 * already looking at.
 */
export function SheetScopeTabs({
  formationId,
  scope,
}: {
  formationId: string
  scope: "own" | "all"
}) {
  const tabs = [
    { key: "own", label: "This Formation", href: `/dashboard/sheet?formation=${formationId}`, icon: Building2 },
    {
      key: "all",
      label: "All Subordinates",
      href: `/dashboard/sheet?formation=${formationId}&scope=all`,
      icon: Network,
    },
  ] as const

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
      {tabs.map((tab) => {
        const active = scope === tab.key
        const Icon = tab.icon
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
