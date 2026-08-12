"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FORMATION_TYPE_TAG, FORMATION_ROLE_LABEL } from "@/lib/formation-labels"
import {
  CREATABLE_FORMATION_TYPES,
  FORMATION_ROLES,
  renameFormationSchema,
} from "@/lib/validation/formation"
import { moveFormationAction, renameFormationAction } from "@/lib/actions/formations"
import type { FormationPickerOption } from "@/lib/formation"

/**
 * Renaming a formation and moving it in the tree.
 *
 * Kept in one dialog because they are the same task from the user's side
 * ("fix this formation's details"), but they are two separate server
 * actions: a rename is routine, while re-parenting changes who can see an
 * entire subtree's returns, so it is confirmed separately and refuses moves
 * that would detach a branch.
 */
export function EditFormationButton({
  formation,
  parentOptions,
}: {
  formation: {
    id: string
    name: string
    type: string
    role: string | null
    attachedTo: string | null
    parentId: string | null
  }
  /** Candidate parents, already limited to the caller's scope. */
  parentOptions: FormationPickerOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [type, setType] = useState(formation.type)
  const [role, setRole] = useState(formation.role ?? "")
  const [parentId, setParentId] = useState(formation.parentId ?? "")

  const isRoot = formation.type === "ROOT"
  // Can't report to itself, and can't report to anything inside its own
  // subtree — the server refuses those too, this just avoids offering them.
  const candidates = parentOptions.filter((o) => o.id !== formation.id)
  const parentChanged = parentId !== (formation.parentId ?? "")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Edit Formation
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {formation.name}</DialogTitle>
          <DialogDescription>
            Rename it, correct its type, or move it to report to a different formation.
          </DialogDescription>
        </DialogHeader>

        <Form
          errors={errors}
          onFormSubmit={(values) => {
            setFormError(null)
            const result = renameFormationSchema.safeParse({ ...values, type, role })
            if (!result.success) {
              setErrors(z.flattenError(result.error).fieldErrors as Record<string, string | string[]>)
              return
            }
            setErrors({})

            startTransition(async () => {
              const renamed = await renameFormationAction(formation.id, result.data)
              if ("error" in renamed) {
                setFormError(renamed.error)
                if (renamed.fieldErrors) {
                  setErrors(renamed.fieldErrors as Record<string, string | string[]>)
                }
                return
              }

              // Only issued when the parent actually changed, so an ordinary
              // rename never risks the move path's failure modes.
              if (parentChanged && parentId) {
                const moved = await moveFormationAction(formation.id, { parentId })
                if ("error" in moved) {
                  // The rename already succeeded, so say so rather than
                  // implying the whole edit failed.
                  setFormError(`Renamed, but not moved: ${moved.error}`)
                  router.refresh()
                  return
                }
              }

              toast.success(parentChanged ? "Formation updated and moved." : "Formation updated.")
              setOpen(false)
              router.refresh()
            })
          }}
          className="grid gap-4"
        >
          <Field name="name">
            <FieldLabel>Name</FieldLabel>
            <Input name="name" defaultValue={formation.name} autoFocus />
            <FieldError />
          </Field>

          <Field name="type">
            <FieldLabel>Type</FieldLabel>
            <Select value={type} onValueChange={(v) => setType(v ?? type)} disabled={isRoot}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {CREATABLE_FORMATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FORMATION_TYPE_TAG[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isRoot && (
              <FieldDescription>
                The root formation&apos;s type is fixed. It can still be renamed.
              </FieldDescription>
            )}
            <FieldError />
          </Field>

          <Field name="role">
            <FieldLabel>Role (optional)</FieldLabel>
            <Select value={role || "none"} onValueChange={(v) => setRole(!v || v === "none" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role</SelectItem>
                {FORMATION_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {FORMATION_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError />
          </Field>

          {type === "BRIGADE_SIGNALS" && (
            <Field name="attachedTo">
              <FieldLabel>Attached To</FieldLabel>
              <Input
                name="attachedTo"
                defaultValue={formation.attachedTo ?? ""}
                placeholder="e.g. 4 Mechanised Infantry Brigade"
              />
              <FieldDescription>
                The formation it supports operationally. This is not a chain-of-command change.
              </FieldDescription>
              <FieldError />
            </Field>
          )}

          {!isRoot && (
            <Field name="parentId">
              <FieldLabel>Reports To</FieldLabel>
              <Select value={parentId} onValueChange={(v) => setParentId(v ?? parentId)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a parent formation" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {parentChanged
                  ? "This moves the formation and everything under it, changing who can see its returns."
                  : "Chain of command. Moving a formation takes its subordinates with it."}
              </FieldDescription>
              <FieldError />
            </Field>
          )}

          {formError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : parentChanged ? "Save and Move" : "Save Changes"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
