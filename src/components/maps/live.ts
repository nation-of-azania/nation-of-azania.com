'use client'

import { useEffect, useMemo } from 'react'

import { PLAYERS_EVERY_MS, type LivePlayer, type LivePlayers } from '@/maps/players'

import { createStore, type Store } from './hooks'

/**
 * Who is online, as the map in the browser has it: /maps/players asked
 * every few seconds while the players layer is on and the tab is visible,
 * and not at all otherwise. The answer lives in a small store rather than
 * React state, so only what shows it — the heads on the map, the count —
 * follows it, and nothing else on the page re-renders for a poll. Nothing
 * is written anywhere: the positions are gone when the tab is.
 */

export type LiveState = {
  players: LivePlayer[]
  /** Everyone on the server, shown on the map or not; null until the first answer, or while the map is down. */
  online: number | null
  /** When the server answered, in ms since the epoch. */
  at: number
  /** 'asking' until the first answer; 'down' while the Rulercraft map isn't answering. */
  status: 'off' | 'asking' | 'live' | 'down'
}

const OFF: LiveState = { players: [], online: null, at: 0, status: 'off' }
/** While the map is down, each ask waits twice as long as the last, up to this. */
const LONGEST_WAIT_MS = 60_000

const isPlayer = (value: unknown): value is LivePlayer => {
  const player = value as LivePlayer
  return (
    Boolean(player) &&
    typeof player.name === 'string' &&
    typeof player.x === 'number' &&
    typeof player.y === 'number' &&
    typeof player.z === 'number'
  )
}

/** The answer as the route gives it, with anything odd left out rather than trusted. */
function readAnswer(body: unknown): LiveState {
  const answer = (body ?? {}) as Partial<LivePlayers>
  if (answer.offline) return { players: [], online: null, at: Date.now(), status: 'down' }
  return {
    players: Array.isArray(answer.players) ? answer.players.filter(isPlayer) : [],
    online: typeof answer.online === 'number' ? answer.online : null,
    at: typeof answer.at === 'number' ? answer.at : Date.now(),
    status: 'live',
  }
}

/**
 * Polls the live feed while `enabled` and the tab is visible: one request
 * at a time, the next scheduled only once the last has answered, so a slow
 * answer never stacks; waits longer and longer while the map is down. The
 * request has no query, so every viewer shares the CDN's copy.
 */
export function useLivePlayers(enabled: boolean): Store<LiveState> {
  const store = useMemo(() => createStore<LiveState>(OFF), [])
  useEffect(() => {
    if (!enabled) {
      store.set(OFF)
      return
    }
    store.set({ ...OFF, status: 'asking' })
    let cancelled = false
    let inFlight = false
    let wait = PLAYERS_EVERY_MS
    let timer: number | undefined
    const visible = () => document.visibilityState === 'visible'

    const schedule = () => {
      window.clearTimeout(timer)
      if (!cancelled && visible()) timer = window.setTimeout(poll, wait)
    }
    const poll = async () => {
      if (cancelled || inFlight || !visible()) return
      inFlight = true
      try {
        const response = await fetch('/maps/players', { cache: 'no-store' })
        if (!response.ok) throw new Error(`The feed answered ${response.status}`)
        const next = readAnswer(await response.json())
        if (cancelled) return
        store.set(next)
        wait = next.status === 'down' ? Math.min(Math.max(wait, PLAYERS_EVERY_MS) * 2, LONGEST_WAIT_MS) : PLAYERS_EVERY_MS
      } catch {
        if (cancelled) return
        store.set({ players: [], online: null, at: Date.now(), status: 'down' })
        wait = Math.min(Math.max(wait, PLAYERS_EVERY_MS) * 2, LONGEST_WAIT_MS)
      } finally {
        inFlight = false
        schedule()
      }
    }
    // Back to the tab: ask at once; away from it: stop asking.
    const onVisibility = () => {
      if (visible()) {
        wait = PLAYERS_EVERY_MS
        void poll()
      } else window.clearTimeout(timer)
    }
    document.addEventListener('visibilitychange', onVisibility)
    void poll()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      store.set(OFF)
    }
  }, [enabled, store])
  return store
}
