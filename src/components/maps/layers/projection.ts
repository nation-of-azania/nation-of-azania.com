import type { Bounds, Point } from '@/maps/geo'

/**
 * How the layers (./*.tsx) put blocks on paper. They are plain SVG, drawn
 * through this one interface, so the same components draw the live map in
 * the browser (where Leaflet projects) and the Map block's still picture on
 * the server (where a frame does). Nothing in a layer may touch the DOM or
 * a hook.
 */
export type Projection = {
  /** A block's position in the SVG's user units. */
  project: (point: Point) => [number, number]
  /** Pixels per block at this zoom. */
  ppb: number
  /** Map zoom: 0 is the tiles' native scale, 2 px per block. */
  zoom: number
  /** The visible extent in blocks, with a margin, for leaving out what's off the page. */
  bounds: Bounds
  /** Prefixes element ids (text paths, masks), so two maps on one page don't collide. */
  id: string
}

export type Rect = { x: number; y: number; width: number; height: number }

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

/**
 * Keeps labels off each other: a label claims its box, and a later label
 * that would overlap one is left out. Callers place what matters most
 * first (towns before places, bigger towns before smaller ones).
 */
export class LabelPlacer {
  private taken: Rect[] = []

  fits(rect: Rect): boolean {
    return !this.taken.some((other) => overlaps(other, rect))
  }

  claim(rect: Rect): void {
    this.taken.push(rect)
  }

  /** Claims the box if it's free; false when something already sits there. */
  tryClaim(rect: Rect): boolean {
    if (!this.fits(rect)) return false
    this.claim(rect)
    return true
  }
}

/** A text's box, estimated from its length: good enough to keep labels apart. */
export function textWidth(text: string, fontSize: number, tracking = 0): number {
  return text.length * fontSize * 0.56 + text.length * tracking
}

export const inBounds = (bounds: Bounds, [x, z]: Point): boolean =>
  x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ

export const boundsTouch = (a: Bounds, b: Bounds): boolean =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ

/** An SVG path through points, projected. */
export function pathOf(projection: Projection, points: Point[], close = false): string {
  if (points.length === 0) return ''
  const parts = points.map((point, index) => {
    const [x, y] = projection.project(point)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return parts.join('') + (close ? 'Z' : '')
}

/** The halo every piece of text on the map wears, so it reads over any ground. */
export const halo = (colour: string, width = 3) => ({
  paintOrder: 'stroke' as const,
  stroke: colour,
  strokeWidth: width,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
})
