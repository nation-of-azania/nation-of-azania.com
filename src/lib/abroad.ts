import { unstable_cache } from 'next/cache'

import {
  abroadNationPage,
  abroadOf,
  abroadTownPage,
  homeNationOf,
  type AbroadNationPage as NationPage,
  type AbroadTownPage as TownPage,
} from '@/maps/abroad'
import type { MapData } from '@/maps/data'
import { WORLD_EVERY_S } from '@/maps/world'

import { getWorld } from './world'

/**
 * What the pages of Azania Maps for the world abroad say (/maps/abroad/…
 * and /maps/nation/…; src/maps/abroad.ts): one town or one nation out of
 * /maps/world.json's reading, in the few fields its panel shows, built by
 * the same pure functions the browser uses to show the panel before the
 * page arrives. Kept by unstable_cache, keyed by the address and Azania's
 * own towns, so a page neither waits on the Rulercraft map's 5 MB marker
 * file each time nor stops being cached (the read inside doesn't make the
 * page dynamic); the world changes slowly, so a quarter of an hour, as
 * /maps/world.json itself.
 */

export type { AbroadFacts, HomeCapital, NationSummary } from '@/maps/abroad'

/** A town abroad, Azania's own ('own'), none (null), or 'offline' while the Rulercraft map can't say. */
export type AbroadTownPage = TownPage | { kind: 'offline' }

export type AbroadNationPage = NationPage | { kind: 'offline' }

const readTown = unstable_cache(
  async (slug: string, own: string[], home: string | null): Promise<AbroadTownPage> => {
    const world = await getWorld()
    if (!world) return { kind: 'offline' }
    return abroadTownPage(abroadOf(world, own.map((townyId) => ({ townyId }))), slug, home)
  },
  ['maps-abroad-town'],
  { revalidate: WORLD_EVERY_S },
)

const readNation = unstable_cache(
  async (slug: string, own: string[], home: string | null): Promise<AbroadNationPage> => {
    const world = await getWorld()
    if (!world) return { kind: 'offline' }
    return abroadNationPage(abroadOf(world, own.map((townyId) => ({ townyId }))), slug, home)
  },
  ['maps-abroad-nation'],
  { revalidate: WORLD_EVERY_S },
)

const ownIds = (data: MapData): string[] =>
  data.towns
    .map((town) => town.townyId)
    .filter((id): id is string => Boolean(id))
    .sort()

/** A town abroad by its address; 'own' for one of Azania's, null for none, 'offline' while the map can't say. */
export const getAbroadTown = (slug: string, data: MapData): Promise<AbroadTownPage> =>
  readTown(slug, ownIds(data), homeNationOf(data.towns))

export const getAbroadNation = (slug: string, data: MapData): Promise<AbroadNationPage> =>
  readNation(slug, ownIds(data), homeNationOf(data.towns))
