'use client'

import { useEffect } from 'react'

import type { Alliance, AllianceSource } from '@/maps/alliances'
import type { FighterRecord } from '@/maps/fighters'
import { TELEPORT_LOCK_SECONDS } from '@/maps/motion'

import { createStore, useStore } from './hooks'

/**
 * The fighters' records, as /maps/fighters serves them (src/maps/fighters.ts):
 * each player's turnout, tries at the banner, deaths, minutes, sessions
 * won and lost, and their usual hours online; and with them the alliances
 * known (src/maps/alliances.ts), which the Rulercraft map doesn't name.
 * Asked for once, the first time something on the page wants them (the
 * war view, a player's record, a nation's allies), never on a page load
 * and never polled: the CDN keeps a copy a quarter of an hour, and so
 * does this, asking again only when something wants them after that. One
 * store for the page, read where it's shown.
 */

export type FighterEntry = FighterRecord & { hours: number[] | null }

export type FightersState = {
  /** 'idle' until something wants them; 'asking' while on their way; 'down' when the route didn't answer. */
  status: 'idle' | 'asking' | 'ready' | 'down'
  /** When the records were counted, and from when the battles count. */
  at: number
  since: string | null
  /** How many battles, and how many days of presence, the records rest on. */
  battles: number
  days: number
  /** Made up, on one's own machine with the war demo on. */
  demo: boolean
  /** The lock after a death as the tracker has measured it: the quickest teleport seen after one, and how many it rests on; null until it has. */
  lock: { quickest: number; seen: number } | null
  /** The lock taken until then: an upper bound from deaths seen by hand. */
  lockDefault: number
  players: FighterEntry[]
  /** By lower-cased name, since the feed and the marker file don't always agree on case. */
  byName: Map<string, FighterEntry>
  /** The alliances known to the server: Azania's diplomacy, the diplomats' list of others', and those the battles showed. */
  alliances: Alliance[]
}

const IDLE: FightersState = { status: 'idle', at: 0, since: null, battles: 0, days: 0, demo: false, lock: null, lockDefault: TELEPORT_LOCK_SECONDS, players: [], byName: new Map(), alliances: [] }

/** How long a reading serves before something wanting the records asks again: the CDN's own quarter of an hour. */
const FRESH_MS = 15 * 60_000

const store = createStore<FightersState>(IDLE)
let inFlight: Promise<void> | null = null

const isRecord = (value: unknown): value is FighterEntry => {
  const record = value as FighterEntry
  return Boolean(record) && typeof record.name === 'string' && typeof record.could === 'number' && typeof record.fought === 'number'
}

const SOURCES: AllianceSource[] = ['diplomacy', 'told', 'seen']

/** An alliance as the route serves it, checked field by field: two named nations, at least one way it's known. */
export function allianceOf(value: unknown): Alliance | null {
  const raw = value as Partial<Alliance> | null
  if (!raw || !Array.isArray(raw.nations) || typeof raw.nations[0] !== 'string' || typeof raw.nations[1] !== 'string') return null
  if (!raw.nations[0].trim() || !raw.nations[1].trim()) return null
  const sources = (Array.isArray(raw.sources) ? raw.sources : []).filter((source): source is AllianceSource => SOURCES.includes(source as AllianceSource))
  if (!sources.length) return null
  const seen =
    raw.seen && typeof raw.seen === 'object' && typeof raw.seen.last === 'string'
      ? {
          battles: typeof raw.seen.battles === 'number' ? raw.seen.battles : 1,
          last: raw.seen.last,
          players: Array.isArray(raw.seen.players) ? raw.seen.players.filter((name): name is string => typeof name === 'string') : [],
        }
      : undefined
  return { nations: [raw.nations[0], raw.nations[1]], sources, ...(seen ? { seen } : {}), ...(typeof raw.note === 'string' && raw.note ? { note: raw.note } : {}) }
}

function ask(): void {
  const current = store.get()
  if (inFlight || (current.status === 'ready' && Date.now() - current.at < FRESH_MS)) return
  if (current.status !== 'ready') store.set({ ...current, status: 'asking' })
  inFlight = fetch('/maps/fighters')
    .then(async (response) => {
      if (!response.ok) throw new Error(`The records answered ${response.status}`)
      const body = (await response.json()) as Partial<Omit<FightersState, 'byName' | 'status' | 'lock' | 'alliances'>> & {
        players?: unknown[]
        alliances?: unknown[]
        lock?: { quickest?: unknown; seen?: unknown } | null
      }
      const lock = body.lock && typeof body.lock.quickest === 'number' && body.lock.quickest > 0 ? { quickest: body.lock.quickest, seen: typeof body.lock.seen === 'number' ? body.lock.seen : 1 } : null
      const players = (Array.isArray(body.players) ? body.players : []).filter(isRecord).map((record) => ({ ...record, hours: Array.isArray(record.hours) ? record.hours : null }))
      const alliances = (Array.isArray(body.alliances) ? body.alliances : []).map(allianceOf).filter((alliance): alliance is Alliance => alliance !== null)
      store.set({
        status: 'ready',
        at: typeof body.at === 'number' ? body.at : Date.now(),
        since: typeof body.since === 'string' ? body.since : null,
        battles: typeof body.battles === 'number' ? body.battles : 0,
        days: typeof body.days === 'number' ? body.days : 0,
        demo: Boolean(body.demo),
        lock,
        lockDefault: typeof body.lockDefault === 'number' ? body.lockDefault : TELEPORT_LOCK_SECONDS,
        players,
        byName: new Map(players.map((record) => [record.name.toLowerCase(), record])),
        alliances,
      })
    })
    .catch(() => {
      // What was shown stays; the next wanting asks again.
      const kept = store.get()
      store.set({ ...kept, status: kept.status === 'ready' ? 'ready' : 'down' })
    })
    .finally(() => {
      inFlight = null
    })
}

/** The records, asked for while `wanted`; read with the store's own subscription, so only what shows them follows. */
export function useFighters(wanted = true): FightersState {
  useEffect(() => {
    if (wanted) ask()
  }, [wanted])
  return useStore(store)
}

/** A player's record, by name in any case; null for one never seen near a battle. */
export const recordOf = (state: FightersState, name: string): FighterEntry | null => state.byName.get(name.toLowerCase()) ?? null
