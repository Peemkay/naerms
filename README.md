# NAERMS — Nigerian Army Signals Equipment Returns Management System

A role-based web portal for submitting and tracking equipment returns across
the Signals corps, with command-level rollup visibility.

## Tech stack

- **Next.js 16** (App Router, TypeScript, React 19)
- **PostgreSQL + Prisma 7** (driver-adapter architecture, `@prisma/adapter-neon`)
- **Auth.js (NextAuth) v5** — credentials login keyed on NA service ID, JWT sessions
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

- `DATABASE_URL` — your Postgres connection string (Neon: Project → Connection
  Details → pooled connection string).
- `AUTH_SECRET` — generate with `npx auth secret`, or any long random string.

The app fails fast with a clear error at startup if either is missing
(`src/lib/env.ts`).

### 3. Install, migrate, seed

```bash
npm install
npm run db:migrate   # applies prisma/schema.prisma, then runs the seed automatically
```

Seeded data: a sample NAS tree (NAS → NACWC → 52 Signals Brigade → 520 Signal
Regiment + 521 Brigade Signals attached to "4 Mechanised Infantry Brigade"),
one user per role, and a handful of sample returns with audit history.

| Service ID | Role             | Formation             |
|------------|------------------|------------------------|
| NA/10001   | NAS_ADMIN        | Nigerian Army Signals |
| NA/10002   | COMMAND_ADMIN    | NACWC                  |
| NA/10003   | BRIGADE_ADMIN    | 52 Signals Brigade     |
| NA/10004   | REGIMENT_OFFICER | 520 Signal Regiment    |
| NA/20001   | UNIT_CLERK       | 520 SR Unit A          |
| NA/20002   | UNIT_CLERK       | 521 BS Detachment      |

Password for every seeded account: `naerms123`. **Change or remove these
before any real deployment** — see Security notes below.

### 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`, then to
`/portal` (Unit Clerk / Regiment Officer) or `/admin` (Brigade/Command/NAS
Admin) based on role.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Run/generate Prisma migrations against `DATABASE_URL`, then seed |
| `npm run db:seed` | Re-run just the seed script |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop, re-migrate, and reseed the database (destructive) |

## Access model

Visibility is scope-based, not hardcoded: a user sees their own formation
plus every descendant, resolved by walking `parentId` recursively
(`WITH RECURSIVE`, since Prisma has no native recursive-CTE support — see
`src/lib/scope.ts`). The same function works for every role and formation
type without any special-casing.

- **UNIT_CLERK** — submit/edit their own unit's returns while `PENDING`.
- **REGIMENT_OFFICER** — view + verify their regiment and its units.
- **BRIGADE_ADMIN / COMMAND_ADMIN / NAS_ADMIN** — view + verify their subtree,
  with a tree-navigation dashboard and aggregate rollups.

`parentId` is always the pure NAS chain of command. `attachedTo` (Brigade
Signals units only) is a separate, purely operational field — never conflated
with the reporting line. See `prisma/schema.prisma` for the full model.

## Formations and users

- **Any authenticated user** can register a new formation/unit
  (`/formations/new`) — the tree is meant to grow from the field, not be
  centrally gatekept. New formations are immediately selectable everywhere
  formations are picked (parent pickers, admin dropdowns) since those are
  always read live from the database.
- **Creating a login (a User account)** is restricted to admin-tier roles
  (Brigade Admin and above), scoped to formations already within that admin's
  visibility, and capped to roles at or below the creator's own — a Brigade
  Admin can't mint a Command Admin account. See `/admin/users`.

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
- Rotate `AUTH_SECRET` and every seeded password before exposing this beyond
  a local demo.

## Explicitly out of scope

Carried over from the original spec, still true:

- Offline sync / service workers
- Mobile native app
- File/document attachments

Also not included in this build — call these out if you need them:

- Automated tests and CI
- IP-based rate limiting (see Security notes)
- Email/SMS notifications on status change
- Self-service password reset (an admin currently has to recreate the account)
