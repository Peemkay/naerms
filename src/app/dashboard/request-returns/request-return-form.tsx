"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"

import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { requestReturnAction } from "@/lib/actions/return-requests"
import type { FormationGroup } from "@/lib/formation"

const requestReturnSchema = z.object({
  toFormationIds: z.array(z.string()).min(1, "Pick at least one formation"),
})

/**
 * Asking one or more formations for a return.
 *
 * Request Ref and Message are gone: the only decision here is who to ask.
 * A reference is generated server-side so both sides still have one to
 * match the response against, without the clerk inventing a format.
 *
 * The picker lists each formation's own name only, grouped under the HQ it
 * reports to, mirroring how the register is laid out on paper. The full
 * chain-of-command path made every row unreadable, and the grouping already
 * conveys who sits under whom.
 */
export function RequestReturnForm({ groups }: { groups: FormationGroup[] }) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string[]>([])

  const allIds = groups.flatMap((g) => g.members.map((m) => m.id))
  // The same formation can appear as both a block head and a member of its
  // parent's block, so count distinct ids rather than rows.
  const uniqueIds = [...new Set(allIds)]
  const allSelected = uniqueIds.length > 0 && selected.length === uniqueIds.length

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <Form
      errors={errors}
      onFormSubmit={() => {
        setFormError(null)
        const result = requestReturnSchema.safeParse({ toFormationIds: selected })
        if (!result.success) {
          setErrors(z.flattenError(result.error).fieldErrors as Record<string, string | string[]>)
          return
        }
        setErrors({})
        startTransition(async () => {
          const res = await requestReturnAction(result.data)
          if ("error" in res) {
            setFormError(res.error)
            if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string | string[]>)
            return
          }

          toast.success(
            selected.length === 1 ? "Request sent." : `Request sent to ${selected.length} formations.`
          )

          // Straight to the sheet of the formation just asked, so the
          // requester can see what they already hold while waiting for the
          // response. With several asked at once there's no single sheet to
          // land on, so the dashboard is the honest destination.
          if (selected.length === 1) {
            router.push(`/dashboard/sheet?formation=${selected[0]}`)
          } else {
            router.push("/dashboard")
          }
          router.refresh()
        })
      }}
      className="grid gap-4"
    >
      <Field name="toFormationIds">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel>Request From</FieldLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uniqueIds.length === 0}
            onClick={() => setSelected(allSelected ? [] : uniqueIds)}
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-md border border-border">
          {groups.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No formations under you to request from.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.headingId} className="border-b border-border last:border-b-0">
                {group.members.map((member, index) => (
                  <label
                    key={`${group.headingId}:${member.id}`}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={selected.includes(member.id)}
                      onChange={() => toggle(member.id)}
                    />
                    {/* The block head reads as the heading it is; the units
                        under it are indented beneath, as on the register. */}
                    <span
                      className={
                        index === 0
                          ? "text-sm font-semibold"
                          : "pl-4 text-sm text-muted-foreground"
                      }
                    >
                      {member.name}
                    </span>
                  </label>
                ))}
              </div>
            ))
          )}
        </div>
        <FieldDescription>
          Any formation under you. {selected.length > 0 && `${selected.length} selected.`}
        </FieldDescription>
        <FieldError />
      </Field>

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={pending || uniqueIds.length === 0 || selected.length === 0}>
        {pending
          ? "Sending…"
          : selected.length > 1
            ? `Send Request to ${selected.length} Formations`
            : "Send Request"}
      </Button>
    </Form>
  )
}
