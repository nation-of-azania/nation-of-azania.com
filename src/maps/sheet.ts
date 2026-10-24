import { MAPS, WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST } from './source'

/**
 * The whole world as one picture: the flat map's coarsest tiles, each drawn
 * at half its size, side by side. The server makes it (/maps/sheet) and the
 * live map lays it under its tiles (src/components/maps/leaflet/sheet.ts);
 * this is the grid both agree on. Shared, so nothing here may import
 * server-only code.
 */

/** The level the sheet is made from: the coarsest the map draws. */
export const SHEET_LEVEL = MAPS.flat.maxLevel
/** A tile's extent in blocks at that level, and the pixels it takes in the sheet. */
export const SHEET_TILE_BLOCKS = 64 * 2 ** SHEET_LEVEL
export const SHEET_TILE_PX = 64

/** The level's tile grid (src/maps/geo.ts → blockToPixel): the world's columns, and its rows from top to bottom. */
export const sheetColumn = (x: number): number => Math.floor(x / SHEET_TILE_BLOCKS)
export const sheetRow = (z: number): number => Math.floor((2 * z + 128) / (128 * 2 ** SHEET_LEVEL))
export const SHEET_COLUMNS = { from: sheetColumn(WORLD_WEST), to: sheetColumn(WORLD_EAST - 1) }
export const SHEET_ROWS = { from: sheetRow(WORLD_NORTH), to: sheetRow(WORLD_SOUTH - 1) }
export const SHEET_SPAN = SHEET_COLUMNS.to - SHEET_COLUMNS.from + 1

/** Blocks to a pixel of the sheet. */
const BLOCKS_PER_PX = SHEET_TILE_BLOCKS / SHEET_TILE_PX

/**
 * The sheet's extent in blocks: the world's own, east to west the tiles'
 * edges, north to south the poles, cut where the void past them begins
 * (the first and last rows of tiles reach a little beyond).
 */
export const SHEET_BOUNDS = {
  minX: SHEET_COLUMNS.from * SHEET_TILE_BLOCKS,
  maxX: (SHEET_COLUMNS.to + 1) * SHEET_TILE_BLOCKS,
  minZ: WORLD_NORTH,
  maxZ: WORLD_SOUTH,
}

/** The sheet's size in pixels: 2304 by 1152, a world map. */
export const SHEET_WIDTH = SHEET_SPAN * SHEET_TILE_PX
export const SHEET_HEIGHT = (WORLD_SOUTH - WORLD_NORTH) / BLOCKS_PER_PX

/** Where a row of tiles is drawn in the sheet, in its pixels: the first row's top lies above it, in the void. */
export const sheetRowTop = (row: number): number =>
  (row * SHEET_TILE_BLOCKS - 64 - WORLD_NORTH) / BLOCKS_PER_PX

/**
 * Where the site serves the sheet, made and cached
 * (src/app/(frontend)/maps/sheet.webp/route.ts). It was /maps/sheet while
 * the sheet ran into the void; the new address keeps a browser's copy of
 * the old one from being laid over the new extent.
 */
export const SHEET_URL = '/maps/sheet.webp'
