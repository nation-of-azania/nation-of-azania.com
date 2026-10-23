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
 * the ground a zoom out opens up around the view just left, a tile still
 * on its way — shows the world there, soft at first and sharpening as the
 * tiles arrive, never the bare backdrop. Without it a pinch out was a
 * scrap of the old view shrinking into the dark, with the live heads
 * floating alone over it. At rest, with the tiles all in and covering it,
 * it's set aside, so a pan has nothing more to draw than before.
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
/** How often the tiles that have arrived are drawn into the sheet, in ms; and while a zoom is under way. */
const DRAW_EVERY_MS = 150
const DRAW_WHILE_ZOOMING_MS = 400
/** How long the live map waits for its own tiles before fetching the sheet's anyway, in ms. */
const PRELOAD_BY_MS = 6000
/** How long after the tiles have all arrived the sheet is set aside: Leaflet's fade-in, and a little more. */
const REST_AFTER_MS = 300

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

type OverlayInternals = {
  _image: HTMLElement
  _zoomAnimated?: boolean
  _bounds: L.LatLngBounds
  _map: L.Map & { _latLngBoundsToNewLayerBounds: (bounds: L.LatLngBounds, zoom: number, center: L.LatLng) => L.Bounds }
}

/**
 * An image overlay whose picture is a canvas of ours, not an <img> fetched
 * from a URL; placed and scaled by a transform alone, as the tile levels
 * are. The canvas keeps its own size, so the frames of a gesture move it on
 * the compositor without laying it out again, where Leaflet's own overlay
 * sets its width and height every frame.
 */
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
    element.style.width = `${element.width}px`
    element.style.height = `${element.height}px`
    element.style.transformOrigin = '0 0'
    self._image = element
  }

  /** Stands the canvas over its bounds as they lie in `box`, in layer pixels. */
  private place(box: L.Bounds): void {
    if (!box.min || !box.max) return
    L.DomUtil.setTransform(this.canvas, box.min, (box.max.x - box.min.x) / this.canvas.width)
  }

  _reset(): void {
    const { _map: map, _bounds: bounds } = this as unknown as OverlayInternals
    this.place(L.bounds(map.latLngToLayerPoint(bounds.getNorthWest()), map.latLngToLayerPoint(bounds.getSouthEast())))
  }

  _animateZoom(event: L.ZoomAnimEvent): void {
    const { _map: map, _bounds: bounds } = this as unknown as OverlayInternals
    this.place(map._latLngBoundsToNewLayerBounds(bounds, event.zoom, event.center))
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

  // Whether the sheet is on show. At rest the tiles cover it wherever they
  // are, being opaque, so it's set aside, leaving the compositor nothing to
  // draw beneath them through a pan, or a zoom in, where the level left
  // behind, scaled up, still covers the page. It's back the moment a zoom
  // goes out past where it began, until the tiles of the zoom it ends at
  // have all arrived and faded in. Past SHEET_ZOOM it is the map, and
  // always shown.
  let shown = true
  const show = (on: boolean) => {
    if (on === shown) return
    shown = on
    for (const sheet of sheets) if (sheet.canvas) sheet.canvas.style.visibility = on ? '' : 'hidden'
  }

  const lay = (sheet: Sheet) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    if (!shown) canvas.style.visibility = 'hidden'
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

  // An echo's sheet: made once the map has settled within a page of it and
  // the browser has a moment (never in the frame the map settles in, which
  // has the overlay to draw), or at once should it come onto the page
  // mid-gesture.
  const echoes = sheets.slice(1)
  let detached = false
  const layNear = (pages: number) => {
    if (detached) return
    const reach = map.getBounds().pad(pages)
    for (const sheet of echoes) if (!sheet.canvas && reach.intersects(sheet.bounds)) lay(sheet)
    if (echoes.every((sheet) => sheet.canvas)) {
      map.off('moveend viewreset', settled)
      map.off('move zoom', moving)
    }
  }
  const settled = () => whenIdle(() => layNear(1))
  const moving = () => layNear(0)
  if (echoes.length) {
    map.on('moveend viewreset', settled)
    map.on('move zoom', moving)
    settled()
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

  // The tiles that have arrived, drawn in a batch every so often rather than
  // one by one, so the canvas changes a few times a second, not seventy;
  // less often still while a zoom is under way.
  let zooming = false
  // The zoom a zoom set out from: zooming in, the level left behind, scaled up, still covers the page.
  let from = 0
  let resting = 0
  /** Sets the sheet aside if the tiles cover the view: no zoom under way, none past SHEET_ZOOM, none still loading. */
  const rest = () => {
    resting = 0
    if (!zooming && map.getZoom() >= SHEET_ZOOM && !tiles.isLoading()) show(false)
  }
  /** Soon after the tiles last arrived: once Leaflet's fade-in (200 ms) is over. */
  const restSoon = () => {
    window.clearTimeout(resting)
    resting = window.setTimeout(rest, REST_AFTER_MS)
  }
  const zoomStarted = () => {
    zooming = true
    from = map.getZoom()
    window.clearTimeout(resting)
  }
  const zoomEnded = () => {
    zooming = false
    restSoon()
  }
  /** On show once a zoom goes out past where it began, or the map is past the tiles. */
  const zoomed = () => {
    const zoom = map.getZoom()
    if (zoom < SHEET_ZOOM || (zooming && zoom < from)) show(true)
  }
  /** A button's animated zoom out: on show from the start, as the animation shrinks the tiles. */
  const zoomAnimating = (event: L.ZoomAnimEvent) => {
    if (event.zoom < map.getZoom()) show(true)
  }
  map.on('zoomstart', zoomStarted)
  map.on('zoomend', zoomEnded)
  map.on('zoom viewreset', zoomed)
  map.on('zoomanim', zoomAnimating)
  tiles.on('load', restSoon)
  restSoon()
  type Arrived = { picture: ImageBitmap | HTMLImageElement; c: number; r: number }
  const arrived: Arrived[] = []
  let batch = 0
  const drawArrived = () => {
    batch = 0
    for (const sheet of sheets) {
      const context = sheet.canvas?.getContext('2d')
      if (!context) continue
      for (const { picture, c, r } of arrived)
        context.drawImage(picture, (c - COLUMNS.from) * TILE_PX, (r - ROWS.from) * TILE_PX, TILE_PX, TILE_PX)
    }
    for (const { picture } of arrived) if ('close' in picture) picture.close()
    arrived.length = 0
  }

  const abort = new AbortController()
  /** A tile's picture, decoded off the main thread where the browser can, so drawing it costs nothing more. */
  const fetchTile = async (url: string): Promise<ImageBitmap | HTMLImageElement | null> => {
    if (typeof createImageBitmap === 'function') {
      const response = await fetch(url, { signal: abort.signal })
      return response.ok ? createImageBitmap(await response.blob()) : null
    }
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  }

  let started = false
  const take = () => {
    if (abort.signal.aborted || !pending.length) return
    const [c, r] = pending.splice(nearest(), 1)[0]
    fetchTile(cachedTileUrl('flat', LEVEL, c, r))
      .then((picture) => {
        if (!picture || abort.signal.aborted) return
        arrived.push({ picture, c, r })
        if (!batch) batch = window.setTimeout(drawArrived, zooming ? DRAW_WHILE_ZOOMING_MS : DRAW_EVERY_MS)
      })
      // A tile the cache can't give is left out; the backdrop shows there.
      .catch(() => {})
      .finally(take)
  }
  const start = () => {
    if (started || abort.signal.aborted) return
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
    detached = true
    abort.abort()
    window.clearTimeout(batch)
    window.clearTimeout(resting)
    tiles.off('load', restSoon)
    map.off('zoom viewreset', zoomed)
    map.off('zoomanim', zoomAnimating)
    for (const { picture } of arrived) if ('close' in picture) picture.close()
    window.clearTimeout(fallback)
    tiles.off('load', soon)
    map.off('zoomstart', start)
    map.off('zoom', far)
    map.off('zoomstart', zoomStarted)
    map.off('zoomend', zoomEnded)
    map.off('moveend viewreset', settled)
    map.off('move zoom', moving)
    for (const sheet of sheets) sheet.overlay?.remove()
  }
}
