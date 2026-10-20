import type { Bounds, Point } from './geo'
import { pixelsPerBlock, zoomForPixelsPerBlock } from './palette'
import { VIEW_ASPECTS, type ViewAspect } from './registry'

/**
 * Frames: a piece of the map a set number of blocks across, in one of the
 * Map block's aspects. The same arithmetic places a view's frame on the
 * live map, draws the block's picture, and turns a span into a zoom.
 */

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

/** A span the collection accepts. */
export const clampSpan = (span: number): number => Math.round(Math.min(40000, Math.max(32, span)))
