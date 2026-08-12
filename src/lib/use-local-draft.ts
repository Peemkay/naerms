"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Mirrors in-progress form state to localStorage so nothing is lost to a
 * power cut, a browser crash, or a closed tab.
 *
 * This is the layer that survives what the server cannot: a save to the
 * database needs the network, and the failure this feature exists for is
 * precisely the one where the network (or the machine) has gone away. So
 * every keystroke lands locally, and the server draft is the deliberate,
 * cross-device save on top of it.
 *
 * Storage is keyed per formation as well as per form, so two accounts used
 * from the same shared office machine never see each other's work.
 */

const PREFIX = "naerms:draft:"

function storageKey(formKey: string, formationId: string) {
  return `${PREFIX}${formationId}:${formKey}`
}

export type LocalDraft<T> = {
  values: T
  savedAt: number
}

/** Reads a stored draft, tolerating absent/corrupt/foreign-shaped payloads. */
function read<T>(key: string): LocalDraft<T> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalDraft<T>
    if (!parsed || typeof parsed.savedAt !== "number") return null
    return parsed
  } catch {
    // Private-mode quota errors, disabled storage, or a half-written value
    // from a tab that died mid-write. A lost local draft is recoverable
    // (the server copy may still exist); a crashed form is not.
    return null
  }
}

export function useLocalDraft<T>({
  formKey,
  formationId,
  values,
  enabled = true,
}: {
  formKey: string
  formationId: string
  values: T
  /** Set false once the form is submitted, so the final state isn't re-saved. */
  enabled?: boolean
}) {
  const key = storageKey(formKey, formationId)

  // Read once, before first paint, so the "restore?" prompt is decided from
  // what was on disk at mount rather than from anything typed since.
  const [recovered] = useState<LocalDraft<T> | null>(() => read<T>(key))
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // `values` is a fresh object every render; a ref keeps the flush-on-exit
  // listener from resubscribing on each keystroke while still writing the
  // current state. Assigned in an effect, not during render, so a discarded
  // render never leaves the ref pointing at values that were never shown.
  const latest = useRef(values)
  useEffect(() => {
    latest.current = values
  }, [values])

  useEffect(() => {
    if (!enabled) return
    // Debounced so a burst of typing is one write, not one per character.
    const timer = window.setTimeout(() => {
      try {
        const payload: LocalDraft<T> = { values, savedAt: Date.now() }
        window.localStorage.setItem(key, JSON.stringify(payload))
        setSavedAt(payload.savedAt)
      } catch {
        // Out of quota or storage disabled: autosave silently degrades
        // rather than interrupting data entry with an error the clerk
        // can't act on.
      }
    }, 800)
    return () => window.clearTimeout(timer)
  }, [key, enabled, values])

  // A tab closing or backgrounding may never run the pending debounce, and
  // that is exactly the crash/shutdown case this hook exists for — so flush
  // synchronously on the way out. `pagehide` (not `unload`) is the event
  // that still fires on mobile Safari and with the bfcache.
  useEffect(() => {
    if (!enabled) return
    const flush = () => {
      try {
        window.localStorage.setItem(
          key,
          JSON.stringify({ values: latest.current, savedAt: Date.now() } satisfies LocalDraft<T>)
        )
      } catch {
        // Same degradation as above.
      }
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", flush)
    }
  }, [key, enabled])

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Nothing to do: a stale local draft is offered for recovery, not
      // applied automatically, so failing to clear it is not destructive.
    }
    setSavedAt(null)
  }, [key])

  return { recovered, savedAt, clear }
}
