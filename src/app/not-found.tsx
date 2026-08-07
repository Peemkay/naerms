import Link from "next/link"
import { Radio } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-lg border border-border bg-primary text-primary-foreground">
        <Radio className="size-5" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="text-sm text-muted-foreground">
          That page doesn&apos;t exist, or is outside your formation&apos;s scope.
        </p>
      </div>
      <Button render={<Link href="/">Back to NAERMS</Link>} />
    </main>
  )
}
