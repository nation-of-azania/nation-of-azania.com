'use client'

import { useSyncExternalStore } from 'react'

/**
 * Whether this browser may be offered the globe, kept small enough to ride
 * with the shell: the globe itself (./GlobeHost.tsx, ./Globe.tsx and
 * three.js) is fetched only once someone shows they mean to open it. No
 * WebGL context is made here to ask; one is made only by opening the
 * globe, and if the browser can't make one, or can't draw with it, the
 * globe is marked broken for the rest of the session and its button goes.
 */

/**
 * The globe's main switch: off, it's offered nowhere, its button and all.
 * Its others, read only once the flat map or the globe is loaded, are in
 * src/maps/globe-switches.ts.
 */
const ENABLED: boolean = true

const BROKEN_KEY = 'az-globe-broken'
const listeners = new Set<() => void>()
let broken: boolean | null = null

const isBroken = (): boolean => {
  if (broken === null) {
    try {
      broken = sessionStorage.getItem(BROKEN_KEY) === '1'
    } catch {
      broken = false
    }
  }
  return broken
}

const supported = (): boolean => ENABLED && 'WebGL2RenderingContext' in window && !isBroken()

const subscribe = (callback: () => void) => {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/** Whether to offer the globe: false on the server, and wherever WebGL 2 is missing or the globe has failed this session. */
export function useGlobeSupport(): boolean {
  return useSyncExternalStore(subscribe, supported, () => false)
}

/** The globe couldn't be drawn here: it isn't offered again this session. */
export function markGlobeBroken(): void {
  broken = true
  try {
    sessionStorage.setItem(BROKEN_KEY, '1')
  } catch {
    // Storage refused (a private window): the mark lasts as long as the page does.
  }
  listeners.forEach((listener) => listener())
}

/**
 * The globe's code: its keeper and the globe itself, and three.js with
 * them. Should it not come (the connection dropped, a deploy replaced it),
 * the globe isn't marked broken: the shell says so to a reader who asked
 * for it, the button stays for another try, and a reload brings it.
 */
export const loadGlobe = () => import('./GlobeHost')

/**
 * Fetches the globe's code ahead of its opening, when the pointer comes to
 * its button or the button is focused, and with it the world's picture,
 * decoded off the main thread (./sheet.ts). Fetched, not run; asked for
 * again, it's the same fetch. One that fails is left to the opening to
 * say so.
 */
export function warmGlobe(): void {
  loadGlobe().then(
    (module) => module.warmSheet(),
    () => {},
  )
}
