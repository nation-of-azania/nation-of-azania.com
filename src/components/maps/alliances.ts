'use client'

import { useEffect, useMemo } from 'react'

import { homeNationOf } from '@/maps/abroad'
import { alliancesOf, alliedBy, mergeAlliances, type Alliance, type Allied } from '@/maps/alliances'
import type { Relation } from '@/maps/data'

import { useMaps } from './context'
import { allianceOf, useFighters, type FightersState } from './fighters'
import { createStore, useStore } from './hooks'

/**
 * The alliances the map knows (src/maps/alliances.ts), for the war view
 * and the nations' panels: Azania's own, by its diplomacy as the page has
 * it (which a diplomat may have just set, ahead of the cached pages), and
 * every one the server serves (the diplomats' list of other nations', and
 * those the battles showed), joined. Azania's are known at once; the rest
 * come when something wants them: with the fighters' records in the war
 * view (/maps/fighters, a quarter of an hour at the CDN), or, for a
 * nation's panel, on their own from /maps/alliances, which the CDN keeps
 * six hours, so a nation looked at in peacetime doesn't wake the database.
 */

/** Every alliance known: Azania's own from its diplomacy, joined with those the server serves. */
export function alliancesKnown(home: string | null, relations: Relation[], served: Alliance[]): Alliance[] {
  return mergeAlliances(alliancesOf({ azania: home ? [home] : [], relations }), served)
}

export type AlliancesKnown = {
  alliances: Alliance[]
  /** Whether two nations are allied, by them. */
  allied: Allied
  /** How the asking goes: until 'ready', only Azania's own allies are known. */
  status: FightersState['status']
}

type Served = { status: FightersState['status']; at: number; alliances: Alliance[] }

/** How long /maps/alliances serves before something wanting it asks again. */
const FRESH_MS = 60 * 60_000

const served = createStore<Served>({ status: 'idle', at: 0, alliances: [] })
let inFlight: Promise<void> | null = null

function ask(): void {
  const current = served.get()
  if (inFlight || (current.status === 'ready' && Date.now() - current.at < FRESH_MS)) return
  if (current.status !== 'ready') served.set({ ...current, status: 'asking' })
  inFlight = fetch('/maps/alliances')
    .then(async (response) => {
      if (!response.ok) throw new Error(`The alliances answered ${response.status}`)
      const body = (await response.json()) as { alliances?: unknown[] }
      const alliances = (Array.isArray(body.alliances) ? body.alliances : []).map(allianceOf).filter((alliance): alliance is Alliance => alliance !== null)
      served.set({ status: 'ready', at: Date.now(), alliances })
    })
    .catch(() => {
      const kept = served.get()
      served.set({ ...kept, status: kept.status === 'ready' ? 'ready' : 'down' })
    })
    .finally(() => {
      inFlight = null
    })
}

/**
 * The alliances known, read where they're shown. `wanted`: `true` asks for
 * them with the fighters' records (the war view, which wants those
 * anyway); `'alone'` asks /maps/alliances only (a nation's panel), unless
 * the records are here already; `false` asks for nothing.
 */
export function useAlliances(wanted: boolean | 'alone' = false): AlliancesKnown {
  const { data } = useMaps()
  const fighters = useFighters(wanted === true)
  const own = useStore(served)
  useEffect(() => {
    if (wanted === 'alone' && fighters.status !== 'ready') ask()
  }, [wanted, fighters.status])
  const home = useMemo(() => homeNationOf(data.towns), [data.towns])
  const source = fighters.status === 'ready' ? { alliances: fighters.alliances, status: fighters.status } : own.status === 'ready' || wanted === 'alone' ? own : fighters
  const alliances = useMemo(() => alliancesKnown(home, data.relations, source.alliances), [home, data.relations, source.alliances])
  const allied = useMemo(() => alliedBy(alliances), [alliances])
  return useMemo(() => ({ alliances, allied, status: source.status }), [alliances, allied, source.status])
}
