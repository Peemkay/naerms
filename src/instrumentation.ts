import * as Sentry from "@sentry/nextjs"

// Next.js calls this once per server/edge runtime on startup.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }
}

// Reports errors thrown in server components / route handlers / actions
// that Next.js's own error boundaries don't see (e.g. during rendering,
// before a boundary can catch them).
export const onRequestError = Sentry.captureRequestError
