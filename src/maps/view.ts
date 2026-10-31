import type { Bounds, Point } from './geo'
import { pixelsPerBlock, zoomForPixelsPerBlock } from './palette'
import { VIEW_ASPECTS, type ViewAspect } from './registry'
import { WORLD_WIDTH } from './source'

/**
 * Frames: a piece of the map a set number of blocks across, in one of the
 * Map block's aspects. The same arithmetic places a view's frame on the
 * live map, draws the block's picture, and turns a span into a zoom.
 */

/** The flat map's farthest zoom (src/maps/source.ts), said here too with the rest of the map's framing. */
export { FLAT_MIN_ZOOM } from './source'

/**
 * How the wheel zooms, on the flat map and the globe alike: pixels of
 * scrolling per level, pixels of a trackpad's pinch per level, a
 * click-wheel's notch in levels, and the easing's time constant in ms.
 */
export const WHEEL = { scrollPxPerLevel: 180, pinchPxPerLevel: 70, notchLevels: 0.5, ease: 90 } as const

/**
 * Pulling the flat map past its farthest zoom curls it up into the globe
 * (src/components/maps/leaflet/canvas.tsx reports the pull). A pull counts
 * only when its gesture starts at the floor after `quietMs` of stillness,
 * so a fling that merely reaches the floor never curls; it commits on
 * release at `commit` levels past the floor (`commitTouch` for a pinch),
 * or at once at `auto`; while it lasts, the sheet curls with resistance,
 * t = scrubMax·(1 − e^(−levels/scrubScale)); one that falls short springs
 * back over `springMs`.
 */
export const PULL = { quietMs: 250, commit: 0.6, auto: 1.25, commitTouch: 0.5, scrubMax: 0.6, scrubScale: 0.45, springMs: 220 } as const

/** The frame's extent in blocks around its centre. */
export function frameBounds(centre: Point, span: number, aspect: ViewAspect): Bounds {
  const tall = span / VIEW_ASPECTS[aspect].ratio
  return {
    minX: centre[0] - span / 2,
    maxX: centre[0] + span / 2,
    minZ: centre[1] - tall / 2,
    maxZ: centre[1] + tall / 2,
  }
}

/** The zoom at which `span` blocks fill `widthPx` pixels. */
export const zoomForSpan = (span: number, widthPx: number): number =>
  zoomForPixelsPerBlock(widthPx / span)

/** How many blocks `widthPx` pixels show at a zoom. */
export const spanAtZoom = (zoom: number, widthPx: number): number => widthPx / pixelsPerBlock(zoom)

/** The zoom that fits a bounds in a viewport, with a margin. */
export function zoomToFit(
  bounds: Bounds,
  viewport: { width: number; height: number },
  padding = 0.12,
): number {
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxZ - bounds.minZ)
  const ppb = Math.min(
    (viewport.width * (1 - padding * 2)) / width,
    (viewport.height * (1 - padding * 2)) / height,
  )
  return zoomForPixelsPerBlock(ppb)
}

export const boundsCentre = (bounds: Bounds): Point => [
  (bounds.minX + bounds.maxX) / 2,
  (bounds.minZ + bounds.maxZ) / 2,
]

/**
 * Where the frame sits in a viewport while a view is being drawn: centred,
 * with a margin, as large as the aspect allows.
 */
export function frameInViewport(
  viewport: { width: number; height: number },
  aspect: ViewAspect,
  margin = 0.1,
): { left: number; top: number; width: number; height: number } {
  const ratio = VIEW_ASPECTS[aspect].ratio
  const maxWidth = viewport.width * (1 - margin * 2)
  const maxHeight = viewport.height * (1 - margin * 2)
  let width = maxWidth
  let height = width / ratio
  if (height > maxHeight) {
    height = maxHeight
    width = height * ratio
  }
  return { left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height }
}

/**
 * How many blocks across a map view may be: from a few houses to the whole
 * world (src/maps/source.ts → WORLD_WIDTH), past which a frame would only
 * show the world again in its echoes.
 */
export const VIEW_SPAN = { min: 32, max: WORLD_WIDTH } as const

/** A span the collection accepts: a frame the editor framed wider than the world is kept at the world's width. */
export const clampSpan = (span: number): number => Math.round(Math.min(VIEW_SPAN.max, Math.max(VIEW_SPAN.min, span)))
