'use client'

import L from 'leaflet'

import { cachedTileUrl, MAPS, WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH, wrapPoint } from '@/maps/source'

/**
 * The whole world as one picture: the level-5 tiles drawn once into a
 * canvas, at half their size since the sheet is never shown sharper than
 * that, and the canvas laid on the map as an image overlay, placed and
 * scaled by Leaflet like any other. It serves twice.
 *
 * Past SHEET_ZOOM it *is* the map. The tiles there would number in the
 * hundreds and a pan would stutter, so the tile layer stops and the sheet
 * stands in: three elements, when the world wraps (the real sheet and an
 * echo either side), where the tile layer would have seven hundred.
 *
 * And at every zoom it lies under the tiles, as the big map apps keep a
 * coarse picture under the fine one: whatever the tiles haven't covered —
 * the ground a zoom out opens up around the view just left, a fling into
 * new ground, a tile still on its way — shows the world there, soft at
 * first and sharpening as the tiles arrive, never the bare backdrop.
 * Without it a pinch out was a scrap of the old view shrinking into the
 * dark, with the live heads floating alone over it.
 *
 * The tiles are the tile layer's own, from the same cache: 684 of them,
 * some 2 MB in all, small and kept at the CDN. On the live map they're
 * asked for once its first tiles are in and the browser has a moment,
 * twelve at a time, those nearest the reader first; at once when a zoom
 * starts or the map is past SHEET_ZOOM; and, for a reader whose connection
 * asks to save data or in an article's map, only then. An echo's canvas is
 * made only when the view first comes near that echo — for most readers
 * only far out — as a copy of the real one, so a session that stays close
 * in holds one canvas, not three.
 */

/** Below this zoom the sheet stands in for the tiles; the tile layer keeps its tiles down to here. */
export const SHEET_ZOOM = -6

const LEVEL = MAPS.flat.maxLevel
/** A level-5 tile's extent in blocks, and the pixels it takes in the sheet. */
const TILE_BLOCKS = 64 * 2 ** LEVEL
const TILE_PX = 64
/** Tiles fetched at once. */
const AT_ONCE = 12
/** How long the live map waits for its own tiles before fetching the sheet's anyway, in ms. */
const PRELOAD_BY_MS = 6000

/** The level-5 tile grid the sheet covers (src/maps/geo.ts → blockToPixel): the world's columns, and its rows from top to bottom. */
const column = (x: number) => Math.floor(x / TILE_BLOCKS)
const row = (z: number) => Math.floor((2 * z + 128) / (128 * 2 ** LEVEL))
const COLUMNS = { from: column(WORLD_WEST), to: column(WORLD_EAST - 1) }
const ROWS = { from: row(WORLD_NORTH), to: row(WORLD_SOUTH - 1) }
const SPAN = COLUMNS.to - COLUMNS.from + 1

/** The sheet's extent in blocks: its tiles' own edges. */
const SHEET = {
  minX: COLUMNS.from * TILE_BLOCKS,
  maxX: (COLUMNS.to + 1) * TILE_BLOCKS,
  minZ: ROWS.from * TILE_BLOCKS - 64,
  maxZ: (ROWS.to + 1) * TILE_BLOCKS - 64,
}

type OverlayInternals = { _image: HTMLElement; _zoomAnimated?: boolean }

/** An image overlay whose picture is a canvas of ours, not an <img> fetched from a URL. */
class CanvasOverlay extends L.ImageOverlay {
  constructor(
    private readonly canvas: HTMLCanvasElement,
    bounds: L.LatLngBoundsExpression,
    options: L.ImageOverlayOptions,
  ) {
    super('', bounds, options)
  }

  _initImage(): void {
    const self = this as unknown as OverlayInternals
    const element = this.canvas
    L.DomUtil.addClass(element, 'leaflet-image-layer')
    if (self._zoomAnimated) L.DomUtil.addClass(element, 'leaflet-zoom-animated')
    if (this.options.className) L.DomUtil.addClass(element, this.options.className)
    element.onselectstart = L.Util.falseFn
    element.onmousemove = L.Util.falseFn
    // Leaflet's stylesheet lifts every canvas in the map's panes to z-index 100, for its canvas
    // renderer, and its own overlay skips a z-index of 0; the sheet's is set here, or it would lie over the tiles.
    element.style.zIndex = String(this.options.zIndex ?? 0)
    self._image = element
  }
}

/** One copy of the world's sheet: where it lies, and its canvas once it has one. */
type Sheet = { bounds: L.LatLngBounds; canvas: HTMLCanvasElement | null; overlay: CanvasOverlay | null }

type SheetOptions = {
  /** Whether the world repeats east and west, with an echo of the sheet either side. */
  wrap: boolean
  /** The tile layer; the sheet's tiles wait for its first ones. */
  tiles: L.GridLayer
  /** Whether to fetch the sheet once the map has settled, before anyone zooms: the live map's, not an article's. */
  preload: boolean
}

/** Runs `run` when the browser has a moment (Safari has no requestIdleCallback). */
function whenIdle(run: () => void): void {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2000 })
  else window.setTimeout(run, 300)
}

/**
 * Lays the sheet under the tiles, and its echoes as the view comes near
 * them, fetching the tiles once and drawing each into every canvas as it
 * arrives. Returns what takes them off again.
 */
export function attachSheets(map: L.Map, { wrap, tiles, preload }: SheetOptions): () => void {
  const width = SPAN * TILE_PX
  const height = (ROWS.to - ROWS.from + 1) * TILE_PX
  const sheets: Sheet[] = (wrap ? [0, -1, 1] : [0]).map((copy) => ({
    bounds: L.latLngBounds([SHEET.minZ, SHEET.minX + copy * WORLD_WIDTH], [SHEET.maxZ, SHEET.maxX + copy * WORLD_WIDTH]),
    canvas: null,
    overlay: null,
  }))
  const [real] = sheets

  const lay = (sheet: Sheet) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    // An echo starts as a copy of whatever the real sheet holds so far.
    if (sheet !== real && real.canvas) canvas.getContext('2d')?.drawImage(real.canvas, 0, 0)
    sheet.canvas = canvas
    // Under the tiles (zIndex 1), at every zoom.
    sheet.overlay = new CanvasOverlay(canvas, sheet.bounds, {
      pane: 'tilePane',
      zIndex: 0,
      className: 'az-sheet',
      interactive: false,
    }).addTo(map)
  }
  lay(real)

  /** An echo's sheet, the first time the view comes within a page of it. */
  const echoes = sheets.slice(1)
  const near = () => {
    const reach = map.getBounds().pad(1)
    for (const sheet of echoes) if (!sheet.canvas && reach.intersects(sheet.bounds)) lay(sheet)
    if (echoes.every((sheet) => sheet.canvas)) map.off('move zoom viewreset', near)
  }
  if (echoes.length) {
    map.on('move zoom viewreset', near)
    near()
  }

  // The tiles still to fetch, as [column, row].
  const pending: [number, number][] = []
  for (let r = ROWS.from; r <= ROWS.to; r++) for (let c = COLUMNS.from; c <= COLUMNS.to; c++) pending.push([c, r])

  /** Which pending tile lies nearest the middle of the view, in tiles; across the seam too, when the world wraps. */
  const nearest = (): number => {
    const [x, z] = wrapPoint([map.getCenter().lng, map.getCenter().lat])
    const cx = x / TILE_BLOCKS - 0.5
    const cy = (2 * z + 128) / (128 * 2 ** LEVEL) - 0.5
    let best = -1
    let bestDistance = Infinity
    for (let i = 0; i < pending.length; i++) {
      const [c, r] = pending[i]
      const across = Math.abs(c - cx)
      const dx = wrap ? Math.min(across, SPAN - across) : across
      const distance = dx * dx + (r - cy) * (r - cy)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    }
    return best
  }

  let cancelled = false
  let started = false
  const take = () => {
    if (cancelled || !pending.length) return
    const [c, r] = pending.splice(nearest(), 1)[0]
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      if (cancelled) return
      const x = (c - COLUMNS.from) * TILE_PX
      const y = (r - ROWS.from) * TILE_PX
      for (const sheet of sheets) sheet.canvas?.getContext('2d')?.drawImage(image, x, y, TILE_PX, TILE_PX)
      take()
    }
    image.onerror = take
    image.src = cachedTileUrl('flat', LEVEL, c, r)
  }
  const start = () => {
    if (started || cancelled) return
    started = true
    for (let i = 0; i < AT_ONCE; i++) take()
  }

  // Wanted now: a zoom under way, or the map past the tiles.
  const far = () => {
    if (map.getZoom() < SHEET_ZOOM) start()
  }
  map.on('zoomstart', start)
  map.on('zoom', far)
  far()

  // Wanted soon, on the live map: once its own tiles are in, or a while
  // after if they're slow, and the browser has a moment.
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  let fallback = 0
  const soon = () => {
    window.clearTimeout(fallback)
    tiles.off('load', soon)
    whenIdle(start)
  }
  if (preload && !saveData) {
    tiles.once('load', soon)
    fallback = window.setTimeout(soon, PRELOAD_BY_MS)
  }

  return () => {
    cancelled = true
    window.clearTimeout(fallback)
    tiles.off('load', soon)
    map.off('zoomstart', start)
    map.off('zoom', far)
    map.off('move zoom viewreset', near)
    for (const sheet of sheets) sheet.overlay?.remove()
  }
}
