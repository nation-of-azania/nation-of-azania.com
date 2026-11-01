'use client'

import { useEffect } from 'react'

import type { FighterRecord } from '@/maps/fighters'

import { createStore, useStore } from './hooks'

/**
 * The fighters' records, as /maps/fighters serves them (src/maps/fighters.ts):
 * each player's turnout, tries at the banner, deaths, minutes, sessions
 * won and lost, and their usual hours online. Asked for once, the first
 * time something on the page wants them (the war view, a player's
 * record), never on a page load and never polled: the CDN keeps a copy a
 * quarter of an hour, and so does this, asking again only when something
 * wants them after that. One store for the page, read where it's shown.
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
  players: FighterEntry[]
  /** By lower-cased name, since the feed and the marker file don't always agree on case. */
  byName: Map<string, FighterEntry>
}

const IDLE: FightersState = { status: 'idle', at: 0, since: null, battles: 0, days: 0, demo: false, players: [], byName: new Map() }

/** How long a reading serves before something wanting the records asks again: the CDN's own quarter of an hour. */
const FRESH_MS = 15 * 60_000

const store = createStore<FightersState>(IDLE)
let inFlight: Promise<void> | null = null

const isRecord = (value: unknown): value is FighterEntry => {
  const record = value as FighterEntry
  return Boolean(record) && typeof record.name === 'string' && typeof record.could === 'number' && typeof record.fought === 'number'
}

function ask(): void {
  const current = store.get()
  if (inFlight || (current.status === 'ready' && Date.now() - current.at < FRESH_MS)) return
  if (current.status !== 'ready') store.set({ ...current, status: 'asking' })
  inFlight = fetch('/maps/fighters')
    .then(async (response) => {
      if (!response.ok) throw new Error(`The records answered ${response.status}`)
      const body = (await response.json()) as Partial<Omit<FightersState, 'byName' | 'status'>> & { players?: unknown[] }
      const players = (Array.isArray(body.players) ? body.players : []).filter(isRecord).map((record) => ({ ...record, hours: Array.isArray(record.hours) ? record.hours : null }))
      store.set({
        status: 'ready',
        at: typeof body.at === 'number' ? body.at : Date.now(),
        since: typeof body.since === 'string' ? body.since : null,
        battles: typeof body.battles === 'number' ? body.battles : 0,
        days: typeof body.days === 'number' ? body.days : 0,
        demo: Boolean(body.demo),
        players,
        byName: new Map(players.map((record) => [record.name.toLowerCase(), record])),
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
