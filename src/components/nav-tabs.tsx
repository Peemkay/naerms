"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export function NavTabs({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname()

  // Only the single longest matching href wins — otherwise a parent route
  // like "/admin" would also light up on a more specific child page like
  // "/admin/users" that matches its own, more specific, tab.
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/")
  const bestHref = items
    .filter((item) => matches(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <nav className="flex h-14 items-center gap-1">
      {items.map((item) => {
        const active = item.href === bestHref
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
