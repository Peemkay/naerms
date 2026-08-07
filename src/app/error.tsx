"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-lg border border-status-danger/30 bg-status-danger-bg text-status-danger">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The request couldn&apos;t be completed. If this keeps happening, contact your
          formation&apos;s system administrator.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
        )}
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </main>
  )
}
