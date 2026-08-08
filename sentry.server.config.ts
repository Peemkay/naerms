// Node.js runtime Sentry config (API routes, server components, actions).
// Loaded by src/instrumentation.ts's register(). Inert until SENTRY_DSN is
// set — Sentry.init() with an undefined dsn is a documented no-op, so this
// ships safely ahead of the user creating a Sentry project.
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
})
