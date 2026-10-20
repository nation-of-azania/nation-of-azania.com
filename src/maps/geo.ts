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

/** How a road runs between its points. */
export type RoadShape = 'straight' | 'curved'

const blend = (a: Point, b: Point, wa: number, wb: number): Point => [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb]

/**
 * A point on the centripetal Catmull–Rom curve from p1 to p2 (u from 0 to 1),
 * steered by the neighbours p0 and p3. Centripetal parametrisation never
 * loops or overshoots between close points, so a builder's curve stays where
 * they put it.
 */
function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const knot = (a: Point, b: Point) => Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5, 1e-6)
  const t0 = 0
  const t1 = t0 + knot(p0, p1)
  const t2 = t1 + knot(p1, p2)
  const t3 = t2 + knot(p2, p3)
  const t = t1 + u * (t2 - t1)
  const a1 = blend(p0, p1, (t1 - t) / (t1 - t0), (t - t0) / (t1 - t0))
  const a2 = blend(p1, p2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1))
  const a3 = blend(p2, p3, (t3 - t) / (t3 - t2), (t - t2) / (t3 - t2))
  const b1 = blend(a1, a2, (t2 - t) / (t2 - t0), (t - t0) / (t2 - t0))
  const b2 = blend(a2, a3, (t3 - t) / (t3 - t1), (t - t1) / (t3 - t1))
  return blend(b1, b2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1))
}

/** The point mirrored through `pivot`: a run's missing neighbour at its ends, so the curve leaves straight. */
const mirror = (point: Point, pivot: Point): Point => [2 * pivot[0] - point[0], 2 * pivot[1] - point[1]]

/**
 * The course a road takes through its points: straight from point to point,
 * or, curved, smoothly through every point, each bend flowing into the next.
 * In a curved road, `corners` (indices of points) stay sharp turns, as at a
 * junction. Returns a polyline about every `step` blocks along the curves,
 * for drawing, for measuring and for checking against claims; a straight
 * road returns its own points.
 */
export function roadCourse(points: Point[], shape: RoadShape = 'straight', corners: number[] = [], step = 2): Point[] {
  if (shape !== 'curved' || points.length < 3) return points
  const sharp = new Set(corners)
  const course: Point[] = [points[0]]
  let start = 0
  for (let end = 1; end < points.length; end++) {
    if (end < points.length - 1 && !sharp.has(end)) continue
    // One smooth run, from a sharp point (or the start) to the next.
    const run = points.slice(start, end + 1)
    for (let i = 0; i < run.length - 1; i++) {
      const p1 = run[i]
      const p2 = run[i + 1]
      if (run.length === 2) {
        course.push(p2)
        continue
      }
      const p0 = run[i - 1] ?? mirror(p2, p1)
      const p3 = run[i + 2] ?? mirror(p1, p2)
      const steps = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
      for (let s = 1; s < steps; s++) course.push(catmullRom(p0, p1, p2, p3, s / steps))
      course.push(p2)
    }
    start = end
  }
  return course
}

/** Length of a polyline in blocks. */
export const pathLength = (points: Point[]): number =>
  points.reduce((total, point, i) => (i ? total + Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]) : 0), 0)
