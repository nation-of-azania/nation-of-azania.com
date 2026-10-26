import type { Abroad, AbroadNation, AbroadTown } from './abroad'
import type { Bounds, Outline, Point } from './geo'
import { WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH, wrapPoint } from './source'
import { isServerKind } from './trading'

/**
 * Who holds the ground, as one picture of numbers: the world's claims
 * painted into a grid the size of a texture, each cell holding the number
 * of the nation whose claim covers its middle. The globe
 * (src/components/maps/globe) draws its borders and fills from it, a
 * border wherever a cell's neighbour holds another number, and reads it
 * back to say what was clicked: one array for both, so what is drawn and
 * what is picked can never disagree. Built in the browser from the claims
 * it already has, and never sent anywhere.
 *
 *   0         unclaimed
 *   1         Azania (its own towns, from the map's data)
 *   2         towns of no nation
 *   3         the server's own trading outposts and landmarks
 *   4–254     the world's nations, in the reading's order
 *   255       every nation past those
 */

export const NUMBER = { none: 0, azania: 1, stateless: 2, server: 3, first: 4, past: 255 } as const

/** The numbers, row by row from the north-west, and which nation each number is (by number; null for those that are none). */
export type Numbers = { ids: Uint8Array; width: number; height: number; nations: (AbroadNation | null)[] }

/** How the world's towns are numbered: by their nation, in the reading's order; the server's places and the towns of no nation apart. */
export function nationNumbering(world: Abroad | null): {
  numberOf: (town: AbroadTown) => number
  nations: (AbroadNation | null)[]
} {
  const nations: (AbroadNation | null)[] = new Array(256).fill(null)
  const byName = new Map<string, number>()
  for (const [i, nation] of (world?.nations ?? []).entries()) {
    const number = Math.min(NUMBER.past, NUMBER.first + i)
    byName.set(nation.name, number)
    if (number < NUMBER.past) nations[number] = nation
  }
  return {
    numberOf: (town) =>
      isServerKind(town.kind) ? NUMBER.server : town.nation ? (byName.get(town.nation) ?? NUMBER.past) : NUMBER.stateless,
    nations,
  }
}

/** Blocks to a cell, across and down. */
const cellBlocks = (width: number) => WORLD_WIDTH / width

/**
 * Paints one claim's outline into the grid with `value`: every cell whose
 * middle lies inside it, by the even-odd rule, scan line by scan line. The
 * claims follow the chunk grid, so their edges are mostly upright and a
 * row's crossings are few; a slanted edge is crossed where it is. A claim
 * too small to cover any cell's middle still takes the cell under its own
 * middle, so the smallest claim can be seen and picked. Corners past the
 * world's edges (a claim on the last column reaches x = 36,864; one at the
 * pole a chunk past it) are held at the edge. Returns how many cells it
 * painted.
 */
export function rasterise(target: Uint8Array, width: number, height: number, outline: Outline, value: number): number {
  const n = Math.min(outline.x.length, outline.z.length)
  if (n < 3) return 0
  const size = cellBlocks(width)
  const toColumn = (x: number) => (x - WORLD_WEST) / size
  const toRow = (z: number) => (z - WORLD_NORTH) / size
  // The outline in cells, its rows' reach.
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  let top = Infinity
  let bottom = -Infinity
  let left = Infinity
  let right = -Infinity
  for (let i = 0; i < n; i++) {
    xs[i] = Math.min(width, Math.max(0, toColumn(outline.x[i])))
    ys[i] = Math.min(height, Math.max(0, toRow(outline.z[i])))
    top = Math.min(top, ys[i])
    bottom = Math.max(bottom, ys[i])
    left = Math.min(left, xs[i])
    right = Math.max(right, xs[i])
  }
  let painted = 0
  const crossings: number[] = []
  const first = Math.max(0, Math.ceil(top - 0.5))
  const last = Math.min(height - 1, Math.ceil(bottom - 0.5) - 1)
  for (let row = first; row <= last; row++) {
    const y = row + 0.5
    crossings.length = 0
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const y0 = ys[j]
      const y1 = ys[i]
      // Half-open, so a corner on the scan line is crossed once.
      if (y0 <= y === y1 <= y) continue
      crossings.push(xs[j] + ((y - y0) / (y1 - y0)) * (xs[i] - xs[j]))
    }
    crossings.sort((a, b) => a - b)
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil(crossings[k] - 0.5))
      const to = Math.min(width - 1, Math.ceil(crossings[k + 1] - 0.5) - 1)
      if (to < from) continue
      target.fill(value, row * width + from, row * width + to + 1)
      painted += to - from + 1
    }
  }
  if (painted === 0 && Number.isFinite(left)) {
    const column = Math.min(width - 1, Math.max(0, Math.floor((left + right) / 2)))
    const row = Math.min(height - 1, Math.max(0, Math.floor((top + bottom) / 2)))
    target[row * width + column] = value
    painted = 1
  }
  return painted
}

/** The cell under a block, in the real world. */
export function cellAt(width: number, height: number, point: Point): number {
  const [x, z] = wrapPoint(point)
  const size = cellBlocks(width)
  const column = Math.min(width - 1, Math.max(0, Math.floor((x - WORLD_WEST) / size)))
  const row = Math.min(height - 1, Math.max(0, Math.floor((Math.min(WORLD_SOUTH, Math.max(WORLD_NORTH, z)) - WORLD_NORTH) / size)))
  return row * width + column
}

/** Who holds the block: its number. */
export const numberAt = (numbers: Numbers, p: Point): number => numbers.ids[cellAt(numbers.width, numbers.height, p)]

/**
 * Paints Azania's own towns: what the globe shows the moment it opens,
 * before the world has arrived, and over the world once it has, so Azania
 * wins wherever a reading overlaps it.
 */
export function paintAzania(target: Uint8Array, width: number, height: number, towns: { claims: Outline[] }[]): void {
  for (const town of towns) for (const claim of town.claims) rasterise(target, width, height, claim, NUMBER.azania)
}

/**
 * Paints the world's towns, a town at a time, handing back control between
 * them so the painting can be spread over the browser's idle moments: the
 * caller steps it until it's done, and paints Azania's own last.
 */
export function* paintWorld(
  target: Uint8Array,
  width: number,
  height: number,
  world: Abroad,
  numberOf: (town: AbroadTown) => number,
): Generator<void, void, void> {
  for (const town of world.towns) {
    const value = numberOf(town)
    for (const claim of town.claims) rasterise(target, width, height, claim, value)
    yield
  }
}

/**
 * How much of each patch of the grid is Azania's, as a coarser picture:
 * each of its cells the share of the cells beneath it that hold Azania's
 * number, from 0 to 255. Smoothed by the GPU's own filtering, it gives the
 * soft saffron halo the globe draws about the nation. `within`, the
 * blocks Azania's claims lie in, spares the scan the rest of the world.
 */
export function azaniaMask(numbers: Numbers, width = 1024, height = 512, within?: Bounds | null): Uint8Array {
  const mask = new Uint8Array(width * height)
  const sx = numbers.width / width
  const sy = numbers.height / height
  const per = sx * sy
  const size = cellBlocks(numbers.width)
  const rows = within
    ? {
        from: Math.max(0, Math.floor((within.minZ - WORLD_NORTH) / size) - 1),
        to: Math.min(numbers.height - 1, Math.ceil((within.maxZ - WORLD_NORTH) / size) + 1),
      }
    : { from: 0, to: numbers.height - 1 }
  // And across, only as far as Azania reaches, unless it runs over the world's edge, where it may come round from the far side.
  const columns =
    within && within.minX >= WORLD_WEST && within.maxX < WORLD_WEST + WORLD_WIDTH
      ? {
          from: Math.max(0, Math.floor((within.minX - WORLD_WEST) / size) - 1),
          to: Math.min(numbers.width - 1, Math.ceil((within.maxX - WORLD_WEST) / size) + 1),
        }
      : { from: 0, to: numbers.width - 1 }
  for (let y = rows.from; y <= rows.to; y++) {
    const base = y * numbers.width
    const out = Math.floor(y / sy) * width
    for (let x = columns.from; x <= columns.to; x++) if (numbers.ids[base + x] === NUMBER.azania) mask[out + Math.floor(x / sx)]++
  }
  // Counts to shares; a patch of 4 × 4 holds at most 16, so the counting never overflows a byte.
  for (let i = 0; i < mask.length; i++) if (mask[i]) mask[i] = Math.round((255 * mask[i]) / per)
  return mask
}
