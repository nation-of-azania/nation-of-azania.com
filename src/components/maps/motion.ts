'use client'

import { useEffect } from 'react'

import { RULES } from '@/maps/battle'
import type { Point } from '@/maps/geo'
import { diedBetween, PACE_WINDOW_MS, paceOf, returnOf, TELEPORT_LOCK_SECONDS, type Fix, type Return } from '@/maps/motion'

import { createStore, useStore, type Store } from './hooks'
import type { LiveState } from './live'

/**
 * How the players have been moving, from the live feed the war view polls
 * (./live.ts), for the sums in src/maps/motion.ts: each player's readings
 * of the last two minutes, from which their own pace is read with
 * teleports dropped out, and their last death, after which the server
 * keeps them from teleporting for a while. Kept only while the war view
 * is on, in a store of its own beside the live feed's, so a poll adds a
 * reading and nothing else on the page re-renders; a player gone from the
 * feed is forgotten once their readings are older than the window.
 */

export type Death = { at: number; x: number; z: number }

export type MotionState = {
  /** When the last reading was taken in. */
  at: number
  /** Each player's readings, oldest first, by lower-cased name. */
  fixes: Map<string, Fix[]>
  /** Each player's last death seen: when, and where they stood. */
  deaths: Map<string, Death>
}

const NONE: MotionState = { at: 0, fixes: new Map(), deaths: new Map() }
/** Readings are kept a little past the pace's window, so a step across its edge still has its neighbours. */
const KEEP_MS = PACE_WINDOW_MS + 15_000
/** A death is remembered this long: longer than any lock seen. */
const DEATH_KEEP_MS = 15 * 60_000

export const motionStore = createStore<MotionState>(NONE)

/** Follows the live feed while `enabled`, reading by reading; the store empties when it isn't. */
export function useMotionTracking(live: Store<LiveState>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      motionStore.set(NONE)
      return
    }
    const take = () => {
      const state = live.get()
      if (state.status !== 'live' || state.at <= motionStore.get().at) return
      const now = state.at
      const current = motionStore.get()
      const fixes = new Map<string, Fix[]>()
      const deaths = new Map([...current.deaths].filter(([, death]) => now - death.at <= DEATH_KEEP_MS))
      for (const player of state.players) {
        const key = player.name.toLowerCase()
        const fix: Fix = { at: now, x: player.x, z: player.z, health: player.health }
        const kept = (current.fixes.get(key) ?? []).filter((old) => now - old.at <= KEEP_MS)
        const before = kept.at(-1)
        // A death between the last reading and this one: when, as near as the readings say, and where they stood.
        if (before && diedBetween(before, fix)) deaths.set(key, { at: before.health === 0 ? before.at : (before.at + fix.at) / 2, x: before.x, z: before.z })
        fixes.set(key, [...kept, fix])
      }
      // Those gone from the feed keep their readings until the window has passed them, in case they come back.
      for (const [key, old] of current.fixes) {
        if (fixes.has(key)) continue
        const kept = old.filter((fix) => now - fix.at <= KEEP_MS)
        if (kept.length) fixes.set(key, kept)
      }
      motionStore.set({ at: now, fixes, deaths })
    }
    take()
    return live.subscribe(take)
  }, [live, enabled])
}

export const useMotion = (): MotionState => useStore(motionStore)

/** A player's own pace, blocks a second, when they've been seen moving; null otherwise. */
export const paceFor = (state: MotionState, name: string, now: number): number | null =>
  paceOf(state.fixes.get(name.toLowerCase()) ?? [], now)?.blocksPerSecond ?? null

/**
 * How long a player is from a banner, at a sprint and at their own pace,
 * with the lock after a death in the siege zone of that banner (the server
 * marks a death in battle; one elsewhere needn't lock them).
 */
export function returnFor(
  state: MotionState,
  name: string,
  from: Point,
  banner: Point,
  home: Point | null,
  now: number,
  lockSeconds: number = TELEPORT_LOCK_SECONDS,
): Return {
  const key = name.toLowerCase()
  const death = state.deaths.get(key)
  const inBattle = death && Math.hypot(death.x - banner[0], death.z - banner[1]) <= RULES.siegeZoneRadius
  return returnOf(from, banner, home, { now, pace: paceFor(state, name, now), diedAt: inBattle ? death.at : null, lockSeconds })
}
