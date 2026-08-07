import Link from "next/link"
import { Radio, Plus } from "lucide-react"

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
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {user.privileges.length > 0
                    ? user.privileges.map((p) => PRIVILEGE_LABELS[p]).join(" · ")
                    : "No privileges assigned"}
                </p>
              </div>
            )}
            {user?.privileges.includes("MANAGE_FORMATIONS") && (
              <Button
                variant="outline"
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
                  returnId: n.returnId,
                  requestRef: n.return.requestRef,
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
