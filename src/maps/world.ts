import type { OutpostSpawn } from './claims'
import type { Outline, Point } from './geo'
import type { TownKind } from './registry'

/**
 * The rest of the Rulercraft world, as Azania Maps shows it around the
 * nation: every Towny town and nation (/maps/world.json), and the war going on
 * (/maps/war): sieges as SiegeWar marks them, and the nations' capitals
 * with the reach of their war. Read from the Rulercraft map's marker file
 * and passed on, cached at the CDN; nothing of it is kept in the database.
 * Azania's own towns are in both, keyed by Towny's id, so the map can
 * leave them to its own layers.
 */

/**
 * How far from its capital a nation may wage war, in blocks: the server's
 * rule. The world is 73,728 blocks around, so a block is about 0.54 km at
 * the equator and this is some 6,700 km, a little short of Africa's width.
 */
export const CAPITAL_WAR_RADIUS = 12_320

/** How often the CDN refreshes each: the world changes slowly, a siege by the battle session. */
export const WORLD_EVERY_S = 900
export const WAR_EVERY_S = 180

/**
 * What a place in the world is: a Towny town or one of the server's sites
 * (TownKind), or one of the places the server's spawn town holds across
 * the world, each shown on its own (src/lib/world.ts → spawnPlaces):
 *
 * - a trading outpost ('trading'), where players trade items with the
 *   server at the prices it sets, and where new players can choose to
 *   arrive through the portals; the server's own markers call those at sea
 *   "Trading Ship" and those on land "Trading Outpost", and players call
 *   them all trading outposts;
 * - a landmark of the server's ('landmark'): a temple, a tomb, a party boat.
 *
 * Neither is a town: nobody holds one, and no siege can take it.
 */
export type WorldKind = TownKind | 'trading' | 'landmark'

export type WorldTown = {
  /** Towny's id for the town; null if the map doesn't say. For a place of the spawn town's, its own id. */
  id: string | null
  name: string
  /** Its Towny nation; null for a town without one. */
  nation: string | null
  kind: WorldKind
  capital: boolean
  ruler: string | null
  residents: number
  chunks: number
  founded: string | null
  publicSpawn: boolean | null
  /** The culture and religion its mayor chose; null when none is, and for anything but a players' town. A reading the CDN kept from before they were read has none. */
  culture: string | null
  religion: string | null
  /** A server site's pay a day, in $; what a quarry produces. */
  income: number | null
  resource: string | null
  home: Point | null
  claims: Outline[]
  /**
   * Its outposts' spawns (src/maps/claims.ts), usually one, often none.
   * A reading the CDN kept from before they were read has none.
   */
  outposts: OutpostSpawn[]
  /** Its nation's colour as the Rulercraft map draws it. */
  colour: string | null
}

export type WorldNation = {
  name: string
  /** As the Rulercraft map draws its towns' edges. */
  colour: string | null
  /** Its capital's name and home block, when it has one on the map. */
  capital: { town: string; home: Point } | null
  towns: number
  residents: number
  chunks: number
}

export type World = {
  /** When the Rulercraft map last wrote its markers, in ms since the epoch. */
  at: number
  nations: WorldNation[]
  towns: WorldTown[]
  /** True when the map didn't answer and nothing was cached: the lists are then empty. */
  offline?: boolean
}

/** Where the browser asks for the world. */
export const WORLD_URL = '/maps/world.json'

/**
 * A claim's outline as /maps/world.json sends it: its x and then its z, each
 * as the first corner and then the step to each next one. Claims follow the
 * chunk grid, so the steps are a few round numbers over and over, and they
 * compress to a third of what the corners themselves do; the claims are
 * most of the world.
 */
export type PackedOutline = [number[], number[]]
export type PackedWorld = Omit<World, 'towns'> & {
  towns: (Omit<WorldTown, 'claims'> & { claims: PackedOutline[] })[]
}

const steps = (values: number[]): number[] => values.map((value, i) => (i ? value - values[i - 1] : value))
const corners = (steps: number[]): number[] => {
  let at = 0
  return steps.map((step) => (at += step))
}

export const packWorld = (world: World): PackedWorld => ({
  ...world,
  towns: world.towns.map((town) => ({
    ...town,
    claims: town.claims.map((outline): PackedOutline => [steps(outline.x), steps(outline.z)]),
  })),
})

export const unpackWorld = (world: PackedWorld): World => ({
  ...world,
  towns: world.towns.map((town) => ({
    ...town,
    claims: town.claims.map(([x, z]) => ({ x: corners(x), z: corners(z) })),
    outposts: town.outposts ?? [],
    culture: town.culture ?? null,
    religion: town.religion ?? null,
  })),
})

/** A siege in progress, from SiegeWar's map marker. */
export type Siege = {
  /** Towny's id for the besieged town (SiegeWar keys its marker by it). */
  townId: string
  /** The besieged town, and the nation it belongs to, when the map knows it. */
  town: string | null
  townNation: string | null
  attacker: string
  defender: string
  /** Where the siege banner stands. */
  at: Point
  /** A battle is being fought now (crossed swords); otherwise the siege is quiet (a fire). */
  battle: boolean
  type: string | null
  status: string | null
  /** Battle sessions done, of how many. */
  progress: { done: number; of: number } | null
  /** Positive favours the attacker. */
  balance: number | null
  bannerControl: string | null
  battlePoints: { attacker: string; defender: string } | null
  battleTimeLeft: string | null
  warChest: string | null
  /** Every line of the marker as SiegeWar wrote it, for anything the fields above don't name. */
  lines: { label: string; value: string }[]
}

export type War = {
  /** When the Rulercraft map last wrote its markers, in ms since the epoch. */
  at: number
  sieges: Siege[]
  capitals: { nation: string; town: string; home: Point }[]
  /** CAPITAL_WAR_RADIUS, so the client and the rule never disagree. */
  radius: number
  /** True when the map didn't answer and nothing was cached: the lists are then empty. */
  offline?: boolean
}
