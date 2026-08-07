import type { Role } from "@prisma/client"
import type { DefaultSession } from "next-auth"

// Augments Auth.js's built-in types with the fields NAERMS actually needs
// on every request: role and formationId drive every access-scope check,
// so they live on the session/JWT itself rather than requiring a DB hit
// per request just to know who's asking.
declare module "next-auth" {
  interface User {
    serviceId: string
    role: Role
    formationId: string
    formationName: string
    rank: string | null
  }

  interface Session {
    user: {
      id: string
      serviceId: string
      role: Role
      formationId: string
      formationName: string
      rank: string | null
    } & DefaultSession["user"]
  }
}

// `next-auth/jwt` only re-exports `JWT` via `export *` from `@auth/core/jwt`
// (where the interface is actually declared) — augmenting the re-exporting
// module doesn't merge into the real interface, so the callback's `token`
// falls back to `JWT`'s `Record<string, unknown>` base for these fields.
// Augmenting the origin module is what actually merges.
declare module "@auth/core/jwt" {
  interface JWT {
    userId: string
    serviceId: string
    role: Role
    formationId: string
    formationName: string
    rank: string | null
  }
}
