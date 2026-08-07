import Link from "next/link"
import { Radio, Plus } from "lucide-react"

import { auth } from "@/lib/auth"
import { ThemeToggle } from "@/components/theme-toggle"
import { SignOutButton } from "@/components/sign-out-button"
import { Button } from "@/components/ui/button"
import { ROLE_LABELS } from "@/lib/roles"

export async function AppShell({
  children,
  nav,
}: {
  children: React.ReactNode
  nav?: React.ReactNode
}) {
  const session = await auth()
  const user = session?.user

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-6 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-wide">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Radio className="size-4" />
            </span>
            <span className="hidden sm:inline">NAERMS</span>
          </Link>

          {nav}

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium">
                  {user.rank ? `${user.rank} ` : ""}
                  {user.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.formationName} &middot; {ROLE_LABELS[user.role]}
                </p>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href="/formations/new">
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">Add Formation</span>
                </Link>
              }
            />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}
