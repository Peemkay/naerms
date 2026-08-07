"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"

import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BANDS,
  DEPLOYMENT_MODES,
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_TYPES,
  returnFormSchema,
  type ReturnFormInput,
} from "@/lib/validation/return"
import { CONDITION_LABEL } from "@/lib/status"
import { createReturnAction, updateReturnAction } from "@/lib/actions/returns"

type Props =
  | { mode: "create"; defaultOrigin: string | null }
  | { mode: "edit"; returnId: string; initialValues: Partial<ReturnFormInput> }

export function ReturnForm(props: Props) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const initial: Partial<ReturnFormInput> =
    props.mode === "create" ? { origin: props.defaultOrigin ?? "" } : props.initialValues

  return (
    <Form
      errors={errors}
      onFormSubmit={(values) => {
        setFormError(null)
        const result = returnFormSchema.safeParse(values)
        if (!result.success) {
          setErrors(z.flattenError(result.error).fieldErrors as Record<string, string | string[]>)
          return
        }
        setErrors({})
        startTransition(async () => {
          const res =
            props.mode === "create"
              ? await createReturnAction(result.data)
              : await updateReturnAction(props.returnId, result.data)

          if ("error" in res) {
            setFormError(res.error)
            if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string | string[]>)
            return
          }

          toast.success(props.mode === "create" ? "Return submitted." : "Return updated.")
          router.push(props.mode === "create" ? "/portal" : `/returns/${props.returnId}`)
          router.refresh()
        })
      }}
      className="grid gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="requestRef">
          <FieldLabel>Request Ref</FieldLabel>
          <Input name="requestRef" defaultValue={initial.requestRef} required />
          <FieldError />
        </Field>
        <Field name="auth">
          <FieldLabel>Auth</FieldLabel>
          <Input name="auth" defaultValue={initial.auth} />
          <FieldError />
        </Field>
        <Field name="dateIssued">
          <FieldLabel>Date Issued</FieldLabel>
          <Input type="date" name="dateIssued" defaultValue={initial.dateIssued} />
          <FieldError />
        </Field>
        <Field name="howDeployed">
          <FieldLabel>How Deployed</FieldLabel>
          <Select name="howDeployed" defaultValue={initial.howDeployed}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select deployment mode" />
            </SelectTrigger>
            <SelectContent>
              {DEPLOYMENT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError />
        </Field>
      </div>

      <Field name="purposeOfIssue">
        <FieldLabel>Purpose of Issue</FieldLabel>
        <Input name="purposeOfIssue" defaultValue={initial.purposeOfIssue} />
        <FieldError />
      </Field>

      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <Field name="equipmentName">
          <FieldLabel>Equipment Name</FieldLabel>
          <Input name="equipmentName" defaultValue={initial.equipmentName} required />
          <FieldError />
        </Field>
        <Field name="equipmentModel">
          <FieldLabel>Equipment Model</FieldLabel>
          <Input name="equipmentModel" defaultValue={initial.equipmentModel} />
          <FieldError />
        </Field>
        <Field name="band">
          <FieldLabel>Band</FieldLabel>
          <Select name="band" defaultValue={initial.band}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select band" />
            </SelectTrigger>
            <SelectContent>
              {BANDS.map((band) => (
                <SelectItem key={band} value={band}>
                  {band}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError />
        </Field>
        <Field name="equipmentType">
          <FieldLabel>Equipment Type</FieldLabel>
          <Select name="equipmentType" defaultValue={initial.equipmentType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError />
        </Field>
        <Field name="equipmentSerial">
          <FieldLabel>Equipment Serial</FieldLabel>
          <Input name="equipmentSerial" defaultValue={initial.equipmentSerial} required />
          <FieldError />
        </Field>
        <Field name="origin">
          <FieldLabel>Origin</FieldLabel>
          <Input name="origin" defaultValue={initial.origin} />
          {props.mode === "create" && props.defaultOrigin && (
            <FieldDescription>
              Pre-filled from your formation&apos;s attachment ({props.defaultOrigin}) — override if this issue came from elsewhere.
            </FieldDescription>
          )}
          <FieldError />
        </Field>
      </div>

      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <Field name="condition">
          <FieldLabel>Condition</FieldLabel>
          <Select name="condition" defaultValue={initial.condition}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_CONDITIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CONDITION_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError />
        </Field>
      </div>

      <Field name="remarks">
        <FieldLabel>Remarks</FieldLabel>
        <Textarea name="remarks" rows={3} defaultValue={initial.remarks} />
        <FieldError />
      </Field>

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : props.mode === "create" ? "Submit Return" : "Save Changes"}
        </Button>
      </div>
    </Form>
  )
}
