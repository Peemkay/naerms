"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
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
  type ReturnItemDraft,
} from "@/lib/validation/return"
import { CONDITION_LABEL } from "@/lib/status"
import { createReturnAction, updateReturnAction } from "@/lib/actions/returns"

const EMPTY_ITEM: ReturnItemDraft = {
  dateIssued: "",
  howDeployed: "",
  purposeOfIssue: "",
  equipmentName: "",
  equipmentModel: "",
  band: "",
  equipmentType: "",
  origin: "",
  quantity: 1,
  serviceableQty: 1,
  unserviceableQty: 0,
  underRepairQty: 0,
  awaitingEvacuationQty: 0,
  remarks: "",
}

type Props =
  | { mode: "create"; defaultOrigin: string | null; defaultRequestRef?: string }
  | { mode: "edit"; returnId: string; initialValues: Omit<ReturnFormInput, "items">; initialItems: ReturnItemDraft[] }

function breakdownSum(item: ReturnItemDraft) {
  return (
    (item.serviceableQty ?? 0) +
    (item.unserviceableQty ?? 0) +
    (item.underRepairQty ?? 0) +
    (item.awaitingEvacuationQty ?? 0)
  )
}

export function ReturnForm(props: Props) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [itemErrors, setItemErrors] = useState<Record<number, Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [items, setItems] = useState<ReturnItemDraft[]>(
    props.mode === "edit" && props.initialItems.length > 0
      ? props.initialItems
      : [{ ...EMPTY_ITEM, origin: props.mode === "create" ? props.defaultOrigin ?? "" : "" }]
  )

  const initial = props.mode === "edit" ? props.initialValues : undefined

  function updateItem(index: number, patch: Partial<ReturnItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  /** "Set all as [condition]" — dumps the whole quantity into one bucket. */
  function setAllAsCondition(index: number, condition: (typeof EQUIPMENT_CONDITIONS)[number]) {
    const item = items[index]
    const qty = item.quantity ?? 1
    updateItem(index, {
      serviceableQty: condition === "SERVICEABLE" ? qty : 0,
      unserviceableQty: condition === "UNSERVICEABLE" ? qty : 0,
      underRepairQty: condition === "UNDER_REPAIR" ? qty : 0,
      awaitingEvacuationQty: condition === "AWAITING_EVACUATION" ? qty : 0,
    })
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
      {/* Suggested values for Band / Equipment Type — free text, so typing
          anything not listed here just adds a new value for this item. */}
      <datalist id="band-options">
        {BANDS.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <datalist id="equipment-type-options">
        {EQUIPMENT_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="requestRef">
          <FieldLabel>Request Ref</FieldLabel>
          <Input
            name="requestRef"
            defaultValue={initial?.requestRef ?? (props.mode === "create" ? props.defaultRequestRef : undefined)}
            required
          />
          <FieldError />
        </Field>
        <Field name="auth">
          <FieldLabel>Auth</FieldLabel>
          <Input name="auth" defaultValue={initial?.auth} />
          <FieldError />
        </Field>
      </div>

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Equipment Items ({items.length})</p>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="size-3.5" />
            Add Equipment
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, index) => {
            const sum = breakdownSum(item)
            const remaining = (item.quantity ?? 0) - sum
            return (
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
                    <label className="text-sm font-medium">Date Issued</label>
                    <Input
                      type="date"
                      value={item.dateIssued}
                      onChange={(e) => updateItem(index, { dateIssued: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">How Deployed</label>
                    <Select
                      value={item.howDeployed || undefined}
                      onValueChange={(v) => updateItem(index, { howDeployed: v as ReturnItemDraft["howDeployed"] })}
                    >
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
                  </div>

                  <div className="grid gap-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">Purpose of Issue</label>
                    <Input
                      value={item.purposeOfIssue}
                      onChange={(e) => updateItem(index, { purposeOfIssue: e.target.value })}
                    />
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
                    <Input
                      list="band-options"
                      value={item.band}
                      onChange={(e) => updateItem(index, { band: e.target.value })}
                      placeholder="Select or type a new band"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Equipment Type</label>
                    <Input
                      list="equipment-type-options"
                      value={item.equipmentType}
                      onChange={(e) => updateItem(index, { equipmentType: e.target.value })}
                      placeholder="Select or type a new type"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Origin</label>
                    <Input
                      value={item.origin}
                      onChange={(e) => updateItem(index, { origin: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Quantity in Possession</label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const quantity = Math.max(1, Number(e.target.value) || 1)
                        // Keep a single-condition item in sync automatically;
                        // once it's a mixed breakdown, leave the split alone.
                        const wasSingleBucket = breakdownSum(item) === item.quantity
                        updateItem(index, wasSingleBucket ? { quantity, serviceableQty: quantity, unserviceableQty: 0, underRepairQty: 0, awaitingEvacuationQty: 0 } : { quantity })
                      }}
                    />
                    {itemErrors[index]?.quantity && (
                      <p className="text-sm text-destructive">{itemErrors[index].quantity}</p>
                    )}
                  </div>

                  <div className="col-span-full grid gap-2 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Condition Breakdown</p>
                      <Select onValueChange={(v) => setAllAsCondition(index, v as (typeof EQUIPMENT_CONDITIONS)[number])}>
                        <SelectTrigger size="sm" className="w-48">
                          <SelectValue placeholder="Set all as…" />
                        </SelectTrigger>
                        <SelectContent>
                          {EQUIPMENT_CONDITIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              All {CONDITION_LABEL[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {(
                        [
                          ["serviceableQty", "SERVICEABLE"],
                          ["unserviceableQty", "UNSERVICEABLE"],
                          ["underRepairQty", "UNDER_REPAIR"],
                          ["awaitingEvacuationQty", "AWAITING_EVACUATION"],
                        ] as const
                      ).map(([field, condition]) => (
                        <div key={field} className="grid gap-1">
                          <label className="text-xs text-muted-foreground">{CONDITION_LABEL[condition]}</label>
                          <Input
                            type="number"
                            min={0}
                            value={item[field]}
                            onChange={(e) => updateItem(index, { [field]: Math.max(0, Number(e.target.value) || 0) })}
                          />
                        </div>
                      ))}
                    </div>
                    <p className={remaining === 0 ? "text-xs text-muted-foreground" : "text-xs font-medium text-destructive"}>
                      {remaining === 0
                        ? `Accounted for all ${item.quantity ?? 0}.`
                        : remaining > 0
                          ? `${remaining} unit(s) not yet assigned a condition.`
                          : `${-remaining} unit(s) over the total quantity.`}
                    </p>
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
            )
          })}
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
