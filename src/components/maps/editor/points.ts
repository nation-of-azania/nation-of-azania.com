import type { Point } from '@/maps/geo'

/**
 * Editing a line of points, whatever it belongs to — a road, a place's
 * outline, a map view's line or shaded area — so every tool speaks the
 * same grammar: a point is dragged, a new one is pressed out of the line
 * itself (or its "+" halfway along), a picked one is removed. Pure, in
 * blocks; the road's own wrappers (./road.ts) add its curve and corners.
 */

/** The point on the segment from a to b nearest to p, and how far along it lies (0 to 1). */
export function nearestOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number } {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const length2 = dx * dx + dz * dz
  const t =
    length2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2))
  return { point: [a[0] + dx * t, a[1] + dz * t], t }
}

export type NearestOnPath = {
  /** The spot on the path. */
  point: Point
  /** The segment it lies on, by the index of the segment's first point. */
  segment: number
  /** How far the asked-for point is from it, in blocks. */
  distance: number
}

/** The spot on a polyline (a ring, when closed) nearest to a point. */
export function nearestOnPath(path: Point[], at: Point, closed = false): NearestOnPath | null {
  if (path.length < 2) return null
  let best: NearestOnPath | null = null
  const segments = closed ? path.length : path.length - 1
  for (let i = 0; i < segments; i++) {
    const { point } = nearestOnSegment(at, path[i], path[(i + 1) % path.length])
    const distance = Math.hypot(point[0] - at[0], point[1] - at[1])
    if (!best || distance < best.distance) best = { point, segment: i, distance }
  }
  return best
}

/** Halfway along each segment (the closing one too, for a ring): where a "+" offers a new point. */
export function midpoints(points: Point[], closed = false): Point[] {
  const segments = closed && points.length >= 3 ? points.length : Math.max(0, points.length - 1)
  return Array.from({ length: segments }, (_, i) => {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Point
  })
}

export const insertPoint = (points: Point[], index: number, point: Point): Point[] => [
  ...points.slice(0, index),
  point,
  ...points.slice(index),
]

export const removePoint = (points: Point[], index: number): Point[] =>
  points.filter((_, i) => i !== index)

export const movePoint = (points: Point[], index: number, point: Point): Point[] =>
  points.map((p, i) => (i === index ? point : p))

/** Whether two lists hold the same points, by value. */
export function samePoints(a: Point[], b: Point[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((p, i) => p === b[i] || (p[0] === b[i][0] && p[1] === b[i][1]))
}
