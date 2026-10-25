import type { Point } from './geo'
import type { WorldKind } from './world'

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
  /** A server site (a quarry, a treasure ship) is nobody's spawn, and nor is a trading outpost or a landmark. */
  kind?: WorldKind
}

export type Compass = 'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west'

export type SpawnRoute<T extends SpawnTown = SpawnTown> = {
  /** The town whose spawn to use. */
  town: T
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
 * The route to a spot: the nearest town's spawn and the walk from there. A
 * public spawn, which anyone can use, is preferred over a nearer private
 * one within reason (twice the distance, or 500 blocks more); when the
 * nearest usable spawn is private all the same, the caller says so. A town
 * whose spawn the map doesn't describe counts as public. Server sites
 * (quarries, treasure ships) have no residents, so no spawn worth giving;
 * nor do the server's trading outposts and landmarks, which are no towns.
 */
export function spawnRoute<T extends SpawnTown>(point: Point, towns: T[]): SpawnRoute<T> | null {
  const reach = (town: T & { home: Point }) => Math.hypot(point[0] - town.home[0], point[1] - town.home[1])
  const placed = towns
    .filter((town): town is T & { home: Point } => town.home !== null && (town.kind ?? 'town') === 'town')
    .sort((a, b) => reach(a) - reach(b))
  if (placed.length === 0) return null
  const nearest = placed[0]
  const open = placed.find((town) => town.publicSpawn !== false)
  const chosen =
    nearest.publicSpawn === false && open && reach(open) <= Math.max(reach(nearest) * 2, reach(nearest) + 500)
      ? open
      : nearest
  return routeFrom(chosen, point)
}

/** The route from one town's spawn: the town itself, when the Map block shows it. */
export function routeFrom<T extends SpawnTown>(town: T, point: Point): SpawnRoute<T> {
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
