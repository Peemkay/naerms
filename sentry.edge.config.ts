// Edge runtime Sentry config (the proxy/middleware). Loaded by
// src/instrumentation.ts's register(). Inert until SENTRY_DSN is set.
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
})
