import { z } from "zod"

// Mirrors the enums in prisma/schema.prisma. Kept as literal Zod arrays
// (rather than importing the Prisma enum objects) so this file has no
// dependency on the Prisma client and can be safely imported from client
// components for form validation. These are also just *suggestions* now —
// Band and Equipment Type accept free text via a datalist, so a value
// outside this list is not an error.
export const EQUIPMENT_TYPES = [
  "Radio",
  "Antenna",
  "Switchboard",
  "Cable/Line Equipment",
  "Power Supply Unit",
  "Encryption Device",
  "Test Equipment",
  "Other",
] as const

export const BANDS = ["HF", "VHF", "UHF", "SHF", "N/A"] as const

export const DEPLOYMENT_MODES = [
  "Field Exercise",
  "Static - HQ",
  "Attached Ops",
  "Training",
  "Workshop/Repair",
  "Store - Not Deployed",
] as const

export const EQUIPMENT_CONDITIONS = [
  "SERVICEABLE",
  "UNSERVICEABLE",
  "UNDER_REPAIR",
  "AWAITING_EVACUATION",
] as const

export const RETURN_STATUSES = [
  "PENDING",
  "VERIFIED",
  "DISCREPANCY",
  "RETURNED",
  "CLOSED",
] as const

// Base UI's <Select> always submits its hidden input's value, which is ""
// (not absent) when nothing is picked — so every optional select field must
// accept "" alongside its real enum values, not just `undefined`.
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().or(z.literal(""))

// One equipment line within a request. Date issued / deployment mode /
// purpose live per item (not per request), since different lines in the
// same submission can genuinely differ on all three. There's no serial —
// a line represents however many units of this equipment are in
// possession, tracked as a quantity + per-condition breakdown, not one
// serialised unit. Band and Equipment Type are free text (a datalist just
// suggests the common values), so no enum validation on those either.
export const returnItemSchema = z
  .object({
    dateIssued: z.string().optional().or(z.literal("")), // yyyy-mm-dd from <input type="date">
    howDeployed: optionalEnum(DEPLOYMENT_MODES),
    purposeOfIssue: z.string().trim().optional().or(z.literal("")),

    equipmentName: z.string().trim().min(1, "Equipment name is required"),
    equipmentModel: z.string().trim().optional().or(z.literal("")),
    band: z.string().trim().optional().or(z.literal("")),
    equipmentType: z.string().trim().optional().or(z.literal("")),
    origin: z.string().trim().optional().or(z.literal("")),

    quantity: z.number().int().min(1, "At least 1"),
    serviceableQty: z.number().int().min(0).default(0),
    unserviceableQty: z.number().int().min(0).default(0),
    underRepairQty: z.number().int().min(0).default(0),
    awaitingEvacuationQty: z.number().int().min(0).default(0),
    remarks: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    (item) =>
      item.serviceableQty + item.unserviceableQty + item.underRepairQty + item.awaitingEvacuationQty ===
      item.quantity,
    {
      message: "Condition breakdown must add up to the total quantity",
      path: ["quantity"],
    }
  )

export type ReturnItemInput = z.infer<typeof returnItemSchema>

// The pre-refine shape (no cross-field check yet) — useful as the type for
// form state, since intermediate edits legitimately don't sum correctly yet.
export type ReturnItemDraft = z.input<typeof returnItemSchema>

// The request-level fields, shared by every item, plus the list of
// equipment lines. formationId is derived from the session server-side,
// never taken from client input.
export const returnFormSchema = z.object({
  requestRef: z.string().trim().min(1, "Request ref is required"),
  auth: z.string().trim().optional().or(z.literal("")),
  items: z.array(returnItemSchema).min(1, "Add at least one equipment item"),
})

export type ReturnFormInput = z.infer<typeof returnFormSchema>

// ---------------------------------------------------------------------
// DRAFTS
// ---------------------------------------------------------------------

// A draft is explicitly allowed to be incomplete — that is the entire point
// of saving one. So the item rules drop to "shape must be right", with none
// of the completeness checks the submit path enforces: no required
// equipment name, no min-1 quantity, and crucially no cross-field refine
// that the condition breakdown sums to the quantity (a half-entered item
// almost never sums yet). Those are re-applied in full by
// `returnFormSchema` when the draft is finally submitted, so an incomplete
// draft can be stored but never filed into the register.
export const returnItemDraftSchema = z.object({
  dateIssued: z.string().optional().or(z.literal("")),
  howDeployed: optionalEnum(DEPLOYMENT_MODES),
  purposeOfIssue: z.string().trim().optional().or(z.literal("")),

  equipmentName: z.string().trim().optional().or(z.literal("")),
  equipmentModel: z.string().trim().optional().or(z.literal("")),
  band: z.string().trim().optional().or(z.literal("")),
  equipmentType: z.string().trim().optional().or(z.literal("")),
  origin: z.string().trim().optional().or(z.literal("")),

  quantity: z.number().int().min(0).default(0),
  serviceableQty: z.number().int().min(0).default(0),
  unserviceableQty: z.number().int().min(0).default(0),
  underRepairQty: z.number().int().min(0).default(0),
  awaitingEvacuationQty: z.number().int().min(0).default(0),
  remarks: z.string().trim().optional().or(z.literal("")),
})

// Request Ref is the one field a draft still needs: it's how the clerk (and
// the resume list) tells one draft from another. Everything else can wait.
export const returnDraftSchema = z.object({
  requestRef: z.string().trim().min(1, "Request ref is required to save a draft"),
  auth: z.string().trim().optional().or(z.literal("")),
  items: z.array(returnItemDraftSchema),
})

export type ReturnDraftInput = z.infer<typeof returnDraftSchema>

export const statusChangeSchema = z.object({
  returnItemId: z.string().min(1),
  toStatus: z.enum(RETURN_STATUSES),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
})

export type StatusChangeInput = z.infer<typeof statusChangeSchema>
