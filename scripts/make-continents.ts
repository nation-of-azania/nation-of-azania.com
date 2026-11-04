/**
 * Builds src/maps/continents-grid.ts: the continent of every quarter-degree
 * cell of the Rulercraft world, for Azania Maps' world statistics
 * (src/maps/continents.ts, src/maps/worldStats.ts). Run by hand when the
 * borders want redrawing, not on build:
 *
 *   curl -o ne.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
 *   pnpm tsx scripts/make-continents.ts ne.geojson
 *
 * The world is the Earth drawn equirectangular (src/maps/globe.ts), so the
 * countries of Natural Earth (public domain, naturalearthdata.com) lie
 * where the map draws them; each takes its CONTINENT, with these changes:
 *
 * - Russia is Europe west of 60° E (the Urals) and Asia east of it;
 * - Turkey's East Thrace, west of the Bosporus, is Europe;
 * - a European country's land far from Europe (French Guiana, the Canary
 *   Islands, the Caribbean islands, Réunion) and the "Seven seas" islands
 *   (Mauritius, the Maldives, Saint Helena) take the continent nearest them.
 *
 * Then every cell of sea takes the continent nearest it on the map's own
 * flat blocks, so a town on an island too small for the grid, or out on a
 * pier, still has one. The cells are run-length coded row by row.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const CELL = 0.25
const COLS = 360 / CELL
const ROWS = 180 / CELL
const IDS = ['africa', 'antarctica', 'asia', 'europe', 'north-america', 'oceania', 'south-america'] as const
type Id = (typeof IDS)[number]
const CODE = 'ABCDEFG'

const SEA = 0
const UNASSIGNED = 255
const codeOf = (id: Id) => IDS.indexOf(id) + 1

const BY_NAME: Record<string, Id | null> = {
  Africa: 'africa',
  Antarctica: 'antarctica',
  Asia: 'asia',
  Europe: 'europe',
  'North America': 'north-america',
  Oceania: 'oceania',
  'South America': 'south-america',
  'Seven seas (open ocean)': null,
}

type Ring = [number, number][]
type Feature = { properties: { ADMIN: string; CONTINENT: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } }

const file = process.argv[2]
if (!file) throw new Error('Usage: pnpm tsx scripts/make-continents.ts <ne_50m_admin_0_countries.geojson>')
const { features } = JSON.parse(readFileSync(file, 'utf8')) as { features: Feature[] }

const grid = new Uint8Array(COLS * ROWS)
const land = new Uint8Array(COLS * ROWS)
const lonOf = (col: number) => -180 + (col + 0.5) * CELL
const latOf = (row: number) => 90 - (row + 0.5) * CELL

/** A European country's land far from Europe takes its nearest continent instead. */
const inEurope = (lon: number, lat: number) => lon >= -32 && lon <= 70 && lat >= 32 && lat <= 85

function cellCode(admin: string, id: Id | null, lon: number, lat: number, partInEurope: boolean): number {
  if (admin === 'Russia') return codeOf(lon >= 60 || lon < 0 ? 'asia' : 'europe')
  if (admin === 'Turkey' && lon < 29.05 && lat > 40.2) return codeOf('europe')
  if (!id) return UNASSIGNED
  if (id === 'europe' && !partInEurope) return UNASSIGNED
  return codeOf(id)
}

/** Fills the cells whose centres a polygon (its outline and holes, even-odd) covers. */
function fill(rings: Ring[], admin: string, id: Id | null) {
  let minLat = Infinity
  let maxLat = -Infinity
  let sumLon = 0
  let sumLat = 0
  let count = 0
  for (const [lon, lat] of rings[0]) {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    sumLon += lon
    sumLat += lat
    count += 1
  }
  const partInEurope = inEurope(sumLon / count, sumLat / count)
  const rowFrom = Math.max(0, Math.floor((90 - maxLat) / CELL))
  const rowTo = Math.min(ROWS - 1, Math.ceil((90 - minLat) / CELL))
  for (let row = rowFrom; row <= rowTo; row++) {
    const lat = latOf(row)
    const crossings: number[] = []
    for (const ring of rings)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j]
        const [x2, y2] = ring[i]
        if (y1 > lat === y2 > lat) continue
        crossings.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1))
      }
    crossings.sort((a, b) => a - b)
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const colFrom = Math.max(0, Math.ceil((crossings[k] + 180) / CELL - 0.5))
      const colTo = Math.min(COLS - 1, Math.floor((crossings[k + 1] + 180) / CELL - 0.5))
      for (let col = colFrom; col <= colTo; col++) {
        const at = row * COLS + col
        land[at] = 1
        grid[at] = cellCode(admin, id, lonOf(col), lat, partInEurope)
      }
    }
  }
}

for (const feature of features) {
  const { ADMIN: admin, CONTINENT: continent } = feature.properties
  if (!(continent in BY_NAME)) throw new Error(`Unknown continent "${continent}" for ${admin}`)
  const id = BY_NAME[continent]
  const polygons = (feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates) as Ring[][]
  for (const polygon of polygons) fill(polygon, admin, id)
}

/**
 * Every cell not yet a continent's (sea, and land left unassigned) takes the
 * nearest one's, by distance on the flat map: a chamfer distance transform
 * (1 across, √2 diagonally) with the continent carried along, run until
 * nothing changes, east and west wrapping round.
 */
const distance = new Float64Array(COLS * ROWS).fill(Infinity)
for (let at = 0; at < grid.length; at++) {
  if (grid[at] !== SEA && grid[at] !== UNASSIGNED) distance[at] = 0
  else grid[at] = SEA
}
const DIAGONAL = Math.SQRT2
const forward: [number, number, number][] = [
  [-1, -1, DIAGONAL],
  [-1, 0, 1],
  [-1, 1, DIAGONAL],
  [0, -1, 1],
]
const backward: [number, number, number][] = [
  [1, 1, DIAGONAL],
  [1, 0, 1],
  [1, -1, DIAGONAL],
  [0, 1, 1],
]
const relax = (row: number, col: number, steps: [number, number, number][]): boolean => {
  const at = row * COLS + col
  let changed = false
  for (const [dr, dc, cost] of steps) {
    const r = row + dr
    if (r < 0 || r >= ROWS) continue
    const c = (col + dc + COLS) % COLS
    const from = r * COLS + c
    if (distance[from] + cost < distance[at] - 1e-9) {
      distance[at] = distance[from] + cost
      grid[at] = grid[from]
      changed = true
    }
  }
  return changed
}
for (let pass = 1; ; pass++) {
  let changed = false
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) changed = relax(row, col, forward) || changed
  for (let row = ROWS - 1; row >= 0; row--) for (let col = COLS - 1; col >= 0; col--) changed = relax(row, col, backward) || changed
  if (!changed) break
  if (pass > 50) throw new Error('The distance transform did not settle')
}
if (grid.some((code) => code === SEA)) throw new Error('A cell was left without a continent')

// Each cell is WORLD_WIDTH / COLS blocks a side: 51.2, or 10.24 chunks of 16 × 16.
const CHUNKS_PER_CELL = (73_728 / COLS) ** 2 / 256
const landChunks = Object.fromEntries(IDS.map((id) => [id, 0])) as Record<Id, number>
for (let at = 0; at < grid.length; at++) if (land[at]) landChunks[IDS[grid[at] - 1]] += CHUNKS_PER_CELL
for (const id of IDS) landChunks[id] = Math.round(landChunks[id])

const rows: string[] = []
for (let row = 0; row < ROWS; row++) {
  let line = ''
  let col = 0
  while (col < COLS) {
    const code = grid[row * COLS + col]
    let run = 1
    while (col + run < COLS && grid[row * COLS + col + run] === code) run++
    line += `${CODE[code - 1]}${run}`
    col += run
  }
  rows.push(line)
}

const out = `/**
 * Generated by scripts/make-continents.ts from Natural Earth's countries
 * (1:50m, public domain): the continent of every ${CELL}° cell of the
 * Rulercraft world, sea cells taking the nearest. Don't edit by hand.
 *
 * \`rows\` runs north to south, each west to east from 180° W: a letter for
 * the continent (\`ids\`, A the first) and how many cells it runs for.
 * \`landChunks\` is each continent's land, in chunks of 16 × 16 blocks.
 */
export const CONTINENT_GRID = {
  cell: ${CELL},
  cols: ${COLS},
  rows: ${ROWS},
  ids: ${JSON.stringify(IDS)},
  landChunks: ${JSON.stringify(landChunks)},
  runs: [
${rows.map((row) => `    '${row}',`).join('\n')}
  ],
} as const
`
const target = path.resolve(import.meta.dirname, '../src/maps/continents-grid.ts')
writeFileSync(target, out)
console.log(`Wrote ${path.relative(process.cwd(), target)}: ${rows.reduce((n, row) => n + row.length, 0)} characters of runs`, landChunks)

/**
 * And the land itself, for the world view's little map of the world
 * (src/components/maps/panels/WorldMap.tsx): at half a degree, a cell land
 * when any quarter of it is, so an island a town stands on still shows.
 * Each row is its runs of sea and land in turn, the sea first, as lengths
 * in base 36.
 */
const LAND_STEP = 2
const LAND_COLS = COLS / LAND_STEP
const LAND_ROWS = ROWS / LAND_STEP
const landRows: string[] = []
for (let row = 0; row < LAND_ROWS; row++) {
  const cells: boolean[] = []
  for (let col = 0; col < LAND_COLS; col++) {
    let any = false
    for (let dr = 0; dr < LAND_STEP && !any; dr++)
      for (let dc = 0; dc < LAND_STEP && !any; dc++) any = land[(row * LAND_STEP + dr) * COLS + col * LAND_STEP + dc] === 1
    cells.push(any)
  }
  const runs: number[] = []
  let sea = true
  let run = 0
  for (const cell of cells) {
    if (cell === !sea) run += 1
    else {
      runs.push(run)
      sea = !sea
      run = 1
    }
  }
  runs.push(run)
  landRows.push(runs.map((n) => n.toString(36)).join(','))
}
const landOut = `/**
 * Generated by scripts/make-continents.ts from Natural Earth's countries
 * (1:50m, public domain): the land of the Rulercraft world at ${CELL * LAND_STEP}°, for
 * the world view's little map (src/components/maps/panels/WorldMap.tsx).
 * Don't edit by hand.
 *
 * \`rows\` runs north to south, each west to east from 180° W: the lengths
 * of its runs of sea and land in turn, the sea first, in base 36.
 */
export const LAND_GRID = {
  cols: ${LAND_COLS},
  rows: ${LAND_ROWS},
  runs: [
${landRows.map((row) => `    '${row}',`).join('\n')}
  ],
} as const
`
const landTarget = path.resolve(import.meta.dirname, '../src/maps/land-grid.ts')
writeFileSync(landTarget, landOut)
console.log(`Wrote ${path.relative(process.cwd(), landTarget)}: ${landRows.reduce((n, row) => n + row.length, 0)} characters of runs`)
