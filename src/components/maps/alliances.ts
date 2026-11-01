'use client'

import { useMemo } from 'react'

import { homeNationOf } from '@/maps/abroad'
import { alliancesOf, alliedBy, mergeAlliances, type Alliance, type Allied } from '@/maps/alliances'
import type { Relation } from '@/maps/data'

import { useMaps } from './context'
import { useFighters, type FightersState } from './fighters'

/**
 * The alliances the map knows (src/maps/alliances.ts), for the war view
 * and the nations' panels: Azania's own, by its diplomacy as the page has
 * it (which a diplomat may have just set, ahead of the cached pages), and
 * every one /maps/fighters serves (the diplomats' list of other nations',
 * and those the battles showed), joined. Azania's are known at once; the
 * rest come with the records, asked for when something wants them.
 */

/** Every alliance known: Azania's own from its diplomacy, joined with those the server serves. */
export function alliancesKnown(home: string | null, relations: Relation[], served: Alliance[]): Alliance[] {
  return mergeAlliances(alliancesOf({ azania: home ? [home] : [], relations }), served)
}

export type AlliancesKnown = {
  alliances: Alliance[]
  /** Whether two nations are allied, by them. */
  allied: Allied
  /** How the records' asking goes: until 'ready', only Azania's own allies are known. */
  status: FightersState['status']
}

/** The alliances known, asked for (with the records) while `wanted`; read where they're shown. */
export function useAlliances(wanted = false): AlliancesKnown {
  const { data } = useMaps()
  const fighters = useFighters(wanted)
  const home = useMemo(() => homeNationOf(data.towns), [data.towns])
  const alliances = useMemo(() => alliancesKnown(home, data.relations, fighters.alliances), [home, data.relations, fighters.alliances])
  const allied = useMemo(() => alliedBy(alliances), [alliances])
  return useMemo(() => ({ alliances, allied, status: fighters.status }), [alliances, allied, fighters.status])
}
