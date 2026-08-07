"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { setUserActiveAction } from "@/lib/actions/users"

export function UserActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await setUserActiveAction(userId, !isActive)
          if ("error" in res) {
            toast.error(res.error)
            return
          }
          toast.success(isActive ? "Account deactivated." : "Account reactivated.")
          router.refresh()
        })
      }}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  )
}
