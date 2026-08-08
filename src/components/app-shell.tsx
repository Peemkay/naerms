import Image from "next/image"
import Link from "next/link"
import { Plus } from "lucide-react"

import { auth } from "@/lib/auth"
import { getRecentNotifications, getUnreadNotificationCount } from "@/lib/notifications"
import { ThemeToggle } from "@/components/theme-toggle"
import { SignOutButton } from "@/components/sign-out-button"
import { NotificationBell } from "@/components/notification-bell"
import { Button } from "@/components/ui/button"
import { PRIVILEGE_LABELS } from "@/lib/privileges"

export async function AppShell({
  children,
  nav,
}: {
  children: React.ReactNode
  nav?: React.ReactNode
}) {
  const session = await auth()
  const user = session?.user

  const [notifications, unreadCount] = user
    ? await Promise.all([getRecentNotifications(user.id), getUnreadNotificationCount(user.id)])
    : [[], 0]

  return (
    <div className="flex min-h-screen flex-col">
      {/* The masthead is fixed brand navy in both themes — a letterhead, not
          a themed surface. Only the content area below adapts to light/dark. */}
      <header className="sticky top-0 z-40 border-b-2 border-brand-gold bg-brand-navy text-white shadow-sm">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-4 sm:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-wide">
            <span className="flex size-8 items-center justify-center rounded-md bg-white p-1">
              <Image src="/logo.png" alt="NAERMS" width={26} height={30} className="h-full w-auto" priority />
            </span>
            <span className="hidden sm:inline">NAERMS</span>
          </Link>

          {/* The scrollable, shrinkable middle — everything else here is
              shrink-0, so a narrow viewport squeezes/scrolls the tabs
              instead of forcing the whole header wider than the screen. */}
          <div className="min-w-0 flex-1 overflow-x-auto">{nav}</div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user && (
              <div className="hidden max-w-40 text-right leading-tight xl:block">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-white/60">
                  {user.privileges.length > 0
                    ? user.privileges.map((p) => PRIVILEGE_LABELS[p]).join(" · ")
                    : "No privileges assigned"}
                </p>
              </div>
            )}
            {user?.privileges.includes("MANAGE_FORMATIONS") && (
              <Button
                size="sm"
                render={
                  <Link href="/dashboard/formations/new">
                    <Plus className="size-3.5" />
                    <span className="hidden sm:inline">Add Formation</span>
                  </Link>
                }
              />
            )}
            {user && (
              <NotificationBell
                notifications={notifications.map((n) => ({
                  id: n.id,
                  message: n.message,
                  isRead: n.isRead,
                  createdAt: n.createdAt,
                  href:
                    n.type === "RETURN_REQUESTED"
                      ? `/dashboard/new-return?ref=${encodeURIComponent(n.request?.requestRef ?? "")}`
                      : `/dashboard/returns/${n.returnId}`,
                }))}
                unreadCount={unreadCount}
              />
            )}
            <ThemeToggle />
            {user && <SignOutButton />}
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}
