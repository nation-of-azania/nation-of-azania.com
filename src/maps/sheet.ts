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

/** The sheet's size in pixels. */
export const SHEET_WIDTH = SHEET_SPAN * SHEET_TILE_PX
export const SHEET_HEIGHT = (SHEET_ROWS.to - SHEET_ROWS.from + 1) * SHEET_TILE_PX

/** The sheet's extent in blocks: its tiles' own edges. */
export const SHEET_BOUNDS = {
  minX: SHEET_COLUMNS.from * SHEET_TILE_BLOCKS,
  maxX: (SHEET_COLUMNS.to + 1) * SHEET_TILE_BLOCKS,
  minZ: SHEET_ROWS.from * SHEET_TILE_BLOCKS - 64,
  maxZ: (SHEET_ROWS.to + 1) * SHEET_TILE_BLOCKS - 64,
}

/** Where the site serves the sheet, made and cached (src/app/(frontend)/maps/sheet/route.ts). */
export const SHEET_URL = '/maps/sheet'
