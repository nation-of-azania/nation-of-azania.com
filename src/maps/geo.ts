/**
 * Azania Maps geometry, in Minecraft block coordinates: x grows east, z
 * grows south. Everything the site stores on the map (claims, places, roads,
 * events, drawings) is in blocks, never in pixels, so it stays put at any
 * zoom and in any frame. Pure functions only: safe on the server and in the
 * browser.
 *
 * The Rulercraft Dynmap's flat projection puts block (x, z) at pixel
 * (2x, 2z + 128) at tile level 0; each level up halves that. Tiles are 128 px.
 */

/** A block position, [x, z]. */
export type Point = [number, number]

/** A Towny claim outline as the map writes it: parallel x and z lists. */
export type Outline = { x: number[]; z: number[] }

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

/** The world's extent, in blocks, in either direction. */
export const WORLD_LIMIT = 100_000

export const TILE_SIZE = 128

/** A block's position in level-n map pixels. */
export const blockToPixel = (x: number, z: number, level = 0) => ({
  px: (2 * x) / 2 ** level,
  py: (2 * z + TILE_SIZE) / 2 ** level,
})

/** The block under a level-n map pixel. */
export const pixelToBlock = (px: number, py: number, level = 0) => ({
  x: (px * 2 ** level) / 2,
  z: (py * 2 ** level - TILE_SIZE) / 2,
})

export const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= WORLD_LIMIT

export const isPoint = (value: unknown): value is Point =>
  Array.isArray(value) && value.length === 2 && isCoordinate(value[0]) && isCoordinate(value[1])

/** Half a block is as fine as anyone draws; keeps stored JSON short. */
export const roundPoint = ([x, z]: Point): Point => [Math.round(x * 2) / 2, Math.round(z * 2) / 2]

export const outlineToRing = (outline: Outline): Point[] =>
  outline.x.map((x, i) => [x, outline.z[i]] as Point).filter(isPoint)

/** Whether a point lies inside a ring, or on its edge (claims include their border blocks). */
export function inRing([x, z]: Point, ring: Point[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]
    const [xj, zj] = ring[j]
    // On the segment: collinear and within its box.
    const cross = (xj - xi) * (z - zi) - (zj - zi) * (x - xi)
    if (
      Math.abs(cross) < 1e-9 &&
      x >= Math.min(xi, xj) &&
      x <= Math.max(xi, xj) &&
      z >= Math.min(zi, zj) &&
      z <= Math.max(zi, zj)
    ) {
      return true
    }
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export const inOutlines = (point: Point, outlines: Outline[]): boolean =>
  outlines.some((outline) => inRing(point, outlineToRing(outline)))

/**
 * A path's vertices plus points every few blocks along each segment, so a
 * road can't leave a concave claim between two vertices that are inside it.
 */
export function samplePath(points: Point[], step = 4): Point[] {
  if (points.length < 2) return points
  const samples: Point[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1]
    const [x1, z1] = points[i]
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step))
    for (let s = 1; s <= steps; s++) samples.push([x0 + ((x1 - x0) * s) / steps, z0 + ((z1 - z0) * s) / steps])
  }
  return samples
}

/** Area of a ring in square blocks (shoelace). */
export function ringArea(ring: Point[]): number {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return Math.abs(sum / 2)
}

/** Claimed area in chunks (16 × 16 blocks), as Towny counts it. */
export const outlinesChunks = (outlines: Outline[]): number =>
  Math.round(outlines.reduce((total, outline) => total + ringArea(outlineToRing(outline)), 0) / 256)

export function boundsOf(points: Point[]): Bounds | null {
  if (points.length === 0) return null
  const xs = points.map(([x]) => x)
  const zs = points.map(([, z]) => z)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}
