'use client'

import { useEffect } from 'react'

import { createStore, useStore } from './hooks'

/**
 * The battles the tracker read in the last fortnight, as /maps/battles
 * serves them: each session's result and how its points went, a point a
 * minute, for the war view's story of a siege across its sessions
 * (panels/Outlook.tsx). Asked for once, when a siege's outlook wants it,
 * kept five minutes (the CDN's own), never polled.
 */

export type TrackedBattle = {
  townId: string
  town: string | null
  attacker: string | null
  defender: string | null
  startedAt: string
  /** The sessions the siege had fought before this one. */
  session: number
  coverage: number | null
  fought: number | null
  /** The marker's last word: the points the balance moved by; null when the tracker didn't see the end. */
  result: { attacker: number; defender: number } | null
  /** A point a minute: the minute, each side's points, and who held the banner ('a', 'd' or ''). */
  points: [number, number, number, string][]
}

export type BattlesState = {
  status: 'idle' | 'asking' | 'ready' | 'down'
  at: number
  demo: boolean
  battles: TrackedBattle[]
}

const IDLE: BattlesState = { status: 'idle', at: 0, demo: false, battles: [] }
const FRESH_MS = 5 * 60_000

const store = createStore<BattlesState>(IDLE)
let inFlight: Promise<void> | null = null

const isBattle = (value: unknown): value is TrackedBattle => {
  const battle = value as TrackedBattle
  return Boolean(battle) && typeof battle.townId === 'string' && typeof battle.startedAt === 'string' && Array.isArray(battle.points)
}

function ask(): void {
  const current = store.get()
  if (inFlight || (current.status === 'ready' && Date.now() - current.at < FRESH_MS)) return
  if (current.status !== 'ready') store.set({ ...current, status: 'asking' })
  inFlight = fetch('/maps/battles')
    .then(async (response) => {
      if (!response.ok) throw new Error(`The battles answered ${response.status}`)
      const body = (await response.json()) as { at?: unknown; demo?: unknown; battles?: unknown[] }
      store.set({
        status: 'ready',
        at: typeof body.at === 'number' ? body.at : Date.now(),
        demo: Boolean(body.demo),
        battles: (Array.isArray(body.battles) ? body.battles : []).filter(isBattle),
      })
    })
    .catch(() => {
      const kept = store.get()
      store.set({ ...kept, status: kept.status === 'ready' ? 'ready' : 'down' })
    })
    .finally(() => {
      inFlight = null
    })
}

/** The tracked battles, asked for while `wanted`; read with the store's own subscription. */
export function useBattles(wanted = true): BattlesState {
  useEffect(() => {
    if (wanted) ask()
  }, [wanted])
  return useStore(store)
}

/** A siege's sessions among the battles, in order: those of the same town by the same attacker. */
export function sessionsOf(state: BattlesState, siege: { townId: string; attacker: string }): TrackedBattle[] {
  return state.battles
    .filter((battle) => battle.townId === siege.townId && (battle.attacker ?? '').toLowerCase() === siege.attacker.toLowerCase())
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

/**
 * A siege's tracked sessions split in two: those fought before the session
 * on now (`finished`), and the one on now, if the tracker has saved any of it
 * yet (`current`: it saves every five minutes through a battle, so this is
 * the session so far, not its result). With no battle on, all are finished.
 */
export function splitSessions(sessions: TrackedBattle[], sessionStart: number | null): { finished: TrackedBattle[]; current: TrackedBattle | null } {
  if (sessionStart === null) return { finished: sessions, current: null }
  // A battle's row is keyed by its session's start, to the minute.
  const isCurrent = (battle: TrackedBattle) => Date.parse(battle.startedAt) >= sessionStart - 60_000
  return { finished: sessions.filter((battle) => !isCurrent(battle)), current: sessions.find(isCurrent) ?? null }
}

/** A session's points as it ended: the marker's last word when it has any, else the last minute that had any. */
export function resultOf(battle: TrackedBattle): { attacker: number; defender: number } | null {
  if (battle.result && (battle.result.attacker || battle.result.defender)) return battle.result
  for (let index = battle.points.length - 1; index >= 0; index--) {
    const [, attacker, defender] = battle.points[index]
    if (attacker || defender) return { attacker, defender }
  }
  return battle.result
}
