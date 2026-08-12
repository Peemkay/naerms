"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

import { useLocalDraft } from "@/lib/use-local-draft"
import { ReturnIoButtons } from "@/components/return-io-buttons"

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
import { CONDITION_SHEET_LABEL } from "@/lib/sheet/columns"
import { quantityFromName } from "@/lib/return-io"
import { createReturnAction, updateReturnAction, saveDraftAction } from "@/lib/actions/returns"

const EMPTY_ITEM: ReturnItemDraft = {
  letterOfRequest: "",
  authority: "",
  dateIssued: "",
  fmnUnitIssued: "",
  howDeployed: "",
  purposeOfIssue: "",
  equipmentName: "",
  equipmentModel: "",
  band: "",
  equipmentType: "",
  equipmentSerial: "",
  origin: "",
  quantity: 1,
  serviceableQty: 1,
  unserviceableQty: 0,
  underRepairQty: 0,
  awaitingEvacuationQty: 0,
  remarks: "",
}

type Props =
  | {
      mode: "create"
      defaultOrigin: string | null
      defaultRequestRef?: string
      /** Scopes autosave storage so two accounts on one machine stay separate. */
      formationId: string
      /** Set when resuming a saved draft: subsequent saves update it in place. */
      draftId?: string
      draftValues?: Omit<ReturnFormInput, "items">
      draftItems?: ReturnItemDraft[]
    }
  | { mode: "edit"; returnId: string; initialValues: Omit<ReturnFormInput, "items">; initialItems: ReturnItemDraft[] }

/**
 * The one condition a line is in. The register has a single Status column,
 * so an item's whole quantity always sits in exactly one bucket; this reads
 * back whichever that is (defaulting to Serviceable for a fresh item).
 */
function conditionOfItem(item: ReturnItemDraft): (typeof EQUIPMENT_CONDITIONS)[number] {
  if ((item.unserviceableQty ?? 0) > 0) return "UNSERVICEABLE"
  if ((item.underRepairQty ?? 0) > 0) return "UNDER_REPAIR"
  if ((item.awaitingEvacuationQty ?? 0) > 0) return "AWAITING_EVACUATION"
  return "SERVICEABLE"
}

export function ReturnForm(props: Props) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string | string[]>>({})
  const [itemErrors, setItemErrors] = useState<Record<number, Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [savingDraft, startDraftTransition] = useTransition()

  const initial =
    props.mode === "edit"
      ? props.initialValues
      : props.draftValues

  // Header fields are controlled (not defaultValue) so autosave can observe
  // them — an uncontrolled input's value never reaches React state, which
  // would leave Request Ref and Auth out of every recovered draft.
  const [requestRef, setRequestRef] = useState(
    initial?.requestRef ?? (props.mode === "create" ? props.defaultRequestRef ?? "" : "")
  )
  const [auth, setAuth] = useState(initial?.auth ?? "")

  const [items, setItems] = useState<ReturnItemDraft[]>(() => {
    if (props.mode === "edit" && props.initialItems.length > 0) return props.initialItems
    if (props.mode === "create" && props.draftItems && props.draftItems.length > 0) {
      return props.draftItems
    }
    return [{ ...EMPTY_ITEM, origin: props.mode === "create" ? props.defaultOrigin ?? "" : "" }]
  })

  // Server draft this form is bound to. Starts from the resumed draft (if
  // any) and is set on first save, so repeated saves update one row.
  const [draftId, setDraftId] = useState<string | undefined>(
    props.mode === "create" ? props.draftId : undefined
  )
  const [submitted, setSubmitted] = useState(false)

  // Local autosave: the only layer that survives a power cut or a dead
  // network, since both of those make a server save impossible. Only on the
  // create path — editing a filed return is a different, deliberate act.
  const { recovered, savedAt, clear: clearLocalDraft } = useLocalDraft({
    formKey: props.mode === "create" ? `new-return:${props.draftId ?? "new"}` : "noop",
    formationId: props.mode === "create" ? props.formationId : "noop",
    values: { requestRef, auth, items },
    enabled: props.mode === "create" && !submitted,
  })

  // Offered, never auto-applied: silently overwriting what's on screen with
  // older recovered text would be worse than the data loss it prevents.
  const [restorable, setRestorable] = useState(
    props.mode === "create" && recovered !== null && recovered.savedAt > 0
  )

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

  /**
   * Saves a draft without filing it into the register. Deliberately skips
   * the full submit validation: a half-finished item is exactly what a
   * draft is for. Only Request Ref is required, since that's how the clerk
   * identifies the draft when resuming it.
   */
  function saveDraft({ thenExit }: { thenExit: boolean }) {
    if (props.mode !== "create") return
    if (!requestRef.trim()) {
      setFormError("Enter a Request Ref before saving. It's how you'll find this draft again.")
      return
    }
    setFormError(null)
    startDraftTransition(async () => {
      const res = await saveDraftAction({ requestRef, auth, items }, draftId)
      if ("error" in res) {
        // The local autosave still holds this work, so nothing is lost —
        // say so, because "save failed" on a returns register otherwise
        // reads as "your work is gone".
        setFormError(`${res.error} Your work is still saved on this device.`)
        return
      }
      setDraftId(res.id)
      toast.success(thenExit ? "Draft saved." : "Draft saved. Keep going.")
      if (thenExit) {
        clearLocalDraft()
        router.push("/dashboard")
        router.refresh()
      } else {
        router.refresh()
      }
    })
  }

  return (
    <Form
      errors={errors}
      onFormSubmit={(values) => {
        setFormError(null)
        const result = returnFormSchema.safeParse({ ...values, requestRef, auth, items })
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
              ? // Promotes the saved draft in place when there is one, so
                // submitting a resumed draft doesn't leave the draft behind
                // as a duplicate of the return just filed.
                await createReturnAction(result.data, draftId)
              : await updateReturnAction(props.returnId, result.data)

          if ("error" in res) {
            setFormError(res.error)
            if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string | string[]>)
            return
          }

          // Filed successfully: stop autosaving and drop the local copy, or
          // the next visit would offer to restore an already-submitted return.
          setSubmitted(true)
          clearLocalDraft()
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
      <datalist id="deployment-options">
        {DEPLOYMENT_MODES.map((mode) => (
          <option key={mode} value={mode} />
        ))}
      </datalist>
      <datalist id="equipment-type-options">
        {EQUIPMENT_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {/* Unsent work found on this device — from a power cut, a crash, or a
          tab closed mid-entry. Offered rather than applied, so it can never
          overwrite what the clerk is looking at. */}
      {restorable && recovered && (
        <div className="grid gap-2 rounded-lg border border-brand-gold bg-brand-gold/10 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm">
            <span className="font-medium">Unsaved work found on this device.</span>{" "}
            <span className="text-muted-foreground">
              Last edited {new Date(recovered.savedAt).toLocaleString("en-GB")}.
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setRequestRef(recovered.values.requestRef ?? "")
                setAuth(recovered.values.auth ?? "")
                if (recovered.values.items?.length > 0) setItems(recovered.values.items)
                setRestorable(false)
                toast.success("Restored.")
              }}
            >
              Restore
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                clearLocalDraft()
                setRestorable(false)
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="requestRef">
          <FieldLabel>Request Ref</FieldLabel>
          <Input
            name="requestRef"
            value={requestRef}
            onChange={(e) => setRequestRef(e.target.value)}
            required
          />
          <FieldError />
        </Field>
        <Field name="auth">
          <FieldLabel>Auth</FieldLabel>
          <Input name="auth" value={auth} onChange={(e) => setAuth(e.target.value)} />
          <FieldError />
        </Field>
      </div>

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Equipment Items ({items.length})</p>
          <div className="flex flex-wrap items-center gap-2">
            <ReturnIoButtons
              items={items}
              requestRef={requestRef}
              disabled={pending || savingDraft}
              onImport={(imported, mode) =>
                setItems((prev) =>
                  mode === "append"
                    ? [...prev.filter((item) => item.equipmentName.trim() !== ""), ...imported]
                    : imported
                )
              }
            />
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="size-3.5" />
              Add Equipment
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, index) => {
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
                    <label className="text-sm font-medium">Letter of Request</label>
                    <Input
                      value={item.letterOfRequest}
                      onChange={(e) => updateItem(index, { letterOfRequest: e.target.value })}
                      placeholder="NIL"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Authority</label>
                    <Input
                      value={item.authority}
                      onChange={(e) => updateItem(index, { authority: e.target.value })}
                      placeholder="e.g. HQ NAS/SOC"
                    />
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
                    <label className="text-sm font-medium">Fmn/Unit Issued</label>
                    <Input
                      value={item.fmnUnitIssued}
                      onChange={(e) => updateItem(index, { fmnUnitIssued: e.target.value })}
                      placeholder="e.g. NISIGS ESSMGB"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">How Depl</label>
                    <Input
                      list="deployment-options"
                      value={item.howDeployed}
                      onChange={(e) => updateItem(index, { howDeployed: e.target.value })}
                      placeholder="Mode or location, e.g. Bissau"
                    />
                  </div>

                  <div className="grid gap-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">Purpose of Issue</label>
                    <Input
                      value={item.purposeOfIssue}
                      onChange={(e) => updateItem(index, { purposeOfIssue: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Eqpt Name</label>
                    <Input
                      value={item.equipmentName}
                      onChange={(e) => {
                        // The register carries quantity in the name itself
                        // ("32 X RF 5800 Btys"), so the count follows what's
                        // typed here and moves with the chosen Status.
                        const equipmentName = e.target.value
                        const quantity = quantityFromName(equipmentName)
                        const condition = conditionOfItem(item)
                        updateItem(index, {
                          equipmentName,
                          quantity,
                          serviceableQty: condition === "SERVICEABLE" ? quantity : 0,
                          unserviceableQty: condition === "UNSERVICEABLE" ? quantity : 0,
                          underRepairQty: condition === "UNDER_REPAIR" ? quantity : 0,
                          awaitingEvacuationQty: condition === "AWAITING_EVACUATION" ? quantity : 0,
                        })
                      }}
                      placeholder="e.g. 32 X RF 5800 Btys"
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
                    <label className="text-sm font-medium">Eqpt Serial</label>
                    <Input
                      value={item.equipmentSerial}
                      onChange={(e) => updateItem(index, { equipmentSerial: e.target.value })}
                      placeholder="e.g. ESSMGB-01"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Origin</label>
                    <Input
                      value={item.origin}
                      onChange={(e) => updateItem(index, { origin: e.target.value })}
                    />
                  </div>

                  {/* One Status per line, matching the register's single
                      column. Quantity isn't asked for separately: the
                      register writes it into the equipment name ("32 X RF
                      5800 Btys"), so it's parsed from there and the whole
                      count sits in the one condition chosen here. */}
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      value={conditionOfItem(item)}
                      onValueChange={(v) => setAllAsCondition(index, v as (typeof EQUIPMENT_CONDITIONS)[number])}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CONDITION_SHEET_LABEL[c]} ({CONDITION_LABEL[c]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {itemErrors[index]?.quantity && (
                      <p className="text-sm text-destructive">{itemErrors[index].quantity}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} unit(s), from the equipment name.
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

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Autosave status. Reassurance that leaving now is safe is the
            whole point of the feature, so it's stated plainly rather than
            hidden behind an icon. */}
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {props.mode === "create" &&
            (savedAt
              ? `Autosaved on this device at ${new Date(savedAt).toLocaleTimeString("en-GB")}.`
              : "Your work is autosaved on this device as you type.")}
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          {props.mode === "create" && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending || savingDraft}
                onClick={() => saveDraft({ thenExit: true })}
              >
                {savingDraft ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || savingDraft}
                onClick={() => saveDraft({ thenExit: false })}
              >
                {savingDraft ? "Saving…" : "Save and Continue"}
              </Button>
            </>
          )}
          <Button type="submit" disabled={pending || savingDraft}>
            {pending ? "Submitting…" : props.mode === "create" ? "Submit Return" : "Save Changes"}
          </Button>
        </div>
      </div>
    </Form>
  )
}
