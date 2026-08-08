// Browser-side Sentry config. Named/loaded by Next.js convention (works
// under Turbopack, unlike the older sentry.client.config.ts pattern).
// Inert until NEXT_PUBLIC_SENTRY_DSN is set at build time.
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Session replay stays off by default — this is a restricted system
  // handling equipment/personnel data; opt in deliberately later if wanted,
  // don't capture screen recordings of it by default.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
