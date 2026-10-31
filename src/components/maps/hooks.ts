'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Small hooks the map's components share.
 */

const noop = () => () => {}

/** False while the server's markup is being hydrated, true once the browser has the page. */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )

/** The browser's query string, '' on the server; follows the back button. */
export const useSearch = (): string =>
  useSyncExternalStore(
    (callback) => {
      window.addEventListener('popstate', callback)
      return () => window.removeEventListener('popstate', callback)
    },
    () => window.location.search,
    () => '',
  )

/** Whether a media query holds; `fallback` is what the server assumes. */
export const useMediaQuery = (query: string, fallback: boolean): boolean =>
  useSyncExternalStore(
    (callback) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', callback)
      return () => list.removeEventListener('change', callback)
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  )

/** The latest value of something, readable from a callback that was made earlier. */
export function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/** A tiny store for a value that changes too often for state: readers subscribe, the writer sets. */
export type Store<T> = {
  get: () => T
  set: (value: T) => void
  subscribe: (callback: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }
}

export const useStore = <T>(store: Store<T>): T =>
  useSyncExternalStore(store.subscribe, store.get, store.get)

/** Where the viewer's own settings for the map are kept, in their browser alone. */
const NAMES_KEY = 'az-maps-names'

const read = (): boolean => {
  try {
    return window.localStorage.getItem(NAMES_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * Whether the players' names stand beside their heads at every zoom, as
 * the viewer has it: on unless they turned it off, remembered in their
 * browser (and not at all where storage is out of reach: a private
 * window, blocked site data). Not a layer: nothing of it is in the
 * address. The server renders it on, and the browser's own choice takes
 * over as the page hydrates.
 */
export function useNamesSetting(): [named: boolean, setNamed: (on: boolean) => void] {
  const [named, setNamedState] = useState(true)
  useEffect(() => {
    // Once the page is in the browser: the viewer's choice, if they made one. Not a loop: nothing of it is a dependency.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNamedState(read())
  }, [])
  const setNamed = useCallback((on: boolean) => {
    setNamedState(on)
    try {
      if (on) window.localStorage.removeItem(NAMES_KEY)
      else window.localStorage.setItem(NAMES_KEY, 'off')
    } catch {
      // Storage out of reach: the choice holds for this page alone.
    }
  }, [])
  return [named, setNamed]
}
