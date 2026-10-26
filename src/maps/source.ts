import { TILE_SIZE, type Point } from './geo'

/**
 * Where Azania Maps' pictures come from: the Rulercraft server's Dynmap.
 * Shared by the server (clippings, the tile cache) and the browser (the
 * slippy map), so nothing here may import server-only code.
 */

/**
 * How far the rendered world reaches: Dynmap draws x in [WORLD_WEST,
 * WORLD_EAST), 73,728 blocks (its level-5 tiles run from column −18 to 17),
 * and z from WORLD_NORTH to WORLD_SOUTH, half as far: a world map two
 * blocks wide for every one tall. Past the poles the world is void, which
 * Dynmap leaves undrawn up close but paints black in its coarser tiles (the
 * level-5 rows −9 and 9 straddle the edges); the site's tile cache clears
 * it (voidRows), so the map simply ends there. The world doesn't wrap in
 * the game — nobody walks west out of one edge into the other — but the
 * live map repeats it to either side so it can be scrolled without end
 * (src/components/maps/leaflet/canvas.tsx), says the repeats aren't real
 * without a word (src/components/maps/layers/WorldEdge.tsx), and keeps the
 * reader in the real copy, re-basing itself a world over whenever the
 * view's centre crosses an edge (src/components/maps/leaflet/home.ts).
 * WORLD_LIMIT (src/maps/geo.ts) stays the generous bound the server checks
 * coordinates against; this is the picture's own extent.
 */
export const WORLD_WIDTH = 73_728
export const WORLD_WEST = -WORLD_WIDTH / 2
export const WORLD_EAST = WORLD_WIDTH / 2
export const WORLD_NORTH = -18_432
export const WORLD_SOUTH = 18_432

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

/**
 * The flat map's farthest zoom: two and a half levels further out than its
 * coarsest tiles, where the whole world fits beside the panel on a laptop
 * (src/components/maps/leaflet/canvas.tsx). Past it, the globe takes over
 * (src/maps/globe.ts).
 */
export const FLAT_MIN_ZOOM = -MAPS.flat.maxLevel - 2.5

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
 * The pixel rows of a tile that lie past the world's north or south edge,
 * as the rows above `from` and from `to` on (0 and TILE_SIZE when it has
 * none): the void Dynmap paints black in its coarser tiles. A tile wholly
 * past an edge has `from` ≥ `to`.
 */
export function voidRows(level: number, row: number): { from: number; to: number } {
  // A tile's pixel y at level n is (2z + 128) / 2ⁿ, less its row's TILE_SIZE times row (blockToPixel).
  const y = (z: number) => (2 * z + TILE_SIZE) / 2 ** level - TILE_SIZE * row
  return {
    from: Math.min(TILE_SIZE, Math.max(0, Math.round(y(WORLD_NORTH)))),
    to: Math.min(TILE_SIZE, Math.max(0, Math.round(y(WORLD_SOUTH)))),
  }
}

/**
 * The same tile through the site's own cache (src/app/(frontend)/maps/tiles),
 * which keeps serving it while the Rulercraft map is down.
 */
export const cachedTileUrl = (map: MapName, level: number, column: number, row: number): string =>
  `/maps/tiles/${map}/${level}/${column}/${row}.jpg`

export { TILE_SIZE }
