import { TILE_SIZE, type Point } from './geo'

/**
 * Where Azania Maps' pictures come from: the Rulercraft server's Dynmap.
 * Shared by the server (clippings, the tile cache) and the browser (the
 * slippy map), so nothing here may import server-only code.
 */

/**
 * How far the rendered world reaches: Dynmap draws x in [WORLD_WEST,
 * WORLD_EAST), 73,728 blocks (its level-5 tiles run from column −18 to
 * 17), and z over the level-5 rows −9 to 9, from WORLD_NORTH to
 * WORLD_SOUTH: a sheet two blocks wide for every one tall, with a little
 * void drawn past the poles. The world doesn't wrap in the game — nobody
 * walks west out of one edge into the other — but the live map repeats it
 * to either side so it can be scrolled without end
 * (src/components/maps/leaflet/canvas.tsx), and says the repeats aren't
 * real without a word (src/components/maps/layers/WorldEdge.tsx).
 * WORLD_LIMIT (src/maps/geo.ts) stays the generous bound the server checks
 * coordinates against; this is the picture's own extent.
 */
export const WORLD_WIDTH = 73_728
export const WORLD_WEST = -WORLD_WIDTH / 2
export const WORLD_EAST = WORLD_WIDTH / 2
export const WORLD_NORTH = -18_496
export const WORLD_SOUTH = 20_416

/** Which copy of the world an x lies in: 0 the real one, 1 the echo east of it, −1 the one west. */
export const worldCopyOf = (x: number): number => Math.floor((x - WORLD_WEST) / WORLD_WIDTH)

/** Whether a point lies in the real world, not in an echo of it. */
export const inWorld = ([x]: Point): boolean => x >= WORLD_WEST && x < WORLD_EAST

/** The same spot in the real world, for a point in an echo. */
export const wrapPoint = ([x, z]: Point): Point => [x - worldCopyOf(x) * WORLD_WIDTH, z]

/** The nearest spot in the real world: an x past its edge is held at the edge, so nothing is ever drawn in an echo. */
export const clampToWorld = ([x, z]: Point): Point => [
  Math.min(WORLD_EAST - 1, Math.max(WORLD_WEST, x)),
  z,
]

export const DYNMAP_URL = 'https://map.rulercraft.com'
export const DYNMAP_WORLD = 'RulerEarth'

/** The flat map is the one Azania uses; Dynmap's others (biomes, 3D) aren't drawn here. */
export const MAPS = {
  flat: { label: 'Map', prefix: 'flat', dynmapName: 'flat', maxLevel: 5 },
} as const
export type MapName = keyof typeof MAPS

export const isMapName = (value: unknown): value is MapName => typeof value === 'string' && value in MAPS

/**
 * A Dynmap tile's address. Level n tiles are named after their north-west
 * level-0 tile: `<"z"×n>_<x>_<y>.jpg` in folder `<x>>5>_<y>>5>`, where
 * x = column·2ⁿ and y = −(row·2ⁿ); column and row count level-n tiles of
 * TILE_SIZE pixels from the projection's origin (see blockToPixel).
 */
export function dynmapTileUrl(map: MapName, level: number, column: number, row: number): string {
  const scale = 2 ** level
  const x = column * scale
  const y = -row * scale
  const zoomPrefix = level > 0 ? `${'z'.repeat(level)}_` : ''
  return `${DYNMAP_URL}/tiles/${DYNMAP_WORLD}/${MAPS[map].prefix}/${x >> 5}_${y >> 5}/${zoomPrefix}${x}_${y}.jpg`
}

/**
 * The same tile through the site's own cache (src/app/(frontend)/maps/tiles),
 * which keeps serving it while the Rulercraft map is down.
 */
export const cachedTileUrl = (map: MapName, level: number, column: number, row: number): string =>
  `/maps/tiles/${map}/${level}/${column}/${row}.jpg`

export { TILE_SIZE }
