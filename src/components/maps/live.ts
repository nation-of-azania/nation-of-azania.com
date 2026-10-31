'use client'

import { useEffect, useMemo } from 'react'

import { LIVE_PLAYERS_EVERY_MS, PLAYERS_EVERY_MS, type LivePlayer, type LivePlayers } from '@/maps/players'

import { createStore, type Store } from './hooks'
import { HIDDEN_FOR_MS, steadyTimeout } from './steady'

/**
 * Who is online, as the map in the browser has it: /maps/players asked
 * every few seconds while the players layer is on, in sight or (for a
 * while) out of it, and not at all otherwise; /maps/players/live every
 * second and a half instead in the war view (`fast`). The answer lives in a small store rather than
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
  /** How often the feed is asked just now, in ms: a head glides from one reading to the next over this. */
  every: number
}

const OFF: LiveState = { players: [], online: null, at: 0, status: 'off', every: PLAYERS_EVERY_MS }
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

const stat = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** The answer as the route gives it, with anything odd left out rather than trusted; health and armour null where an older answer has none. */
function readAnswer(body: unknown, every: number): LiveState {
  const answer = (body ?? {}) as Partial<LivePlayers>
  if (answer.offline) return { players: [], online: null, at: Date.now(), status: 'down', every }
  return {
    players: Array.isArray(answer.players)
      ? answer.players.filter(isPlayer).map((player) => ({ ...player, health: stat(player.health), armor: stat(player.armor) }))
      : [],
    online: typeof answer.online === 'number' ? answer.online : null,
    at: typeof answer.at === 'number' ? answer.at : Date.now(),
    status: 'live',
    every,
  }
}

/**
 * Polls the live feed while `enabled`: one request at a time, the next
 * scheduled only once the last has answered, so a slow answer never
 * stacks; waits longer and longer while the map is down. It goes on while
 * the tab is out of sight (behind the game, or shared in a call), on a
 * clock a hidden tab doesn't slow (./steady.ts), for up to HIDDEN_FOR_MS,
 * and asks at once when it's back in sight. The request has no query, so
 * every viewer shares the CDN's copy.
 */
export function useLivePlayers(enabled: boolean, { fast = false }: { fast?: boolean } = {}): Store<LiveState> {
  const store = useMemo(() => createStore<LiveState>(OFF), [])
  useEffect(() => {
    const every = fast ? LIVE_PLAYERS_EVERY_MS : PLAYERS_EVERY_MS
    const url = fast ? '/maps/players/live' : '/maps/players'
    if (!enabled) {
      store.set(OFF)
      return
    }
    // Switching between the feeds keeps the heads where they are until the other answers.
    store.set(store.get().status === 'off' ? { ...OFF, status: 'asking', every } : { ...store.get(), every })
    let cancelled = false
    let inFlight = false
    let wait = every
    let cancelTimer: (() => void) | null = null
    let hiddenSince = document.visibilityState === 'visible' ? null : Date.now()
    // Out of sight for long enough, the feed rests until the tab is back.
    const resting = () => hiddenSince !== null && Date.now() - hiddenSince > HIDDEN_FOR_MS

    const schedule = () => {
      cancelTimer?.()
      cancelTimer = null
      if (!cancelled && !resting()) cancelTimer = steadyTimeout(poll, wait)
    }
    const poll = async () => {
      if (cancelled || inFlight || resting()) return
      inFlight = true
      try {
        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) throw new Error(`The feed answered ${response.status}`)
        const next = readAnswer(await response.json(), every)
        if (cancelled) return
        store.set(next)
        wait = next.status === 'down' ? Math.min(Math.max(wait, every) * 2, LONGEST_WAIT_MS) : every
      } catch {
        if (cancelled) return
        store.set({ players: [], online: null, at: Date.now(), status: 'down', every })
        wait = Math.min(Math.max(wait, every) * 2, LONGEST_WAIT_MS)
      } finally {
        inFlight = false
        schedule()
      }
    }
    // Back in sight: ask at once, and the clock out of sight starts again next time.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        hiddenSince = null
        wait = every
        void poll()
      } else hiddenSince ??= Date.now()
    }
    document.addEventListener('visibilitychange', onVisibility)
    void poll()
    return () => {
      cancelled = true
      cancelTimer?.()
      document.removeEventListener('visibilitychange', onVisibility)
      // Nothing cleared here: turned off, the next run clears the heads; switched between feeds, they stay.
    }
  }, [enabled, fast, store])
  return store
}
