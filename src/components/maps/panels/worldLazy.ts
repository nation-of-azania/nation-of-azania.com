import { continentAt, CONTINENTS, type ContinentId } from '@/maps/continents'
import { CONTINENT_GRID } from '@/maps/continents-grid'
import type { Bounds, Point } from '@/maps/geo'
import { LAND_GRID } from '@/maps/land-grid'
import { WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH } from '@/maps/source'
import type { World, WorldTown } from '@/maps/world'
import { countByContinent, worldStats, type WorldStats } from '@/maps/worldStats'

/**
 * What the world view (./WorldPanel.tsx) fetches only once it's opened:
 * the world's statistics and the continents behind them, whose grids are
 * some 12 kB gzipped between them and have no business in the map's own
 * bundle. The panel imports this module with import(), so it's a chunk
 * of its own; everything the panel needs of the grids is worked out here.
 */

export { CONTINENTS, continentAt, countByContinent }
export type { ContinentId }

/** The statistics of a reading, worked out once: the same reading, from the shell's quarter-hourly ask, gives the same again. */
let last: { world: World; home: string | null; stats: WorldStats } | null = null
export function statsOf(world: World, home: string | null): WorldStats {
  if (last && last.world === world && last.home === home) return last.stats
  const stats = worldStats(world, { home })
  last = { world, home, stats }
  return stats
}

/** The whole world, as the flat map draws it: a frame to fit, and what the little map is drawn against. */
export const WORLD_BOUNDS: Bounds = { minX: WORLD_WEST, maxX: WORLD_WEST + WORLD_WIDTH, minZ: WORLD_NORTH, maxZ: WORLD_SOUTH }

/** The continent grid as a byte a cell, 0 to 6 in CONTINENTS' order, north to south then west to east; decoded once. */
let continentCells: Uint8Array | null = null
export function continentGrid(): { cols: number; rows: number; cells: Uint8Array } {
  const { cols, rows, runs } = CONTINENT_GRID
  if (!continentCells) {
    continentCells = new Uint8Array(cols * rows)
    runs.forEach((line, row) => {
      let col = 0
      for (const [, code, run] of line.matchAll(/([A-G])(\d+)/g)) {
        continentCells!.fill(code.charCodeAt(0) - 65, row * cols + col, row * cols + col + Number(run))
        col += Number(run)
      }
    })
  }
  return { cols, rows, cells: continentCells }
}

/** The land as a byte a cell, 1 for land, at the land grid's own coarser pitch; decoded once. */
let landCells: Uint8Array | null = null
export function landGrid(): { cols: number; rows: number; cells: Uint8Array } {
  const { cols, rows, runs } = LAND_GRID
  if (!landCells) {
    landCells = new Uint8Array(cols * rows)
    runs.forEach((line, row) => {
      let col = 0
      let sea = true
      for (const run of line.split(',')) {
        const length = Number.parseInt(run, 36)
        if (!sea) landCells!.fill(1, row * cols + col, row * cols + col + length)
        col += length
        sea = !sea
      }
    })
  }
  return { cols, rows, cells: landCells }
}

/** Where a town is, for the little map and the frames: its home block, else the first corner of its claims. */
export const spotOf = (town: WorldTown): Point | null =>
  town.home ?? (town.claims[0]?.x.length ? [town.claims[0].x[0], town.claims[0].z[0]] : null)

/**
 * A frame about each continent's towns and sites, for the map to fly to:
 * their bounds with a margin, and never thinner than a few thousand
 * blocks. Towns either side of the date line (Chukotka and the rest of
 * Asia) would span the world; the frame takes the shorter way round, into
 * the echo the map draws east of the world, where it may run.
 */
export function continentFrames(world: World): Partial<Record<ContinentId, Bounds>> {
  const spots: Partial<Record<ContinentId, Point[]>> = {}
  for (const town of world.towns) {
    if (town.kind === 'trading' || town.kind === 'landmark') continue
    const spot = spotOf(town)
    if (!spot) continue
    const id = continentAt(spot)
    ;(spots[id] ??= []).push(spot)
  }
  const frames: Partial<Record<ContinentId, Bounds>> = {}
  for (const { id } of CONTINENTS) {
    const points = spots[id]
    if (!points?.length) continue
    // The widest gap in longitude between neighbours: the frame starts after it.
    const xs = points.map(([x]) => x).sort((a, b) => a - b)
    let gapAt = -1
    let gap = xs[0] + WORLD_WIDTH - xs[xs.length - 1]
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] > gap) {
        gap = xs[i] - xs[i - 1]
        gapAt = i
      }
    }
    const shifted = gapAt > 0 ? points.map(([x, z]): Point => [x < xs[gapAt] ? x + WORLD_WIDTH : x, z]) : points
    const minX = Math.min(...shifted.map(([x]) => x))
    const maxX = Math.max(...shifted.map(([x]) => x))
    const minZ = Math.min(...shifted.map(([, z]) => z))
    const maxZ = Math.max(...shifted.map(([, z]) => z))
    const margin = Math.max(1500, (maxX - minX + maxZ - minZ) * 0.06)
    const padX = Math.max(0, (4000 - (maxX - minX)) / 2)
    const padZ = Math.max(0, (4000 - (maxZ - minZ)) / 2)
    frames[id] = { minX: minX - margin - padX, maxX: maxX + margin + padX, minZ: minZ - margin - padZ, maxZ: maxZ + margin + padZ }
  }
  return frames
}
