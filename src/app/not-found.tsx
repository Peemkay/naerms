import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"

export default function NotFound() {
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
        <h1 className="text-lg font-semibold text-white">Not found</h1>
        <p className="text-sm text-white/60">
          That page doesn&apos;t exist, or is outside your formation&apos;s scope.
        </p>
      </div>
      <Button render={<Link href="/">Back to NAERMS</Link>} />
    </main>
  )
}
