'use client'

import { useSyncExternalStore } from 'react'

import { sessionClock } from '@/maps/battle'

/**
 * The war view's own state and small hooks (the view itself is
 * ./panels/WarPanel.tsx, and the shell turns it on): what the sidebar is
 * looking at, a clock that ticks for the score, and the words for the
 * session's clock.
 */

/**
 * What the war sidebar shows: a siege, with its battle; a nation, who it
 * is and who of it is online; one player, watched; or, with nothing
 * chosen, the overview. The siege last looked at stays the view's siege
 * (the shell keeps it), so a nation's or a player's distances are to it.
 */
export type WarFocus = { kind: 'siege'; townId: string } | { kind: 'nation'; name: string } | { kind: 'player'; name: string }

export const sameFocus = (a: WarFocus | null, b: WarFocus | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.kind === b.kind &&
    (a.kind === 'siege' ? a.townId === (b as { townId: string }).townId : a.name === (b as { name: string }).name))

/*
 * One clock for everything in the war view that ticks: the score run on
 * between readings, the time left, the way back. Every reader of it
 * re-renders once a second, and nothing else on the page does: the
 * sidebar's figures subscribe where they're shown, never the shell.
 */
const listeners = new Set<() => void>()
let ticking: number | undefined
let tickedAt = Date.now()
const subscribeTick = (callback: () => void) => {
  listeners.add(callback)
  if (ticking === undefined) {
    tickedAt = Date.now()
    ticking = window.setInterval(() => {
      tickedAt = Date.now()
      listeners.forEach((listener) => listener())
    }, 1000)
  }
  return () => {
    listeners.delete(callback)
    if (listeners.size === 0) {
      window.clearInterval(ticking)
      ticking = undefined
    }
  }
}

/** The time, to the second, shared by every figure that ticks; the server's render is at 0, and the first tick in the browser sets it. */
export const useSecond = (): number =>
  useSyncExternalStore(
    subscribeTick,
    () => tickedAt,
    () => 0,
  )

/** "42:17", or "1:02:05" past the hour: a clock a fighter reads at a glance. */
export function clockOf(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = whole % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return hours ? `${hours}:${two(minutes)}:${two(rest)}` : `${minutes}:${two(rest)}`
}

/** "2 h 15 min", "48 min", "under a minute": how far off something is, in words. */
export function spanWords(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** The battle session on now, or the next, as the sidebar says it: the clock's state and the words for it. */
export function sessionWords(now: number): { on: boolean; seconds: number; headline: string; detail: string } {
  const session = sessionClock(now)
  if (session.on) {
    const seconds = (session.end - now) / 1000
    return { on: true, seconds, headline: clockOf(seconds), detail: 'left in this battle session' }
  }
  const seconds = (session.start - now) / 1000
  const at = new Date(session.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return { on: false, seconds, headline: `in ${spanWords(seconds)}`, detail: `the next battle session, at ${at}` }
}
