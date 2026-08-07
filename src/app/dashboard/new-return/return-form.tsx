"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

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
import { Card, CardContent } from "@/components/ui/card"
import {
  BANDS,
  DEPLOYMENT_MODES,
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_TYPES,
  returnFormSchema,
  type ReturnFormInput,
  type ReturnItemInput,
} from "@/lib/validation/return"
import { CONDITION_LABEL } from "@/lib/status"
import { createReturnAction, updateReturnAction } from "@/lib/actions/returns"

const EMPTY_ITEM: ReturnItemInput = {
  equipmentName: "",
  equipmentModel: "",
  band: "",
  equipmentType: "",
  equipmentSerial: "",
  origin: "",
  condition: "",
  remarks: "",
}

type Props =
  | { mode: "create"; defaultOrigin: string | null }
  | { mode: "edit"; returnId: string; initialValues: Omit<ReturnFormInput, "items">; initialItems: ReturnItemInput[] }

export function ReturnForm(props: Props) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [itemErrors, setItemErrors] = useState<Record<number, Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [items, setItems] = useState<ReturnItemInput[]>(
    props.mode === "edit" && props.initialItems.length > 0
      ? props.initialItems
      : [{ ...EMPTY_ITEM, origin: props.mode === "create" ? props.defaultOrigin ?? "" : "" }]
  )

  const initial = props.mode === "edit" ? props.initialValues : undefined

  function updateItem(index: number, patch: Partial<ReturnItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { ...EMPTY_ITEM, origin: props.mode === "create" ? props.defaultOrigin ?? "" : "" },
    ])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Form
      errors={errors}
      onFormSubmit={(values) => {
        setFormError(null)
        const result = returnFormSchema.safeParse({ ...values, items })
        if (!result.success) {
          const flat = z.flattenError(result.error)
          setErrors(flat.fieldErrors as Record<string, string | string[]>)
          const perItem: Record<number, Record<string, string>> = {}
          for (const issue of result.error.issues) {
            if (issue.path[0] === "items" && typeof issue.path[1] === "number") {
              const idx = issue.path[1]
              const field = String(issue.path[2] ?? "")
              perItem[idx] = { ...perItem[idx], [field]: issue.message }
            }
          }
          setItemErrors(perItem)
          if (Object.keys(perItem).length > 0) {
            toast.error("Check the highlighted equipment items.")
          }
          return
        }
        setErrors({})
        setItemErrors({})
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
          router.push(props.mode === "create" ? "/dashboard" : `/dashboard/returns/${res.id}`)
          router.refresh()
        })
      }}
      className="grid gap-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="requestRef">
          <FieldLabel>Request Ref</FieldLabel>
          <Input name="requestRef" defaultValue={initial?.requestRef} required />
          <FieldError />
        </Field>
        <Field name="auth">
          <FieldLabel>Auth</FieldLabel>
          <Input name="auth" defaultValue={initial?.auth} />
          <FieldError />
        </Field>
        <Field name="dateIssued">
          <FieldLabel>Date Issued</FieldLabel>
          <Input type="date" name="dateIssued" defaultValue={initial?.dateIssued} />
          <FieldError />
        </Field>
        <Field name="howDeployed">
          <FieldLabel>How Deployed</FieldLabel>
          <Select name="howDeployed" defaultValue={initial?.howDeployed}>
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
        <Input name="purposeOfIssue" defaultValue={initial?.purposeOfIssue} />
        <FieldError />
      </Field>

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Equipment Items ({items.length})</p>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="size-3.5" />
            Add Equipment
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <Card key={index}>
              <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
                <div className="flex items-center justify-between sm:col-span-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Item {index + 1}
                  </p>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(index)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Equipment Name</label>
                  <Input
                    value={item.equipmentName}
                    onChange={(e) => updateItem(index, { equipmentName: e.target.value })}
                    required
                  />
                  {itemErrors[index]?.equipmentName && (
                    <p className="text-sm text-destructive">{itemErrors[index].equipmentName}</p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Equipment Model</label>
                  <Input
                    value={item.equipmentModel}
                    onChange={(e) => updateItem(index, { equipmentModel: e.target.value })}
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Band</label>
                  <Select
                    value={item.band || undefined}
                    onValueChange={(v) => updateItem(index, { band: v as ReturnItemInput["band"] })}
                  >
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
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Equipment Type</label>
                  <Select
                    value={item.equipmentType || undefined}
                    onValueChange={(v) => updateItem(index, { equipmentType: v as ReturnItemInput["equipmentType"] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Equipment Serial</label>
                  <Input
                    value={item.equipmentSerial}
                    onChange={(e) => updateItem(index, { equipmentSerial: e.target.value })}
                    required
                  />
                  {itemErrors[index]?.equipmentSerial && (
                    <p className="text-sm text-destructive">{itemErrors[index].equipmentSerial}</p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Origin</label>
                  <Input
                    value={item.origin}
                    onChange={(e) => updateItem(index, { origin: e.target.value })}
                  />
                  {props.mode === "create" && props.defaultOrigin && index === 0 && (
                    <FieldDescription>
                      Pre-filled from your formation&apos;s attachment ({props.defaultOrigin}).
                    </FieldDescription>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Condition</label>
                  <Select
                    value={item.condition || undefined}
                    onValueChange={(v) => updateItem(index, { condition: v as ReturnItemInput["condition"] })}
                  >
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
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <label className="text-sm font-medium">Remarks</label>
                  <Textarea
                    rows={2}
                    value={item.remarks}
                    onChange={(e) => updateItem(index, { remarks: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

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
