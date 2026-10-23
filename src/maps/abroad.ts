import { spoken, type MapTown, type Relation } from './data'
import type { Bounds, Outline, Point } from './geo'
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
}

export type AbroadNation = WorldNation & {
  slug: string
  /** Its towns, biggest first. */
  members: AbroadTown[]
  /**
   * Where its name is set far out: the middle of its heartland, the towns
   * close around its capital (else its biggest town), so a nation with a
   * colony across the sea is named at home. `extent` is that heartland's
   * bounds.
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
  /** Nations with towns abroad, the most populous first; Azania's own is never among them. */
  nations: AbroadNation[]
  /** Every town on the map by Towny id, Azania's among them: what a siege names. */
  byId: Map<string, WorldTown>
  townBySlug: Map<string, AbroadTown>
  nationBySlug: Map<string, AbroadNation>
  nationByName: Map<string, AbroadNation>
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
 * the same are told apart by the id.
 */
export function abroadOf(world: World, own: Pick<MapTown, 'townyId'>[]): Abroad {
  const ours = new Set(own.map((town) => town.townyId).filter(Boolean))
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
    const abroad: AbroadTown = { ...town, claims, slug, claimBounds, bounds: unite(claimBounds) }
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
      nation.capital?.home ?? [...members].sort((a, b) => b.chunks - a.chunks).find((town) => town.home)?.home ?? null
    const near = anchor
      ? members.filter((town) => town.home && Math.hypot(town.home[0] - anchor[0], town.home[1] - anchor[1]) <= HEARTLAND)
      : []
    // Each town by the claim holding its home: an outpost across the world isn't the heartland.
    const extent = unite(near.map(abroadHomeBounds).filter((b): b is Bounds => b !== null))
    // The heartland's middle by the ground each town holds, so the name sits on the land, not the sea between.
    const weight = near.reduce((sum, town) => sum + Math.max(1, town.chunks), 0)
    const heart: Point | null = near.length
      ? [
          near.reduce((sum, town) => sum + town.home![0] * Math.max(1, town.chunks), 0) / weight,
          near.reduce((sum, town) => sum + town.home![1] * Math.max(1, town.chunks), 0) / weight,
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

/** The claim holding a town's home block: the town itself, as against its outposts; all of it when none does. */
export function abroadHomeBounds(town: Pick<AbroadTown, 'home' | 'bounds' | 'claimBounds'>): Bounds | null {
  if (!town.home) return town.bounds
  const [x, z] = town.home
  return town.claimBounds.find((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) ?? town.bounds
}

/** Blocks between two points, as the crow flies: the world doesn't wrap in the game, so neither does this. */
export const blocksBetween = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** "12,320 blocks", rounded as a person would say a long way. */
export const farWords = (blocks: number): string =>
  `${(blocks < 1000 ? Math.round(blocks / 10) * 10 : Math.round(blocks / 100) * 100).toLocaleString('en-GB')} blocks`

/** A nation's heartland as bounds to fit, when it has one; else all of it. */
export const nationFit = (nation: Pick<AbroadNation, 'extent' | 'bounds'>): Bounds | null =>
  nation.extent ?? nation.bounds
