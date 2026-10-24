'use client'

import L from 'leaflet'

import { TILE_SIZE } from '@/maps/geo'
import { cachedTileUrl, MAPS, WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH } from '@/maps/source'

import { savesData } from './connection'
import { toLatLngBounds } from './crs'
import { SHEET_ZOOM } from './sheet'

export const MAX_ZOOM = 3
/** The flat map's coarsest level; Dynmap draws nothing coarser, and no tile is ever asked for past it. */
export const MIN_NATIVE_ZOOM = -MAPS.flat.maxLevel

/** How long a pinch or the wheel must stay at another level's zoom before that level's tiles are asked for, in ms. */
const LEVEL_DWELL_MS = 150
/** How far ahead of a pan its tiles are asked for: this much of its travel, at most two tiles. */
const AHEAD_MS = 600
const AHEAD_TILES = 2

/** A 1×1 transparent PNG: what a tile shows while the map can't be reached, so the backdrop shows through. */
const EMPTY_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/** The pixels a world's width takes at `zoom`. */
export const worldWidthPx = (map: L.Map, zoom: number): number =>
  map.project(L.latLng(0, WORLD_WIDTH), zoom).x - map.project(L.latLng(0, 0), zoom).x

/** A tile level: Leaflet's own record of one, kept while its tiles are on the page. */
type Level = { el: HTMLElement; origin: L.Point; zoom: number }

type GridInternals = {
  _map: L.Map & { _getMapPanePos: () => L.Point; _animatingZoom?: boolean }
  _tiles: L.InternalTiles
  _levels: Record<string, Level>
  _tileZoom?: number
  _noPrune?: boolean
  _fadeFrame: number
  _retainParent: (x: number, y: number, z: number, minZoom: number) => boolean
  _retainChildren: (x: number, y: number, z: number, maxZoom: number) => void
  _removeTile: (key: string) => void
  _removeAllTiles: () => void
  _abortLoading: () => void
  _updateLevels: () => Level | undefined
  _resetGrid: () => void
  _update: (center?: L.LatLng) => void
  _setZoomTransforms: (center: L.LatLng, zoom: number) => void
  _clampZoom: (zoom: number) => number
  _pxBoundsToTileRange: (bounds: L.Bounds) => L.Bounds
  _isValidTile: (coords: L.Coords) => boolean
  _getTiledPixelBounds: (center: L.LatLng) => L.Bounds
  _onMoveEnd: (event?: MoveEvent) => void
  _resetView: (event?: MoveEvent) => void
  _animateZoom: (event: L.ZoomAnimEvent) => void
}

/** What Leaflet says of a move or a zoom as it fires it: mid-pinch (a hand's, or the wheel's) or mid-flight. */
type MoveEvent = { type?: string; pinch?: boolean; flyTo?: boolean }

/** Leaflet's own workings, called on as the overrides below hand back to them. */
const leaflet = L.TileLayer.prototype as unknown as GridInternals

/**
 * The Rulercraft map's tiles through the site's cache (src/maps/source.ts);
 * only the native levels are ever asked for, and only over the sheet the
 * map draws: beyond it to the north and south lies nothing, and to the
 * east and west, when the world wraps, an echo's tiles are the sheet's own.
 * Past SHEET_ZOOM the tiles give way to the sheet, which also lies under
 * them at every zoom (./sheet.ts), so ground they haven't covered yet shows
 * the world, soft, rather than the bare backdrop.
 *
 * The tiles come a little ahead of the reader, so ground that a pan or a
 * zoom brings onto the page is mostly there already:
 *
 * - Through a pan, on phones too, every 200 ms, not only once the finger
 *   lifts (Leaflet's default on phones); and a ring of one tile beyond the
 *   page all round, and more on the side a pan is heading. The ring waits
 *   until a level's tiles on the page are all in, so it never competes
 *   with them, and isn't asked for at all on a connection saving data.
 * - Through a pinch or the wheel, the level the zoom is passing through,
 *   once it has stayed there a moment (LEVEL_DWELL_MS): a pinch held
 *   sharpens before the fingers lift, and a quick one through three levels
 *   doesn't ask for the two it only passed.
 * - Before a flight (flyTo, as when a town is chosen), its destination's,
 *   so they're in when it lands; none on the way, which goes by too fast.
 */
export class AzaniaTileLayer extends L.TileLayer {
  /** A pinch (a hand's, or the wheel's) or a flight under way, as the map's zoom events say. */
  private gesture: 'pinch' | 'flight' | null = null
  /** The level a pinch has moved to, waiting out LEVEL_DWELL_MS before its tiles are asked for. */
  private dwell: { level: number | undefined; timer: number } | null = null
  /** The level whose tiles on the page have all arrived, so its ring may follow; undefined until then. */
  private ringed: number | undefined = undefined
  /** Where a pan was at its last update, in the level's pixels, and when; and how fast it's going, in pixels per ms. */
  private trail: { at: number; centre: L.Point; zoom: number } | null = null
  private heading = L.point(0, 0)
  /** Pictures fetched ahead of a flight, held until they've arrived. */
  private readonly prefetched = new Map<string, HTMLImageElement>()
  private readonly frugal = typeof navigator !== 'undefined' && savesData()

  constructor(wrap: boolean) {
    super('', {
      tileSize: TILE_SIZE,
      minZoom: SHEET_ZOOM,
      maxZoom: MAX_ZOOM,
      minNativeZoom: MIN_NATIVE_ZOOM,
      maxNativeZoom: 0,
      bounds: toLatLngBounds({ minX: WORLD_WEST, maxX: WORLD_EAST, minZ: WORLD_NORTH, maxZ: WORLD_SOUTH }),
      noWrap: !wrap,
      keepBuffer: 3,
      updateWhenIdle: false,
      updateWhenZooming: false,
      errorTileUrl: EMPTY_TILE,
      className: 'az-tile',
    })
    // A level's tiles on the page are in: now its ring.
    this.on('load', () => {
      const self = this as unknown as GridInternals
      if (this.frugal || this.ringed === self._tileZoom) return
      this.ringed = self._tileZoom
      if (!this.gesture && self._map) self._update()
    })
  }

  getTileUrl(coords: L.Coords): string {
    return cachedTileUrl('flat', -coords.z, coords.x, coords.y)
  }

  /**
   * The native level the tiles come in at `zoom`, or undefined past the
   * zooms they're drawn at, where the sheet is the map. Judged by the zoom
   * itself, as the pruning judges it: Leaflet judged by the zoom rounded
   * (−6.25 rounds to −6, in range) but pruned by the zoom (−6.25, out of
   * range), so between the two every update laid a whole grid of tiles and
   * threw it away at once — thousands of images through one pan.
   */
  private levelAt(zoom: number): number | undefined {
    const { minZoom = -Infinity, maxZoom = Infinity } = this.options
    if (zoom < minZoom || zoom > maxZoom) return undefined
    return (this as unknown as GridInternals)._clampZoom(Math.round(zoom))
  }

  /** Leaflet's, with the level judged as levelAt judges it. */
  _setView(center: L.LatLng, zoom: number, noPrune?: boolean, noUpdate?: boolean): void {
    const self = this as unknown as GridInternals
    if (!noUpdate) {
      const level = this.levelAt(zoom)
      self._tileZoom = level
      self._abortLoading()
      self._updateLevels()
      self._resetGrid()
      if (level !== undefined) self._update(center)
      if (!noPrune) this._pruneTiles()
      // Leaflet's flag that keeps its fade-in from pruning mid-gesture.
      self._noPrune = Boolean(noPrune)
    }
    self._setZoomTransforms(center, zoom)
  }

  /** Every frame of a zoom: whether it's a pinch or a flight, and for a pinch, whether it has reached another level. */
  _resetView(event?: MoveEvent): void {
    this.gesture = event?.pinch ? 'pinch' : event?.flyTo ? 'flight' : null
    // A zoom, or a re-basing by a world's width (./home.ts): a pan's speed so far means nothing after it.
    this.trail = null
    if (this.gesture === 'pinch') this.followPinch()
    else this.settleDwell()
    leaflet._resetView.call(this, event)
  }

  /** A zoom animated to a known end (a button, a key, a pinch let go): Leaflet asks for that end's tiles at once. */
  _animateZoom(event: L.ZoomAnimEvent): void {
    this.gesture = null
    this.settleDwell()
    leaflet._animateZoom.call(this, event)
  }

  /**
   * Leaflet's update on a move, every 200 ms through it and once at its
   * end. Mid-pinch, only the level in use fills in what the zoom has
   * brought onto the page (another level waits on followPinch); mid-flight,
   * nothing.
   */
  _onMoveEnd(event?: MoveEvent): void {
    const self = this as unknown as GridInternals
    const map = self._map
    if (!map || map._animatingZoom) return
    const moving = event?.type === 'move'
    if (moving && event.flyTo) return
    if (moving && event.pinch) {
      if (this.levelAt(map.getZoom()) === self._tileZoom) self._update()
      return
    }
    this.track(moving)
    self._update()
  }

  /** A pinch at another level's zoom: that level, once the pinch has stayed there LEVEL_DWELL_MS. */
  private followPinch(): void {
    const self = this as unknown as GridInternals
    const level = this.levelAt(self._map.getZoom())
    if (level === self._tileZoom) return this.settleDwell()
    if (this.dwell && this.dwell.level === level) return
    this.settleDwell()
    const timer = window.setTimeout(() => {
      this.dwell = null
      const map = self._map
      if (this.gesture !== 'pinch' || !map) return
      const zoom = map.getZoom()
      // What's on the page stays until the new level covers it.
      if (this.levelAt(zoom) === level) this._setView(map.getCenter(), zoom, true, false)
    }, LEVEL_DWELL_MS)
    this.dwell = { level, timer }
  }

  private settleDwell(): void {
    if (this.dwell) window.clearTimeout(this.dwell.timer)
    this.dwell = null
  }

  /** How fast a pan is going, from where it was at the last update; still, once it ends. */
  private track(moving: boolean): void {
    const self = this as unknown as GridInternals
    const map = self._map
    const zoom = self._tileZoom
    if (!moving || zoom === undefined) {
      this.trail = null
      this.heading = L.point(0, 0)
      return
    }
    const now = performance.now()
    const centre = map.project(map.getCenter(), zoom)
    const last = this.trail
    this.trail = { at: now, centre, zoom }
    if (!last || last.zoom !== zoom || now - last.at > 500) return
    const velocity = centre.subtract(last.centre).divideBy(Math.max(16, now - last.at))
    // Eased, so one jerky frame doesn't swing the look-ahead about.
    this.heading = this.heading.multiplyBy(0.5).add(velocity.multiplyBy(0.5))
  }

  /**
   * The pixels whose tiles are wanted: the page's, as Leaflet reckons them,
   * and once the level's tiles on the page are in, a ring of a tile beyond
   * it all round, and on the side a pan is heading, AHEAD_MS of its travel
   * more. None of that for a zoom animation, whose tiles are wanted now.
   */
  _getTiledPixelBounds(center: L.LatLng): L.Bounds {
    const self = this as unknown as GridInternals
    const bounds = leaflet._getTiledPixelBounds.call(this, center)
    if (this.frugal || self._map._animatingZoom || this.ringed !== self._tileZoom || !bounds.min || !bounds.max)
      return bounds
    const tile = this.getTileSize().x
    const reach = tile * AHEAD_TILES
    const ahead = this.heading.multiplyBy(AHEAD_MS)
    const dx = Math.max(-reach, Math.min(reach, ahead.x))
    const dy = Math.max(-reach, Math.min(reach, ahead.y))
    return L.bounds(
      bounds.min.subtract([tile - Math.min(0, dx), tile - Math.min(0, dy)]),
      bounds.max.add([tile + Math.max(0, dx), tile + Math.max(0, dy)]),
    )
  }

  /**
   * Asks for the tiles of a view the map is about to fly to, so they're in
   * the browser's cache on arrival; the tile layer then finds them there.
   */
  prefetch(center: L.LatLng, zoom: number): void {
    const self = this as unknown as GridInternals
    const map = self._map
    const level = this.levelAt(zoom)
    if (!map || level === undefined) return
    const middle = map.project(center, level)
    const half = map.getSize().divideBy(map.getZoomScale(zoom, level) * 2)
    const range = self._pxBoundsToTileRange(L.bounds(middle.subtract(half), middle.add(half)))
    if (!range.min || !range.max) return
    for (let y = range.min.y; y <= range.max.y; y++) {
      for (let x = range.min.x; x <= range.max.x; x++) {
        const coords = L.point(x, y) as L.Coords
        coords.z = level
        if (!self._isValidTile(coords)) continue
        const url = this.getTileUrl(this._wrapCoords(coords))
        if (this.prefetched.has(url)) continue
        const picture = new Image()
        picture.decoding = 'async'
        picture.onload = picture.onerror = () => this.prefetched.delete(url)
        this.prefetched.set(url, picture)
        picture.src = url
      }
    }
  }

  onRemove(map: L.Map): this {
    this.settleDwell()
    for (const picture of this.prefetched.values()) picture.src = ''
    this.prefetched.clear()
    return super.onRemove(map)
  }

  /**
   * Re-keys every tile `worlds` worlds over, each staying exactly where it
   * is on the page. When the map is re-based by whole worlds (./home.ts),
   * the tile that showed a column of an echo is the tile for that column
   * of the real world — the same picture, since an echo's tiles are the
   * sheet's own — so none has to be asked for, or even found in the cache.
   * Leaflet keys a tile by its unwrapped column, so the keys change and
   * each tile moves a world's width within its level, which the level's
   * own shift (set again on the map's viewreset) undoes on the page.
   */
  shiftWorlds(worlds: number): void {
    const self = this as unknown as GridInternals
    const size = this.getTileSize()
    const next: L.InternalTiles = {}
    for (const key of Object.keys(self._tiles)) {
      const tile = self._tiles[key]
      const { coords } = tile
      const level = self._levels[coords.z]
      // A world is whole tiles wide at every level the tiles come in.
      const columns = Math.round(worldWidthPx(self._map, coords.z) / size.x)
      // The same object Leaflet gave its load callback, so a tile still arriving lands under its new key.
      coords.x -= worlds * columns
      next[this._tileCoordsToKey(coords)] = tile
      if (level) L.DomUtil.setPosition(tile.el, coords.scaleBy(size).subtract(level.origin))
    }
    self._tiles = next
  }

  /**
   * Leaflet's fade-in, a frame at a time while tiles arrive, touching only
   * the tiles still fading. Leaflet set every tile's opacity on every
   * frame, and pruned on every frame once any tile was in, so a level's
   * eighty tiles arriving over a second or two were pruned a hundred times
   * over. Here a frame prunes only when a tile has just faded in, the one
   * moment pruning can change anything.
   */
  _updateOpacity(): void {
    const self = this as unknown as GridInternals
    if (!self._map) return
    const container = this.getContainer()
    if (container) L.DomUtil.setOpacity(container, this.options.opacity ?? 1)
    const now = Date.now()
    let fading = false
    let opaque = false
    for (const key in self._tiles) {
      const tile = self._tiles[key]
      if (!tile.current || !tile.loaded || tile.active) continue
      const fade = Math.min(1, (now - Number(tile.loaded)) / 200)
      L.DomUtil.setOpacity(tile.el, fade)
      if (fade < 1) fading = true
      else {
        tile.active = true
        opaque = true
      }
    }
    if (opaque && !self._noPrune) this._pruneTiles()
    if (fading) {
      L.Util.cancelAnimFrame(self._fadeFrame)
      self._fadeFrame = L.Util.requestAnimFrame(this._updateOpacity, this)
    }
  }

  /**
   * Which tiles stay on the page once the map has settled: Leaflet's own
   * rule, and one more. Leaflet keeps a tile of another level while the
   * current level's tile over it is still on its way only from up to two
   * levels closer, so a zoom out of three levels or more dropped the view
   * just left, crisp, the moment the zoom ended, and the place the reader
   * was looking at went soft (the sheet beneath) until the new tiles came.
   * Here any loaded tile of a closer level stays while the tile over it at
   * the current level hasn't arrived; once that one has, it goes as before.
   */
  _pruneTiles(): void {
    const self = this as unknown as GridInternals
    const map = self._map
    if (!map) return
    const zoom = map.getZoom()
    if (zoom > (this.options.maxZoom ?? Infinity) || zoom < (this.options.minZoom ?? -Infinity)) {
      self._removeAllTiles()
      return
    }
    const tiles = self._tiles
    const level = self._tileZoom
    // With every tile at the level in use, as most of the time, there's no
    // other level's tile to keep, and the walks up and down the levels for
    // each one still loading (the profile's busiest code) can be skipped.
    let mixed = false
    for (const key in tiles) {
      tiles[key].retain = tiles[key].current
      if (tiles[key].coords.z !== level) mixed = true
    }
    if (mixed) for (const key in tiles) {
      const tile = tiles[key]
      const { x, y, z } = tile.coords
      if (tile.current && !tile.active) {
        // Leaflet's: a loaded parent up to five levels out, else loaded children up to two in.
        if (!self._retainParent(x, y, z, z - 5)) self._retainChildren(x, y, z, z + 2)
      } else if (!tile.current && tile.loaded && level !== undefined && z > level) {
        // Ours: a closer level's tile, under a current one still loading.
        const scale = 2 ** (z - level)
        const over = L.point(Math.floor(x / scale), Math.floor(y / scale)) as L.Coords
        over.z = level
        const cover = tiles[this._tileCoordsToKey(over)]
        if (cover?.current && !cover.active) tile.retain = true
      }
    }
    for (const key in tiles) if (!tiles[key].retain) self._removeTile(key)
  }

  /**
   * Where a level stands for a view, as Leaflet places it, except that the
   * map's origin isn't rounded for the view the map is actually at. Leaflet
   * rounds it, as the map itself does whenever it settles; but a map
   * re-based by a world's width keeps its origin exact, with a fraction of
   * a pixel at the zooms between levels, and rounding that here would step
   * the tiles a fraction out from under the overlay — and out from where
   * they stood before the re-basing. The target of a zoom animation is
   * still rounded, as the map will round it when the animation lands.
   */
  _setZoomTransform(level: Level, center: L.LatLng, zoom: number): void {
    const map = (this as unknown as GridInternals)._map
    const scale = map.getZoomScale(zoom, level.zoom)
    const origin = map.project(center, zoom).subtract(map.getSize().divideBy(2)).add(map._getMapPanePos())
    const settled = zoom === map.getZoom() && !map._animatingZoom
    const translate = level.origin.multiplyBy(scale).subtract(settled ? origin : origin.round())
    if (L.Browser.any3d) L.DomUtil.setTransform(level.el, settled ? translate : translate.round(), scale)
    else L.DomUtil.setPosition(level.el, translate.round())
  }
}
