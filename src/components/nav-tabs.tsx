"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export function NavTabs({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname()

  // Only the single longest matching href wins — otherwise a parent route
  // like "/dashboard" would also light up on a more specific child page
  // like "/dashboard/accounts" that matches its own, more specific, tab.
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/")
  const bestHref = items
    .filter((item) => matches(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  // Rendered inside the fixed-navy masthead, so styled against that
  // background directly rather than theme tokens — gold marks the active
  // tab, echoing the logo's own emphasis on its standout word.
  return (
    <nav className="flex h-14 items-center gap-1">
      {items.map((item) => {
        const active = item.href === bestHref
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-white/10 text-brand-gold"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
