import { beliefsOf, type Beliefs } from './beliefs'
import { claimParts, mainBounds, type ClaimPart } from './claims'
import { spoken, type MapTown, type Relation } from './data'
import type { Bounds, Outline, Point } from './geo'
import { compassFrom, routeFrom, spawnRoute, type Compass, type SpawnRoute, type SpawnTown } from './spawn'
import { isServerKind } from './trading'
import { mapsHref } from './url'
import type { World, WorldNation, WorldTown } from './world'

/**
 * The world abroad, as Azania Maps draws it around the nation: every other
 * nation's towns and the towns of no nation, read from /maps/world
 * (src/maps/world.ts) and made ready for the map, the panels and the
 * search. Azania's own towns are in the world too; they are matched by
 * Towny's id and left to the map's own layers, which draw them in full
 * colour. Pure functions only, so the server's pages for a town or a
 * nation abroad say exactly what the map does.
 */

/** "The_Balkan_Kingdom" → "the-balkan-kingdom": the address of a town or a nation abroad. */
export const worldSlug = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'town'

export type AbroadTown = WorldTown & {
  slug: string
  /** Of all its claims, for culling. */
  bounds: Bounds | null
  /** Each claim's own, in the same order: an outpost far off is culled on its own. */
  claimBounds: Bounds[]
  /** Its claims told apart: the town itself, then its outposts, then any detached (src/maps/claims.ts). */
  parts: ClaimPart[]
}

export type AbroadNation = WorldNation & {
  slug: string
  /** Its towns, biggest first. */
  members: AbroadTown[]
  /**
   * Where its name is set far out: the middle of its heartland, the towns
   * close around its capital (else its biggest town), so a nation with a
   * colony across the sea is named at home. `extent` is that heartland's
   * bounds. Only the towns themselves count: an outpost or a detached
   * claim, however far, never stretches a nation's name.
   */
  heart: Point | null
  extent: Bounds | null
  /** The bounds of every claim it has, for fitting the map to it. */
  bounds: Bounds | null
}

export type Abroad = {
  /** When the Rulercraft map last wrote its markers. */
  at: number
  towns: AbroadTown[]
  /**
   * Nations with towns abroad, the most populous first. Azania's own Towny
   * nation is among them only while it has a town the map doesn't hold yet;
   * the maps never name it twice.
   */
  nations: AbroadNation[]
  /** Every town on the map by Towny id, Azania's among them: what a siege names. */
  byId: Map<string, WorldTown>
  townBySlug: Map<string, AbroadTown>
  nationBySlug: Map<string, AbroadNation>
  nationByName: Map<string, AbroadNation>
  /** The reading it was made from, Azania's own towns and nation among the rest. */
  reading: World
  /** Azania's own towns, by Towny id. */
  ours: Set<string>
}

const outlineBounds = (outline: Outline): Bounds | null =>
  outline.x.length
    ? {
        minX: Math.min(...outline.x),
        maxX: Math.max(...outline.x),
        minZ: Math.min(...outline.z),
        maxZ: Math.max(...outline.z),
      }
    : null

const unite = (all: Bounds[]): Bounds | null =>
  all.length
    ? {
        minX: Math.min(...all.map((b) => b.minX)),
        maxX: Math.max(...all.map((b) => b.maxX)),
        minZ: Math.min(...all.map((b) => b.minZ)),
        maxZ: Math.max(...all.map((b) => b.maxZ)),
      }
    : null

/** How far from its biggest town a nation's heartland reaches, in blocks. */
const HEARTLAND = 4500

/**
 * The world, made ready: Azania's own towns (by Towny id) taken out, the
 * rest given addresses and bounds, and every nation its towns and its
 * heartland. Slugs are unique: Towny's names are, and two that come out
 * the same are told apart by the id, or else by the home block.
 */
export function abroadOf(world: World, own: Pick<MapTown, 'townyId'>[]): Abroad {
  const ours = new Set(own.map((town) => town.townyId).filter((id): id is string => Boolean(id)))
  const byId = new Map<string, WorldTown>()
  const townBySlug = new Map<string, AbroadTown>()
  const towns: AbroadTown[] = []
  for (const town of world.towns) {
    if (town.id) byId.set(town.id, town)
    if (town.id && ours.has(town.id)) continue
    // Only whole outlines, so each claim and its bounds keep step.
    const claims = town.claims.filter((claim) => claim.x.length >= 3 && claim.x.length === claim.z.length)
    const claimBounds = claims.map(outlineBounds).filter((b): b is Bounds => b !== null)
    let slug = worldSlug(town.name)
    if (townBySlug.has(slug)) slug = `${slug}-${(town.id ?? String(towns.length)).slice(0, 4)}`
    // Two of the spawn town's places of one name share its id's start: told apart by where they stand.
    if (townBySlug.has(slug) && town.home) slug = worldSlug(`${town.name} ${town.home[0]} ${town.home[1]}`)
    const parts = claimParts(claims, town.home, town.outposts ?? [], { site: town.kind !== 'town' })
    const abroad: AbroadTown = { ...town, claims, slug, claimBounds, bounds: unite(claimBounds), parts }
    townBySlug.set(slug, abroad)
    towns.push(abroad)
  }

  const nations: AbroadNation[] = []
  for (const nation of world.nations) {
    const members = towns
      .filter((town) => town.nation === nation.name)
      .sort((a, b) => b.residents - a.residents || b.chunks - a.chunks)
    // A nation whose every town is Azania's (a town listed by name, alone in a nation of its own) isn't abroad.
    if (members.length === 0) continue
    // Its heartland is about its capital, else its biggest town.
    const anchor =
      nation.capital?.home ??
      [...members].sort((a, b) => townChunks(b) - townChunks(a)).find((town) => town.home)?.home ??
      null
    const near = anchor
      ? members.filter((town) => town.home && Math.hypot(town.home[0] - anchor[0], town.home[1] - anchor[1]) <= HEARTLAND)
      : []
    // Each town by itself: an outpost across the world, or a claim detached from it, isn't the heartland.
    const extent = unite(near.map(abroadHomeBounds).filter((b): b is Bounds => b !== null))
    // The heartland's middle by the ground each town itself holds, so the name sits on the land, not the sea between.
    const weight = near.reduce((sum, town) => sum + Math.max(1, townChunks(town)), 0)
    const heart: Point | null = near.length
      ? [
          near.reduce((sum, town) => sum + town.home![0] * Math.max(1, townChunks(town)), 0) / weight,
          near.reduce((sum, town) => sum + town.home![1] * Math.max(1, townChunks(town)), 0) / weight,
        ]
      : anchor
    nations.push({
      ...nation,
      slug: worldSlug(nation.name),
      members,
      heart,
      extent,
      bounds: unite(members.map((town) => town.bounds).filter((b): b is Bounds => b !== null)),
    })
  }
  return {
    at: world.at,
    towns,
    nations,
    byId,
    townBySlug,
    nationBySlug: new Map(nations.map((nation) => [nation.slug, nation])),
    nationByName: new Map(nations.map((nation) => [nation.name, nation])),
    reading: world,
    ours,
  }
}

/**
 * Azania's Towny nation: the one most of the nation's towns belong to
 * ("Azania"), whatever the settings call it; null when none has one. A
 * town listed by name sits in a nation of its own, or none, and doesn't
 * outvote the rest.
 */
export function homeNationOf(towns: Pick<MapTown, 'nation'>[]): string | null {
  const counts = new Map<string, number>()
  for (const town of towns) if (town.nation) counts.set(town.nation, (counts.get(town.nation) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}

/** A nation's name as the admins may have typed it: case, spaces and underscores don't matter. */
const nationKey = (name: string): string => spoken(name).trim().toLowerCase().replace(/\s+/g, ' ')

export const sameNation = (a: string | null | undefined, b: string | null | undefined): boolean =>
  Boolean(a && b) && nationKey(a!) === nationKey(b!)

/** Where Azania stands with a nation, as Settings → Azania Maps says; null for a neutral one. */
export const relationWith = (nation: string | null | undefined, relations: Relation[]): Relation | null =>
  nation ? (relations.find((relation) => sameNation(relation.nation, nation)) ?? null) : null

/** The middle of a town's claims, when it has no home on the map. */
export const abroadCentre = (town: Pick<AbroadTown, 'home' | 'bounds'>): Point | null =>
  town.home ??
  (town.bounds ? [(town.bounds.minX + town.bounds.maxX) / 2, (town.bounds.minZ + town.bounds.maxZ) / 2] : null)

/**
 * The town itself, as against its outposts and any claims detached from
 * it: its main part's bounds (src/maps/claims.ts); all of it when it has
 * no parts.
 */
export const abroadHomeBounds = (town: Pick<AbroadTown, 'parts' | 'bounds'>): Bounds | null =>
  mainBounds(town.parts) ?? town.bounds

/** The ground a town itself holds, in chunks, its outposts and anything detached left out. */
const townChunks = (town: Pick<AbroadTown, 'parts' | 'chunks'>): number =>
  town.parts.find((part) => part.role === 'main')?.chunks ?? town.chunks

/** Blocks between two points, as the crow flies: the world doesn't wrap in the game, so neither does this. */
export const blocksBetween = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** "12,320 blocks", rounded as a person would say a long way. */
export const farWords = (blocks: number): string =>
  `${(blocks < 1000 ? Math.round(blocks / 10) * 10 : Math.round(blocks / 100) * 100).toLocaleString('en-GB')} blocks`

/**
 * How much ground, in chunks, a nation must hold to be named at a zoom, far
 * out: at the scale of the world only the great ones are. The flat map's
 * names (src/components/maps/layers/AbroadLayer.tsx) and the globe's
 * (src/components/maps/globe/labels.ts) go by the same rule.
 */
export const namedFrom = (zoom: number): number => (zoom <= -6.5 ? 6000 : zoom <= -5.5 ? 2500 : zoom <= -4.5 ? 600 : 0)

/**
 * The size a nation's name is set in, in px: by how much ground it holds,
 * a little smaller far out (from −6), Azania's own (`home`) a size apart.
 */
export function nationFontSize(chunks: number, zoom: number, home: boolean): number {
  const weight = Math.min(1, Math.max(0, (Math.log10(Math.max(chunks, 1)) - 2) / 2.7))
  const far = zoom <= -6
  return Math.round(home ? (far ? 14 : 16) : far ? 8.5 + 4 * weight : 9 + 5 * weight)
}

/** A nation's heartland as bounds to fit, when it has one; else all of it. */
export const nationFit = (nation: Pick<AbroadNation, 'extent' | 'bounds'>): Bounds | null =>
  nation.extent ?? nation.bounds

/*
 * The pages of the world abroad, as their panels show them: one town or
 * one nation out of the world's reading, in the few fields its panel
 * shows. The server's cached pages are built with these
 * (src/lib/abroad.ts), and the browser builds the same panel with them the
 * moment one is opened, from the world it already holds, while the page
 * itself is on its way.
 */

/** A part of a town away from the town itself, as its panel lists it: an outpost, by its name when it has one, or detached claims. */
export type AwayPart = Pick<ClaimPart, 'role' | 'chunks' | 'centre' | 'bounds'> & { name: string | null }

/** A town abroad as its panel shows it: the facts, without the claims. */
export type AbroadFacts = Omit<AbroadTown, 'claims' | 'claimBounds' | 'bounds' | 'parts'> & {
  /** The town itself, for "Fit to town". */
  fit: Bounds | null
  /** Its outposts, then any claims detached from it. */
  away: AwayPart[]
}

/** A nation as a line: what a town's panel says of it, and a nation's of itself. */
export type NationSummary = Pick<AbroadNation, 'name' | 'slug' | 'colour' | 'towns' | 'residents' | 'chunks'> & {
  capital: { name: string; slug: string; home: Point } | null
  /** Its people's cultures and religions, by its towns (src/maps/beliefs.ts). */
  beliefs: Beliefs
}

/** Azania's capital, from which its war reaches: its name and home block. */
export type HomeCapital = { town: string; home: Point } | null

/** Another trading outpost, as seen from one of the server's places: where it is, how far and which way. */
export type NearTrading = { slug: string; name: string; blocks: number; direction: Compass | null }

/**
 * The server's trading outposts, as one of its places shows them: how many
 * there are across the world, and the few nearest it, nearest first.
 */
export type TradingAround = { count: number; nearest: NearTrading[] }

export type AbroadTownPage =
  | {
      kind: 'town'
      town: AbroadFacts
      nation: NationSummary | null
      route: SpawnRoute<SpawnTown> | null
      capital: HomeCapital
      /** For a trading outpost or a landmark, the trading outposts around it; null for a town or a site. */
      trading: TradingAround | null
    }
  /** The town is Azania's own: its page is /maps/town/<slug>. */
  | { kind: 'own'; townyId: string }
  | null

export type AbroadNationPage = {
  kind: 'nation'
  nation: NationSummary
  fit: Bounds | null
  members: AbroadFacts[]
  capital: HomeCapital
} | null

/** A town's parts away from it, for its panel. */
export const awayOf = (parts: ClaimPart[]): AwayPart[] =>
  parts
    .filter((part) => part.role !== 'main')
    .map(({ role, chunks, centre, bounds, spawns }) => ({ role, chunks, centre, bounds, name: spawns[0]?.name ?? null }))

const factsOf = (town: AbroadTown): AbroadFacts => {
  // The claims stay out of the page: its panel only lists the town's parts.
  const { claims: _claims, claimBounds: _claimBounds, bounds: _bounds, parts, ...facts } = town
  return { ...facts, fit: abroadHomeBounds(town), away: awayOf(parts) }
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
    beliefs: beliefsOf(nation.members),
  }
}

/** Azania's capital on the map, by its Towny nation's name. */
const capitalOf = (world: World, home: string | null): HomeCapital =>
  world.nations.find((nation) => sameNation(nation.name, home))?.capital ?? null

/** Only the spawns anyone may use: a reader abroad isn't a resident. */
const openSpawns = (towns: WorldTown[]): SpawnTown[] =>
  towns
    .filter((town) => town.kind === 'town' && town.home && town.publicSpawn !== false)
    .map((town) => ({ name: town.name, home: town.home, publicSpawn: town.publicSpawn, kind: town.kind }))

/**
 * The way there: the town's own `/t spawn` when anyone may use it; for a
 * private spawn, a site, a trading outpost or a landmark (nobody's spawn),
 * the nearest town's spawn anyone may use, anywhere on the server, and the
 * walk from it.
 */
function routeTo(town: AbroadTown, all: WorldTown[]): SpawnRoute<SpawnTown> | null {
  if (!town.home) return null
  const own: SpawnTown = { name: town.name, home: town.home, publicSpawn: town.publicSpawn, kind: town.kind }
  if (town.kind === 'town' && town.publicSpawn !== false) return routeFrom(own, town.home)
  return spawnRoute(town.home, openSpawns(all.filter((other) => other.id !== town.id)))
}

/** How many trading outposts the near ones of one of the server's places run to. */
const NEAREST_TRADING = 3

/** The trading outposts around one of the server's places, itself left out; null for a town or a site. */
function tradingAround(town: AbroadTown, all: AbroadTown[]): TradingAround | null {
  if (!isServerKind(town.kind)) return null
  const trading = all.filter((other) => other.kind === 'trading')
  const from = town.home
  const nearest = from
    ? trading
        .filter((other) => other.slug !== town.slug && other.home)
        .map((other) => ({ other, blocks: blocksBetween(from, other.home!) }))
        .sort((a, b) => a.blocks - b.blocks)
        .slice(0, NEAREST_TRADING)
        .map(({ other, blocks }) => ({
          slug: other.slug,
          name: other.name,
          blocks,
          direction: compassFrom(from, other.home!),
        }))
    : []
  return { count: trading.length, nearest }
}

/**
 * The server's spawn town went by RulerSpawn until the world's reading
 * split it into its trading outposts and landmarks, each with an address
 * of its own (src/lib/world.ts → spawnPlaces). Its old address has nothing
 * to show; a link to it lands on the map's front, framed on the whole
 * world, where its places all are.
 */
export const isOldSpawnTown = (slug: string): boolean => slug === 'rulerspawn'
export const OLD_SPAWN_TOWN_LANDING = mapsHref({ at: { centre: [0, 0], zoom: -7 } })

/** A town abroad by its address, as its page shows it; 'own' for one of Azania's, null for none. `home` is Azania's Towny nation. */
export function abroadTownPage(abroad: Abroad, slug: string, home: string | null): AbroadTownPage {
  const world = abroad.reading
  const town = abroad.townBySlug.get(slug)
  if (!town) {
    const ours = world.towns.find(
      (candidate) => candidate.id && abroad.ours.has(candidate.id) && worldSlug(candidate.name) === slug,
    )
    return ours?.id ? { kind: 'own', townyId: ours.id } : null
  }
  const nation = town.nation ? abroad.nationByName.get(town.nation) : null
  return {
    kind: 'town',
    town: factsOf(town),
    nation: nation ? summaryOf(nation, abroad.townBySlug) : null,
    route: routeTo(town, world.towns),
    capital: capitalOf(world, home),
    trading: tradingAround(town, abroad.towns),
  }
}

/** Another nation by its address, as its page shows it; null for none. `home` is Azania's Towny nation. */
export function abroadNationPage(abroad: Abroad, slug: string, home: string | null): AbroadNationPage {
  const nation = abroad.nationBySlug.get(slug)
  if (!nation) return null
  return {
    kind: 'nation',
    nation: summaryOf(nation, abroad.townBySlug),
    fit: nationFit(nation),
    members: nation.members.map(factsOf),
    capital: capitalOf(abroad.reading, home),
  }
}
