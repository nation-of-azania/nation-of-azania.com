'use client'

import { useEffect, useState } from 'react'

import { unpackWorld, WORLD_EVERY_S, WORLD_URL, type PackedWorld, type World } from '@/maps/world'

/**
 * The rest of the world, as the map in the browser has it:
 * /maps/world.json, asked for once the map has settled and the browser is
 * idle, so the nation's own map paints first and everyone else's claims
 * (some 50 KB as they travel, packed) come after; asked again every
 * quarter of an hour while the tab is in view, as the CDN refreshes it. A
 * world that comes back offline leaves the last one standing. Always the
 * bare path, which every viewer shares at the CDN (the route refuses a
 * query).
 */

export type WorldState = {
  world: World | null
  /** 'waiting' until asked, 'asking' until the first answer, 'down' while the Rulercraft map isn't answering and nothing was kept. */
  status: 'waiting' | 'asking' | 'live' | 'down'
}

const isWorld = (body: unknown): body is PackedWorld => {
  const world = body as PackedWorld
  return Boolean(world) && Array.isArray(world.towns) && Array.isArray(world.nations)
}

/** Waits for the browser to be idle, or `timeout` ms at most; returns what cancels it. */
function whenIdle(run: () => void, timeout: number): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout })
    return () => window.cancelIdleCallback(handle)
  }
  const handle = window.setTimeout(run, Math.min(timeout, 600))
  return () => window.clearTimeout(handle)
}

/**
 * The world, fetched once `start` turns true (the map has settled): at
 * once when `eager` (a town or a nation abroad is open, and the map needs
 * to know where it is), else when the browser is next idle.
 */
export function useWorld(start: boolean, eager: boolean): WorldState {
  const [state, setState] = useState<WorldState>({ world: null, status: 'waiting' })
  // Once begun, it carries on whatever `eager` does.
  const [begun, setBegun] = useState(false)
  useEffect(() => {
    if (begun || !start) return
    if (eager) {
      // Answering the page's own state as it arrives, once: not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBegun(true)
      return
    }
    return whenIdle(() => setBegun(true), 2500)
  }, [start, eager, begun])

  useEffect(() => {
    if (!begun) return
    let cancelled = false
    let timer: number | undefined
    let last = 0
    const visible = () => document.visibilityState === 'visible'
    const ask = async () => {
      window.clearTimeout(timer)
      last = Date.now()
      setState((current) => (current.world ? current : { world: null, status: 'asking' }))
      try {
        const response = await fetch(WORLD_URL)
        if (!response.ok) throw new Error(`The world answered ${response.status}`)
        const body: unknown = await response.json()
        if (cancelled) return
        if (!isWorld(body) || body.offline) {
          setState((current) => (current.world ? current : { world: null, status: 'down' }))
        } else setState({ world: unpackWorld(body), status: 'live' })
      } catch {
        if (!cancelled) setState((current) => (current.world ? current : { world: null, status: 'down' }))
      } finally {
        if (!cancelled && visible()) timer = window.setTimeout(ask, WORLD_EVERY_S * 1000)
      }
    }
    // Back to the tab after a long while away: ask again; away from it, stop.
    const onVisibility = () => {
      if (!visible()) return window.clearTimeout(timer)
      if (Date.now() - last >= WORLD_EVERY_S * 1000) void ask()
      else timer = window.setTimeout(ask, WORLD_EVERY_S * 1000 - (Date.now() - last))
    }
    const onOnline = () => {
      setState((current) => (current.status === 'down' ? { ...current, status: 'asking' } : current))
      void ask()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    void ask()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [begun])

  return state
}
