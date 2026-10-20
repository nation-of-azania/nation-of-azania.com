import type { Point } from './geo'

/**
 * How a player gets somewhere on Azania Maps. Players have no `/tp`;
 * what they have is `/t spawn <town>`, which works for anyone at a town
 * whose spawn is public (Towny's "Public Teleport") and for the town's
 * own residents otherwise. So a spot is given as the nearest town's spawn
 * and the walk from its home block: "/t spawn GirlieTown, then 40 blocks
 * north-east". Pure functions, shared by the Map block's survey line and
 * the live map's panels.
 */

/** What the route needs of a town: its name as Towny spells it, its home block, whether its spawn is public. */
export type SpawnTown = {
  name: string
  home: Point | null
  publicSpawn: boolean | null
}

export type Compass = 'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west'

export type SpawnRoute = {
  /** The town whose spawn is nearest. */
  town: SpawnTown
  /** "/t spawn GirlieTown", as a player types it. */
  command: string
  /** Blocks from the home block to the spot, rounded as a person would say it; 0 when it is the spot. */
  distance: number
  direction: Compass | null
  /** "then 40 blocks north-east"; null when the spot is the spawn itself. */
  then: string | null
  /** Whether anyone may use the spawn, or only the town's residents (null: the map didn't say). */
  publicSpawn: boolean | null
}

/** Within this many blocks of the home block, a spot is "at the spawn". */
const AT_SPAWN = 8

/** "/t spawn GirlieTown": the command, with the name exactly as Towny has it. */
export const spawnCommand = (town: Pick<SpawnTown, 'name'>): string => `/t spawn ${town.name}`

/** The compass point from `from` to `to`: x grows east, z grows south. */
export function compassFrom(from: Point, to: Point): Compass | null {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  if (Math.hypot(dx, dz) < 1e-9) return null
  // Bearing clockwise from north, in eighths of a turn.
  const bearing = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2)
  const points: Compass[] = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
  return points[Math.round(bearing / (Math.PI / 4)) % 8]
}

/** A distance as a person would say it: to the block up close, to 5, 10 or 50 blocks further out. */
export function roundDistance(blocks: number): number {
  if (blocks < 20) return Math.round(blocks)
  if (blocks < 100) return Math.round(blocks / 5) * 5
  if (blocks < 1000) return Math.round(blocks / 10) * 10
  return Math.round(blocks / 50) * 50
}

/** "then 40 blocks north-east", or null for a spot at the spawn. */
export function thenWalk(distance: number, direction: Compass | null): string | null {
  if (distance === 0 || !direction) return null
  return `then ${distance.toLocaleString('en-GB')} block${distance === 1 ? '' : 's'} ${direction}`
}

/**
 * The route to a spot: the nearest town's spawn and the walk from there.
 * Public spawns are preferred, since anyone can use them; only when no
 * town has one is a private spawn offered, and the caller can say so.
 */
export function spawnRoute(point: Point, towns: SpawnTown[]): SpawnRoute | null {
  const placed = towns.filter((town): town is SpawnTown & { home: Point } => town.home !== null)
  if (placed.length === 0) return null
  const nearest = (candidates: typeof placed) =>
    candidates.reduce((best, town) =>
      Math.hypot(town.home[0] - point[0], town.home[1] - point[1]) <
      Math.hypot(best.home[0] - point[0], best.home[1] - point[1])
        ? town
        : best,
    )
  const open = placed.filter((town) => town.publicSpawn === true)
  const town = nearest(open.length ? open : placed)
  return routeFrom(town, point)
}

/** The route from one town's spawn: the town itself, when the Map block shows it. */
export function routeFrom(town: SpawnTown, point: Point): SpawnRoute {
  const raw = town.home ? Math.hypot(point[0] - town.home[0], point[1] - town.home[1]) : 0
  const distance = raw <= AT_SPAWN ? 0 : roundDistance(raw)
  const direction = distance && town.home ? compassFrom(town.home, point) : null
  return {
    town,
    command: spawnCommand(town),
    distance,
    direction,
    then: thenWalk(distance, direction),
    publicSpawn: town.publicSpawn,
  }
}
