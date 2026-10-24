'use client'

import L from 'leaflet'

import {
  SHEET_BOUNDS,
  SHEET_COLUMNS,
  SHEET_HEIGHT,
  SHEET_LEVEL,
  SHEET_ROWS,
  SHEET_SPAN,
  SHEET_TILE_BLOCKS,
  SHEET_TILE_PX,
  SHEET_URL,
  SHEET_WIDTH,
  sheetRowTop,
} from '@/maps/sheet'
import { cachedTileUrl, WORLD_WIDTH, wrapPoint } from '@/maps/source'

import { savesData } from './connection'

/**
 * The whole world as one picture: the level-5 tiles at half their size,
 * since the sheet is never shown sharper than that, laid on the map as an
 * image overlay, placed and scaled by Leaflet like any other. It serves
 * twice.
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
 * floating alone over it. It stays there at rest too: at the zooms
 * between Dynmap's levels the tiles are scaled by a fraction, and hairline
 * gaps open along their edges where the device's pixels don't line up,
 * which then show the world's own colours rather than lines of the dark
 * backdrop. (It was set aside at rest once, to spare the compositor a
 * layer through a pan; one more layer costs a GPU next to nothing.)
 *
 * The sheet comes from the server as one picture of some 150–200 KB, made
 * from the coarsest tiles and kept at the CDN (src/maps/sheet.ts). While
 * it's slow in coming (a deploy empties the CDN, and the server makes it
 * afresh), or should it fail, it's made here from the tiles themselves:
 * the tile layer's own from the same cache, 684 of them and 2.5 MB,
 * twelve at a time, those nearest the reader first. On the live map it's
 * asked for once its first tiles are in and the browser has a moment; at
 * once when a zoom starts or the map is past SHEET_ZOOM; and, for a reader
 * whose connection asks to save data or in an article's map, only then.
 * An echo's canvas is made only when the view first comes near that echo
 * — for most readers only far out — as a copy of the real one, so a
 * session that stays close in holds one canvas, not three.
 */

/** Below this zoom the sheet stands in for the tiles; the tile layer keeps its tiles down to here. */
export const SHEET_ZOOM = -6

/** Tiles fetched at once, should the sheet have to be made here from the tiles. */
const AT_ONCE = 12
/** How long the server's sheet may take before the tiles are fetched meanwhile, in ms: a deploy leaves the CDN without it until it's made again. */
const WHOLE_WAIT_MS = 2500
/** How often the tiles that have arrived are drawn into the sheet, in ms; and while a zoom is under way. */
const DRAW_EVERY_MS = 150
const DRAW_WHILE_ZOOMING_MS = 400
/** How long the live map waits for its own tiles before fetching the sheet anyway, in ms. */
const PRELOAD_BY_MS = 6000

type OverlayInternals = {
  _image: HTMLElement
  _zoomAnimated?: boolean
  _bounds: L.LatLngBounds
  _map: L.Map & { _latLngBoundsToNewLayerBounds: (bounds: L.LatLngBounds, zoom: number, center: L.LatLng) => L.Bounds }
}

/**
 * An image overlay whose picture is an element of ours: the server's sheet
 * as an <img>, or a canvas the tiles are drawn into while that's slow in
 * coming. Placed and scaled by a transform alone, as the tile levels are;
 * the picture keeps its own size, so the frames of a gesture move it on the
 * compositor without laying it out again, where Leaflet's own overlay sets
 * its width and height every frame.
 */
class PictureOverlay extends L.ImageOverlay {
  constructor(
    private readonly picture: HTMLCanvasElement | HTMLImageElement,
    bounds: L.LatLngBoundsExpression,
    options: L.ImageOverlayOptions,
  ) {
    super('', bounds, options)
  }

  _initImage(): void {
    const self = this as unknown as OverlayInternals
    const element = this.picture
    L.DomUtil.addClass(element, 'leaflet-image-layer')
    if (self._zoomAnimated) L.DomUtil.addClass(element, 'leaflet-zoom-animated')
    if (this.options.className) L.DomUtil.addClass(element, this.options.className)
    element.onselectstart = L.Util.falseFn
    element.onmousemove = L.Util.falseFn
    // Leaflet's stylesheet lifts every canvas in the map's panes to z-index 100, for its canvas
    // renderer, and its own overlay skips a z-index of 0; the sheet's is set here, or it would lie over the tiles.
    element.style.zIndex = String(this.options.zIndex ?? 0)
    element.style.width = `${SHEET_WIDTH}px`
    element.style.height = `${SHEET_HEIGHT}px`
    element.style.transformOrigin = '0 0'
    self._image = element
  }

  /** Stands the picture over its bounds as they lie in `box`, in layer pixels. */
  private place(box: L.Bounds): void {
    if (!box.min || !box.max) return
    L.DomUtil.setTransform(this.picture, box.min, (box.max.x - box.min.x) / SHEET_WIDTH)
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

/**
 * One copy of the world's sheet: where it lies, whether it's wanted on the
 * map (the real one always; an echo once the view comes near it), and its
 * picture once it has one.
 */
type Sheet = {
  bounds: L.LatLngBounds
  wanted: boolean
  picture: HTMLCanvasElement | HTMLImageElement | null
  overlay: PictureOverlay | null
}

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
  const sheets: Sheet[] = (wrap ? [0, -1, 1] : [0]).map((copy) => ({
    bounds: L.latLngBounds(
      [SHEET_BOUNDS.minZ, SHEET_BOUNDS.minX + copy * WORLD_WIDTH],
      [SHEET_BOUNDS.maxZ, SHEET_BOUNDS.maxX + copy * WORLD_WIDTH],
    ),
    wanted: copy === 0,
    picture: null,
    overlay: null,
  }))
  const [real] = sheets

  // What the sheets are drawn from: nothing yet; the server's picture, an
  // <img> each, which the compositor moves as it is (one picture, decoded
  // once, whatever the number of copies); or, while that's slow or failing,
  // a canvas each, which the tiles are drawn into as they come. A canvas
  // costs more on every frame of a gesture than an image (Chromium makes a
  // fresh resource of it each time it's moved), so it's never laid before
  // there's something to draw in it, and gives way to the image once that
  // has come.
  let source: 'image' | 'canvas' | null = null
  const lay = (sheet: Sheet) => {
    if (!source || !sheet.wanted) return
    if (sheet.overlay && (source === 'image') === sheet.picture instanceof HTMLImageElement) return
    sheet.overlay?.remove()
    let picture: HTMLCanvasElement | HTMLImageElement
    if (source === 'image') {
      picture = new Image(SHEET_WIDTH, SHEET_HEIGHT)
      picture.alt = ''
      picture.src = SHEET_URL
    } else {
      picture = document.createElement('canvas')
      picture.width = SHEET_WIDTH
      picture.height = SHEET_HEIGHT
      // An echo starts as a copy of whatever the real sheet holds so far.
      if (sheet !== real && real.picture instanceof HTMLCanvasElement)
        picture.getContext('2d')?.drawImage(real.picture, 0, 0)
    }
    sheet.picture = picture
    // Under the tiles (zIndex 1), at every zoom.
    sheet.overlay = new PictureOverlay(picture, sheet.bounds, {
      pane: 'tilePane',
      zIndex: 0,
      className: 'az-sheet',
      interactive: false,
    }).addTo(map)
  }
  const drawFrom = (next: 'image' | 'canvas') => {
    if (source === 'image') return
    source = next
    for (const sheet of sheets) lay(sheet)
  }

  // An echo's sheet: made once the map has settled within a page of it and
  // the browser has a moment (never in the frame the map settles in, which
  // has the overlay to draw), or at once should it come onto the page
  // mid-gesture.
  const echoes = sheets.slice(1)
  let detached = false
  const layNear = (pages: number) => {
    if (detached) return
    const reach = map.getBounds().pad(pages)
    for (const sheet of echoes)
      if (!sheet.wanted && reach.intersects(sheet.bounds)) {
        sheet.wanted = true
        lay(sheet)
      }
    if (echoes.every((sheet) => sheet.wanted)) {
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
  for (let r = SHEET_ROWS.from; r <= SHEET_ROWS.to; r++)
    for (let c = SHEET_COLUMNS.from; c <= SHEET_COLUMNS.to; c++) pending.push([c, r])

  /** Which pending tile lies nearest the middle of the view, in tiles; across the seam too, when the world wraps. */
  const nearest = (): number => {
    const [x, z] = wrapPoint([map.getCenter().lng, map.getCenter().lat])
    const cx = x / SHEET_TILE_BLOCKS - 0.5
    const cy = (2 * z + 128) / (128 * 2 ** SHEET_LEVEL) - 0.5
    let best = -1
    let bestDistance = Infinity
    for (let i = 0; i < pending.length; i++) {
      const [c, r] = pending[i]
      const across = Math.abs(c - cx)
      const dx = wrap ? Math.min(across, SHEET_SPAN - across) : across
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
  const zoomStarted = () => {
    zooming = true
  }
  const zoomEnded = () => {
    zooming = false
  }
  map.on('zoomstart', zoomStarted)
  map.on('zoomend', zoomEnded)
  type Arrived = { picture: ImageBitmap | HTMLImageElement; c: number; r: number }
  const arrived: Arrived[] = []
  let batch = 0
  const drawArrived = () => {
    batch = 0
    for (const sheet of sheets) {
      if (!(sheet.picture instanceof HTMLCanvasElement)) continue
      const context = sheet.picture.getContext('2d')
      if (!context) continue
      for (const { picture, c, r } of arrived)
        context.drawImage(
          picture,
          (c - SHEET_COLUMNS.from) * SHEET_TILE_PX,
          sheetRowTop(r),
          SHEET_TILE_PX,
          SHEET_TILE_PX,
        )
    }
    for (const { picture } of arrived) if ('close' in picture) picture.close()
    arrived.length = 0
  }

  const abort = new AbortController()
  /** A picture, decoded off the main thread where the browser can, so drawing it costs nothing more. */
  const fetchPicture = async (url: string): Promise<ImageBitmap | HTMLImageElement | null> => {
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
    fetchPicture(cachedTileUrl('flat', SHEET_LEVEL, c, r))
      .then((picture) => {
        if (!picture || abort.signal.aborted) return
        arrived.push({ picture, c, r })
        if (!batch) batch = window.setTimeout(drawArrived, zooming ? DRAW_WHILE_ZOOMING_MS : DRAW_EVERY_MS)
      })
      // A tile the cache can't give is left out; the backdrop shows there.
      .catch(() => {})
      .finally(take)
  }
  /**
   * The whole sheet, as the server makes it: decoded off the page first,
   * then laid as an <img> on every copy wanted, in place of any canvas the
   * tiles had begun; false if it didn't come.
   */
  let whole: HTMLImageElement | null = null
  const fetchWhole = async (): Promise<boolean> => {
    whole = new Image()
    whole.decoding = 'async'
    whole.src = SHEET_URL
    try {
      await whole.decode()
    } catch {
      return abort.signal.aborted
    }
    if (abort.signal.aborted) return true
    pending.length = 0
    drawFrom('image')
    return true
  }
  let byTiles = false
  let slow = 0
  /** The tiles one by one, nearest first: while the server's sheet is slow, or instead of it. */
  const takeTiles = () => {
    if (byTiles) return
    byTiles = true
    drawFrom('canvas')
    for (let i = 0; i < AT_ONCE; i++) take()
  }
  const start = () => {
    if (started || abort.signal.aborted) return
    started = true
    slow = window.setTimeout(takeTiles, WHOLE_WAIT_MS)
    void fetchWhole().then((whole) => {
      window.clearTimeout(slow)
      if (!whole) takeTiles()
    })
  }

  // Wanted now: a zoom under way, or the map past the tiles.
  const far = () => {
    if (map.getZoom() < SHEET_ZOOM) start()
  }
  map.on('zoomstart', start)
  map.on('zoom', far)
  far()

  // Wanted soon, on the live map: once its own tiles are in, or a while
  // after if they're slow, and the browser has a moment. Not ahead of time
  // for a reader saving data or on a slow connection: the bytes are theirs
  // to spend, so the sheet comes when they first zoom.
  const saveData = savesData()
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
    if (whole && !whole.complete) whole.src = ''
    window.clearTimeout(slow)
    window.clearTimeout(batch)
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
