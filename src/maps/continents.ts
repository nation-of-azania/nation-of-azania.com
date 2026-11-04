import { CONTINENT_GRID } from './continents-grid'
import type { Point } from './geo'
import { WORLD_NORTH, WORLD_WEST, WORLD_WIDTH } from './source'

/**
 * The continent under a spot of the Rulercraft world, which is the Earth
 * drawn equirectangular (src/maps/globe.ts): a lookup in a quarter-degree
 * grid made from Natural Earth's countries by scripts/make-continents.ts,
 * the sea taking the nearest continent, so every spot has one.
 *
 * The conventions are Natural Earth's (Central America and the Caribbean
 * are North America, Egypt Africa, Turkey and the Caucasus Asia,
 * Indonesia Asia and New Guinea's east Oceania), with Russia split at the
 * Urals (60° E) and Turkey's East Thrace in Europe; Greenland is North
 * America. Pure, for the server and the browser; the grid is 6 kB
 * gzipped, so only what shows the world's statistics imports this.
 */

export type ContinentId = (typeof CONTINENT_GRID.ids)[number]

export type Continent = { id: ContinentId; name: string; short: string }

/** The continents, in the order the grid codes them (alphabetical). */
export const CONTINENTS: readonly Continent[] = [
  { id: 'africa', name: 'Africa', short: 'Africa' },
  { id: 'antarctica', name: 'Antarctica', short: 'Antarctica' },
  { id: 'asia', name: 'Asia', short: 'Asia' },
  { id: 'europe', name: 'Europe', short: 'Europe' },
  { id: 'north-america', name: 'North America', short: 'N. America' },
  { id: 'oceania', name: 'Oceania', short: 'Oceania' },
  { id: 'south-america', name: 'South America', short: 'S. America' },
]

export const continentById = (id: ContinentId): Continent => CONTINENTS[CONTINENT_GRID.ids.indexOf(id)]

/** Each continent's land in chunks (16 × 16 blocks) as the map's flat blocks measure it: the poles' land is drawn wide, so Antarctica is the largest. */
export const LAND_CHUNKS: Readonly<Record<ContinentId, number>> = CONTINENT_GRID.landChunks

const BLOCKS_PER_CELL = WORLD_WIDTH / CONTINENT_GRID.cols
const RUN = /([A-G])(\d+)/g

/** The continent a spot (x, z in blocks; any copy of the world east or west) is on, or nearest to. */
export function continentAt([x, z]: Point): ContinentId {
  const col = (((Math.floor((x - WORLD_WEST) / BLOCKS_PER_CELL) % CONTINENT_GRID.cols) + CONTINENT_GRID.cols) % CONTINENT_GRID.cols)
  const row = Math.min(CONTINENT_GRID.rows - 1, Math.max(0, Math.floor((z - WORLD_NORTH) / BLOCKS_PER_CELL)))
  let seen = 0
  for (const [, code, run] of CONTINENT_GRID.runs[row].matchAll(RUN)) {
    seen += Number(run)
    if (col < seen) return CONTINENT_GRID.ids[code.charCodeAt(0) - 65]
  }
  return CONTINENT_GRID.ids[0]
}
