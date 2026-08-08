import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 bg-brand-navy px-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-white/90 p-2.5">
        <Image src="/logo.png" alt="NAERMS" width={64} height={73} className="h-full w-auto opacity-60" />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-white">Not found</h1>
        <p className="text-sm text-white/60">
          That page doesn&apos;t exist, or is outside your formation&apos;s scope.
        </p>
      </div>
      <Button render={<Link href="/">Back to NAERMS</Link>} />
    </main>
  )
}
