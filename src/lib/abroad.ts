import { unstable_cache } from 'next/cache'

import {
  abroadHomeBounds,
  abroadOf,
  nationFit,
  worldSlug,
  type AbroadNation,
  type AbroadTown,
} from '@/maps/abroad'
import type { MapData } from '@/maps/data'
import type { Bounds, Point } from '@/maps/geo'
import { routeFrom, spawnRoute, type SpawnRoute, type SpawnTown } from '@/maps/spawn'
import { WORLD_EVERY_S, type WorldTown } from '@/maps/world'

import { getWorld } from './world'

/**
 * What the pages of Azania Maps for the world abroad say (/maps/abroad/…
 * and /maps/nation/…; src/maps/abroad.ts): one town or one nation out of
 * /maps/world's reading, in the few fields its panel shows. Kept by
 * unstable_cache, keyed by the address and Azania's own towns, so a page
 * neither waits on the Rulercraft map's 5 MB marker file each time nor
 * stops being cached (the read inside doesn't make the page dynamic); the
 * world changes slowly, so a quarter of an hour, as /maps/world itself.
 */

/** A town abroad as its panel shows it: the facts, without the claims. */
export type AbroadFacts = Omit<AbroadTown, 'claims' | 'claimBounds' | 'bounds'> & {
  /** The claim holding its home, for "Fit to town". */
  fit: Bounds | null
  outposts: number
}

/** A nation as a line: what a town's panel says of it, and a nation's of itself. */
export type NationSummary = Pick<AbroadNation, 'name' | 'slug' | 'colour' | 'towns' | 'residents' | 'chunks'> & {
  capital: { name: string; slug: string; home: Point } | null
}

export type AbroadTownPage =
  | { kind: 'town'; town: AbroadFacts; nation: NationSummary | null; route: SpawnRoute<SpawnTown> | null }
  /** The town is Azania's own: its page is /maps/town/<slug>. */
  | { kind: 'own'; townyId: string }
  | { kind: 'offline' }
  | null

export type AbroadNationPage =
  | { kind: 'nation'; nation: NationSummary; fit: Bounds | null; members: AbroadFacts[] }
  | { kind: 'offline' }
  | null

const factsOf = (town: AbroadTown): AbroadFacts => {
  // The claims stay out of the page: its panel only says how many there are.
  const { claims: _claims, claimBounds, bounds: _bounds, ...facts } = town
  return { ...facts, fit: abroadHomeBounds(town), outposts: Math.max(0, claimBounds.length - 1) }
}

const summaryOf = (nation: AbroadNation, towns: Map<string, AbroadTown>): NationSummary => {
  const capital = nation.capital ? towns.get(worldSlug(nation.capital.town)) : undefined
  return {
    name: nation.name,
    slug: nation.slug,
    colour: nation.colour,
    towns: nation.towns,
    residents: nation.residents,
    chunks: nation.chunks,
    capital: nation.capital
      ? { name: nation.capital.town, slug: capital?.slug ?? worldSlug(nation.capital.town), home: nation.capital.home }
      : null,
  }
}

/** Only the spawns anyone may use: a reader abroad isn't a resident. */
const openSpawns = (towns: WorldTown[]): SpawnTown[] =>
  towns
    .filter((town) => town.kind === 'town' && town.home && town.publicSpawn !== false)
    .map((town) => ({ name: town.name, home: town.home, publicSpawn: town.publicSpawn, kind: town.kind }))

/**
 * The way there: the town's own `/t spawn` when anyone may use it; for a
 * private spawn or a site (nobody's spawn), the nearest spawn anyone may
 * use, anywhere on the server, and the walk from it.
 */
function routeTo(town: AbroadTown, all: WorldTown[]): SpawnRoute<SpawnTown> | null {
  if (!town.home) return null
  const own: SpawnTown = { name: town.name, home: town.home, publicSpawn: town.publicSpawn, kind: town.kind }
  if (town.kind === 'town' && town.publicSpawn !== false) return routeFrom(own, town.home)
  return spawnRoute(town.home, openSpawns(all.filter((other) => other.id !== town.id)))
}

const readTown = unstable_cache(
  async (slug: string, own: string[]): Promise<AbroadTownPage> => {
    const world = await getWorld()
    if (!world) return { kind: 'offline' }
    const abroad = abroadOf(world, own.map((townyId) => ({ townyId })))
    const town = abroad.townBySlug.get(slug)
    if (!town) {
      const ours = world.towns.find((candidate) => candidate.id && own.includes(candidate.id) && worldSlug(candidate.name) === slug)
      return ours?.id ? { kind: 'own', townyId: ours.id } : null
    }
    const nation = town.nation ? abroad.nationByName.get(town.nation) : null
    return {
      kind: 'town',
      town: factsOf(town),
      nation: nation ? summaryOf(nation, abroad.townBySlug) : null,
      route: routeTo(town, world.towns),
    }
  },
  ['maps-abroad-town'],
  { revalidate: WORLD_EVERY_S },
)

const readNation = unstable_cache(
  async (slug: string, own: string[]): Promise<AbroadNationPage> => {
    const world = await getWorld()
    if (!world) return { kind: 'offline' }
    const abroad = abroadOf(world, own.map((townyId) => ({ townyId })))
    const nation = abroad.nationBySlug.get(slug)
    if (!nation) return null
    return {
      kind: 'nation',
      nation: summaryOf(nation, abroad.townBySlug),
      fit: nationFit(nation),
      members: nation.members.map(factsOf),
    }
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
export const getAbroadTown = (slug: string, data: MapData): Promise<AbroadTownPage> => readTown(slug, ownIds(data))

export const getAbroadNation = (slug: string, data: MapData): Promise<AbroadNationPage> => readNation(slug, ownIds(data))
