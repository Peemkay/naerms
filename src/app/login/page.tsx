import Image from "next/image"

import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <main
      className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-brand-navy px-4 py-12"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in oklch, var(--brand-navy-light), transparent 15%), transparent)",
      }}
    >
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-20 items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
            <Image src="/logo.png" alt="NAERMS" width={70} height={80} className="h-full w-auto" priority />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-wide text-white">NAERMS</h1>
            <p className="text-sm text-white/60">
              Nigerian Army Equipment Returns Management System
            </p>
          </div>
        </div>

        <div className="light rounded-xl border-t-4 border-brand-gold bg-white text-neutral-900 shadow-2xl">
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

        <p className="mt-6 text-center text-xs text-white/50">
          Restricted system. Access is logged and limited to authorised personnel.
        </p>
      </div>
    </main>
  )
}
