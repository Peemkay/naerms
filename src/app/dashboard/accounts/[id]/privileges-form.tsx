"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Privilege } from "@prisma/client"

import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { PRIVILEGE_DESCRIPTIONS, PRIVILEGE_LABELS } from "@/lib/privileges"
import { setPrivilegesAction } from "@/lib/actions/formations"

export function PrivilegesForm({
  formationId,
  assignablePrivileges,
  currentPrivileges,
}: {
  formationId: string
  assignablePrivileges: Privilege[]
  currentPrivileges: Privilege[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Privilege[]>(
    currentPrivileges.filter((p) => assignablePrivileges.includes(p))
  )
  const [pending, startTransition] = useTransition()

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {assignablePrivileges.map((p) => (
          <label key={p} className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox
              checked={selected.includes(p)}
              onCheckedChange={(checked) =>
                setSelected((prev) => (checked ? [...prev, p] : prev.filter((x) => x !== p)))
              }
            />
            <span>
              <span className="font-medium">{PRIVILEGE_LABELS[p]}</span>
              <span className="block text-xs text-muted-foreground">{PRIVILEGE_DESCRIPTIONS[p]}</span>
            </span>
          </label>
        ))}
      </div>
      <Button
        disabled={pending}
        className="justify-self-start"
        onClick={() => {
          startTransition(async () => {
            const res = await setPrivilegesAction(formationId, { privileges: selected })
            if ("error" in res) {
              toast.error(res.error)
              return
            }
            toast.success("Privileges updated.")
            router.refresh()
          })
        }}
      >
        {pending ? "Saving…" : "Save Privileges"}
      </Button>
    </div>
  )
}
