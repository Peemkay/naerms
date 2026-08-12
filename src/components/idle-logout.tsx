"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { logoutAction } from "@/app/logout-action"

const MINUTE = 60_000
const IDLE_LIMIT_MS = 30 * MINUTE
/** How long the "you're about to be signed out" warning is on screen. */
const WARN_BEFORE_MS = 2 * MINUTE

// Activity that counts as "still at the desk". Deliberately passive
// listeners on window: any of these resets the clock.
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const

/**
 * Signs the user out after 30 minutes without interaction.
 *
 * This is the visible half of the timeout only — the JWT's own `maxAge`
 * (see src/lib/auth.config.ts) is what actually enforces it server-side, so
 * defeating this timer in the browser buys nothing. What this adds is a
 * warning and a clean redirect, rather than the user typing into a form for
 * ten minutes and finding out the session died when their submit bounces.
 *
 * Mounted inside the authenticated shell, so it never runs on /login.
 */
export function IdleLogout() {
  const router = useRouter()
  const [warning, setWarning] = useState(false)
  // Timer ids live in refs: they're mutable bookkeeping, not render state,
  // and rescheduling on every mousemove must not re-render the whole app.
  const warnTimer = useRef<number | undefined>(undefined)
  const outTimer = useRef<number | undefined>(undefined)
  // Guards against a second logout being fired by an activity event that
  // lands while the first is still in flight.
  const signingOut = useRef(false)

  const signOutNow = useCallback(async () => {
    if (signingOut.current) return
    signingOut.current = true
    await logoutAction()
  }, [])

  const schedule = useCallback(() => {
    if (signingOut.current) return
    window.clearTimeout(warnTimer.current)
    window.clearTimeout(outTimer.current)
    setWarning(false)

    warnTimer.current = window.setTimeout(() => setWarning(true), IDLE_LIMIT_MS - WARN_BEFORE_MS)
    outTimer.current = window.setTimeout(signOutNow, IDLE_LIMIT_MS)
  }, [signOutNow])

  useEffect(() => {
    schedule()

    // One handler for every activity event; `schedule` is stable so this
    // subscribes once for the life of the session.
    const onActivity = () => schedule()
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }

    // A laptop lid closed for an hour suspends timers, so the pending
    // timeout would fire late (or not at all) on wake. Re-check against the
    // wall clock whenever the tab becomes visible again.
    const lastActive = { at: Date.now() }
    const stamp = () => {
      lastActive.at = Date.now()
    }
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, stamp, { passive: true })
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastActive.at >= IDLE_LIMIT_MS) {
        void signOutNow()
        return
      }
      schedule()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
        window.removeEventListener(event, stamp)
      }
      document.removeEventListener("visibilitychange", onVisible)
      window.clearTimeout(warnTimer.current)
      window.clearTimeout(outTimer.current)
    }
  }, [schedule, signOutNow])

  useEffect(() => {
    if (!warning) return
    const id = toast.warning("You will be signed out shortly due to inactivity.", {
      description: "Any unsaved work on this page is kept as a draft. Move the mouse or press a key to stay signed in.",
      duration: WARN_BEFORE_MS,
      action: {
        label: "Stay signed in",
        onClick: () => {
          // Touch the server so the rolling JWT is re-issued, not just the
          // local timer reset — otherwise the cookie could still lapse.
          router.refresh()
          schedule()
        },
      },
    })
    return () => {
      toast.dismiss(id)
    }
  }, [warning, router, schedule])

  return null
}
