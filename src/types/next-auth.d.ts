import type { Privilege } from "@prisma/client"
import type { DefaultSession } from "next-auth"

// There's no separate User anymore — a Formation *is* the account. The
// session carries the formation's id and privileges directly, since every
// access-scope and capability check keys off those.
declare module "next-auth" {
  // `email`/`name` already exist (optional, nullable) on the base User —
  // only add the genuinely new field here to avoid a conflicting redeclare.
  interface User {
    privileges: Privilege[]
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      privileges: Privilege[]
    } & DefaultSession["user"]
  }
}

// `next-auth/jwt` only re-exports `JWT` via `export *` from `@auth/core/jwt`
// (where the interface is actually declared) — augmenting the re-exporting
// module doesn't merge into the real interface, so the callback's `token`
// falls back to `JWT`'s `Record<string, unknown>` base for these fields.
// Augmenting the origin module is what actually merges.
declare module "@auth/core/jwt" {
  // `email`/`name` already exist (optional, nullable) on the base JWT —
  // only add the genuinely new fields here to avoid a conflicting redeclare.
  interface JWT {
    formationId: string
    privileges: Privilege[]
  }
}
