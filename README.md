# NAERMS — Nigerian Army Signals Equipment Returns Management System

A portal for submitting and tracking equipment returns across the Signals
corps, with command-level rollup visibility. **Formations are the accounts**
— there is no separate user layer, and access is governed by individually
assignable privileges rather than a fixed role hierarchy.

## Tech stack

- **Next.js 16** (App Router, TypeScript, React 19)
- **PostgreSQL + Prisma 7** (driver-adapter architecture, `@prisma/adapter-neon`)
- **Auth.js (NextAuth) v5** — credentials login keyed on a formation's NAWANI email, JWT sessions
- **Tailwind CSS v4 + shadcn/ui** (`base-nova` style, built on Base UI primitives)
- **TanStack Table v9** for the sortable/filterable returns registry
- **Zod v4** for form and server-action validation

## Getting started

### 1. Prerequisites

- Node.js 20+
- A PostgreSQL database. The project is wired up for
  [Neon](https://neon.tech) (serverless Postgres, free tier) via
  `@prisma/adapter-neon`, but any Postgres 14+ instance works if you swap the
  adapter in `src/lib/prisma.ts` and `prisma/seed.ts` for `@prisma/adapter-pg`.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:

- `DATABASE_URL` — your Postgres connection string. **Neon note:** strip any
  `channel_binding=require` parameter from the pooled connection string —
  Prisma Migrate's engine can't complete the TLS handshake with it present.
  `sslmode=require` alone still gives you an encrypted connection.
- `AUTH_SECRET` — generate with `npx auth secret`, or any long random string.

The app fails fast with a clear error at startup if either is missing
(`src/lib/env.ts`).

### 3. Install, migrate, seed

```bash
npm install
npm run db:migrate   # applies prisma/schema.prisma, then runs the seed automatically
```

The seed creates exactly **two bootstrap formations, both with every
privilege** — everything else (the rest of the formation tree, every other
account, every return) is meant to be created through the app itself, not
via seed data:

| Formation | Email |
|---|---|
| Nigerian Army Signals (NAS) | nas@army.mil.ng |
| NAS Systems Administration | admin@army.mil.ng |

Passwords are randomly generated at seed time and printed once to the
console — copy them immediately, they aren't stored anywhere else. Re-running
`npm run db:seed` is safe; it no-ops if a ROOT formation already exists
rather than erroring.

If you ever need to rotate every account's password (e.g. after a seed
password leaked into a doc or a screenshot), run:

```bash
npm run db:rotate-passwords
```

### 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`, then to
`/dashboard` once signed in.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Run/generate Prisma migrations against `DATABASE_URL`, then seed |
| `npm run db:seed` | Re-run just the seed script (no-ops if already seeded) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop, re-migrate, and reseed the database (destructive) |
| `npm run db:rotate-passwords` | Give every account with a login a fresh random password (prints them once — save them) |

## Access model

**Formations are the accounts.** There's no separate User table — a
Formation gets a NAWANI `email` + password once someone with the right
privilege sets that up for it, and can exist as a pure org-chart node with
no login at all until then.

**Visibility is scope-based, not hardcoded:** a formation sees its own
returns plus everything submitted by its descendants, resolved by walking
`parentId` recursively (`WITH RECURSIVE`, since Prisma has no native
recursive-CTE support — see `src/lib/scope.ts`). The same function works for
every formation type without any special-casing.

**Capabilities are individually-assignable privileges, not fixed roles:**

| Privilege | Grants |
|---|---|
| `MANAGE_FORMATIONS` | Create new formations/units in the tree |
| `MANAGE_ACCOUNTS` | Set up or reset another formation's login |
| `MANAGE_PRIVILEGES` | Grant or revoke privileges on another formation |
| `VERIFY_RETURNS` | Move a return item through the workflow (verify/flag/close/etc.) |

A formation can only grant a privilege it **holds itself**, and only if it
also holds `MANAGE_PRIVILEGES` — this is enforced in `src/lib/privileges.ts`
(`canGrant`) and in `setPrivilegesAction`, which additionally never touches a
target's privileges the granter doesn't hold, so you can't accidentally
revoke access you had no authority over in the first place.

`parentId` is always the pure NAS chain of command. `attachedTo` (Brigade
Signals units only) is a separate, purely operational field — never conflated
with the reporting line. See `prisma/schema.prisma` for the full model.

## Returns

A **Return** is one register submission (one Request Ref) that can bundle
**multiple equipment items** (`ReturnItem`) — add as many as the request
covers on the "New Return" form. Workflow status (`PENDING` →
`VERIFIED`/`DISCREPANCY` → `RETURNED` → `CLOSED`) and physical condition are
tracked per item, not per request, since a single submission can easily mix
a serviceable radio with an unserviceable one.

## Notifications

When a formation submits a Return, every formation in **its own subtree**
(its subordinates — never itself, never its superiors) gets a notification.
A leaf UNIT's returns therefore usually notify no one; a Brigade or
Command's fan out to everything below it. The bell icon in the header shows
an unread count and switches color when there's something new; opening it
marks everything read.

Because notifications flow downward from wherever a return was submitted,
a notified formation can always open that specific return even though it
sits outside their normal (also-downward) visibility scope — see the
`wasNotified` check in `src/app/dashboard/returns/[id]/page.tsx`.

## Security notes (read before real deployment)

- Passwords are hashed with bcrypt; sessions are signed JWTs (`AUTH_SECRET`).
- Failed logins lock an account for 15 minutes after 5 consecutive failures
  (`src/lib/auth.ts`). This is per-account, DB-backed lockout — not IP-based
  rate limiting. If you need IP-level throttling too (recommended for a
  public-facing deployment), add it at the edge/proxy (e.g. Vercel Firewall,
  Cloudflare) or in `src/proxy.ts`.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, a locked-down `Permissions-Policy`) are set in
  `next.config.ts`. Add a Content-Security-Policy there if you introduce any
  third-party scripts.
- Rotate `AUTH_SECRET` and every account's password before exposing this
  beyond a local demo — `npm run db:rotate-passwords` handles the latter in
  one shot.

## Explicitly out of scope

Carried over from the original spec, still true:

- Offline sync / service workers
- Mobile native app
- File/document attachments

Also not included in this build — call these out if you need them:

- Automated tests and CI
- IP-based rate limiting (see Security notes)
- Email/SMS notifications on status change (in-app notifications only)
- Self-service password reset (a privileged formation currently has to reset it for you)
- A UI audit trail for privilege *grants themselves* (who gave whom what, when) — the return workflow's StatusHistory is fully audited, but privilege changes on Formation.privileges are not currently logged anywhere beyond the update itself
