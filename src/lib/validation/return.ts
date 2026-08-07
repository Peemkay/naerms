import { z } from "zod"

// Mirrors the enums in prisma/schema.prisma. Kept as literal Zod enums
// (rather than importing the Prisma enum objects) so this file has no
// dependency on the Prisma client and can be safely imported from client
// components for form validation.
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

// One equipment line within a request.
export const returnItemSchema = z.object({
  equipmentName: z.string().trim().min(1, "Equipment name is required"),
  equipmentModel: z.string().trim().optional().or(z.literal("")),
  band: optionalEnum(BANDS),
  equipmentType: optionalEnum(EQUIPMENT_TYPES),
  equipmentSerial: z.string().trim().min(1, "Equipment serial is required"),
  origin: z.string().trim().optional().or(z.literal("")),
  condition: optionalEnum(EQUIPMENT_CONDITIONS),
  remarks: z.string().trim().optional().or(z.literal("")),
})

export type ReturnItemInput = z.infer<typeof returnItemSchema>

// The register-level fields, shared by every item in the request, plus the
// list of equipment lines. formationId is derived from the session
// server-side, never taken from client input.
export const returnFormSchema = z.object({
  requestRef: z.string().trim().min(1, "Request ref is required"),
  auth: z.string().trim().optional().or(z.literal("")),
  dateIssued: z.string().optional().or(z.literal("")), // yyyy-mm-dd from <input type="date">
  howDeployed: optionalEnum(DEPLOYMENT_MODES),
  purposeOfIssue: z.string().trim().optional().or(z.literal("")),
  items: z.array(returnItemSchema).min(1, "Add at least one equipment item"),
})

export type ReturnFormInput = z.infer<typeof returnFormSchema>

export const statusChangeSchema = z.object({
  returnItemId: z.string().min(1),
  toStatus: z.enum(RETURN_STATUSES),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
})

export type StatusChangeInput = z.infer<typeof statusChangeSchema>
