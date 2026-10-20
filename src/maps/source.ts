import { TILE_SIZE } from './geo'

/**
 * Where Azania Maps' pictures come from: the Rulercraft server's Dynmap.
 * Shared by the server (clippings, the tile cache) and the browser (the
 * slippy map), so nothing here may import server-only code.
 */

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
