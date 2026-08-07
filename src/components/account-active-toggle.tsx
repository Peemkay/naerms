"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { setAccountActiveAction } from "@/lib/actions/formations"

export function AccountActiveToggle({ formationId, isActive }: { formationId: string; isActive: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await setAccountActiveAction(formationId, !isActive)
          if ("error" in res) {
            toast.error(res.error)
            return
          }
          toast.success(isActive ? "Account deactivated." : "Account reactivated.")
          router.refresh()
        })
      }}
    >
      {isActive ? "Deactivate Account" : "Reactivate Account"}
    </Button>
  )
}
