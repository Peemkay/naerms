"use client"

import { useEffect } from "react"
import Image from "next/image"

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
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 bg-brand-navy px-4 text-center">
      <Image
        src="/logo.png"
        alt="NAERMS"
        width={64}
        height={73}
        className="h-16 w-auto opacity-40 grayscale"
      />
      <div>
        <h1 className="text-lg font-semibold text-white">
          NAE<span className="text-brand-gold">RMS</span> hit a snag
        </h1>
        <p className="max-w-sm text-sm text-white/60">
          The request couldn&apos;t be completed. If this keeps happening, contact your
          formation&apos;s system administrator.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-white/40">Ref: {error.digest}</p>
        )}
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </main>
  )
}
