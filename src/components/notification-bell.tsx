"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { markAllNotificationsReadAction } from "@/lib/actions/notifications"

export type NotificationItem = {
  id: string
  message: string
  isRead: boolean
  createdAt: Date
  returnId: string
  requestRef: string
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[]
  unreadCount: number
}) {
  const router = useRouter()
  const [count, setCount] = useState(unreadCount)
  const [, startTransition] = useTransition()

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && count > 0) {
          setCount(0)
          startTransition(async () => {
            await markAllNotificationsReadAction()
            router.refresh()
          })
        }
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell className={cn("size-4", count > 0 && "text-status-warning")} />
            {count > 0 && (
              <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-status-danger text-[10px] font-medium text-status-danger-foreground">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              render={
                <Link href={`/dashboard/returns/${n.returnId}`} className="flex-col items-start!">
                  <p className={cn("text-sm", !n.isRead && "font-medium")}>{n.message}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </Link>
              }
            />
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
