'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'

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
