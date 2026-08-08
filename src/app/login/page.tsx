import Image from "next/image"

import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-brand-navy px-4 py-12">
      {/* Field photo, duotoned — a low-res source photo stretched full-bleed
          would look pixelated and its daylight sky/greens would fight the
          brand palette; desaturating it and multiplying in the brand navy
          turns it into a rich, on-brand backdrop that still reads clearly
          as a real photo (multiply darkens the bright sky into a moody
          navy rather than washing it pale), while a light blur hides the
          upscaling softness. */}
      <Image
        src="/login-bg.jpg"
        alt=""
        fill
        priority
        className="scale-105 object-cover object-center grayscale contrast-110 blur-[1px]"
      />
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{ background: "var(--brand-navy)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklch, var(--brand-navy), transparent 55%) 0%, color-mix(in oklch, var(--brand-navy), transparent 60%) 40%, var(--brand-navy) 100%), radial-gradient(ellipse 65% 50% at 50% 30%, color-mix(in oklch, var(--brand-navy-light), transparent 45%), transparent)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-20 items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
            <Image src="/logo.png" alt="NAERMS" width={70} height={80} className="h-full w-auto" priority />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-wide text-white drop-shadow-sm">NAERMS</h1>
            <p className="text-sm text-white/70 drop-shadow-sm">
              Nigerian Army Equipment Returns Management System
            </p>
          </div>
        </div>

        <div className="light rounded-xl border-t-4 border-brand-gold bg-white/95 text-neutral-900 shadow-2xl backdrop-blur-sm">
          <div className="px-6 pt-5 pb-1">
            <p className="text-sm font-medium">Sign in</p>
            <p className="text-sm text-neutral-500">
              Sign in with your formation&apos;s email to access its returns.
            </p>
          </div>
          <div className="px-6 pt-4 pb-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/60 drop-shadow-sm">
          Restricted system. Access is logged and limited to authorised personnel.
        </p>
      </div>
    </main>
  )
}
