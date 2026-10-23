'use client'

import L from 'leaflet'

import { TILE_SIZE } from '@/maps/geo'
import { cachedTileUrl, MAPS, WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH } from '@/maps/source'

import { toLatLngBounds } from './crs'
import { SHEET_ZOOM } from './sheet'

export const MAX_ZOOM = 3
/** The flat map's coarsest level; Dynmap draws nothing coarser, and no tile is ever asked for past it. */
export const MIN_NATIVE_ZOOM = -MAPS.flat.maxLevel

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
  _retainParent: (x: number, y: number, z: number, minZoom: number) => boolean
  _retainChildren: (x: number, y: number, z: number, maxZoom: number) => void
  _removeTile: (key: string) => void
  _removeAllTiles: () => void
}

/**
 * The Rulercraft map's tiles through the site's cache (src/maps/source.ts);
 * only the native levels are ever asked for, and only over the sheet the
 * map draws: beyond it to the north and south lies nothing, and to the
 * east and west, when the world wraps, an echo's tiles are the sheet's own.
 * Past SHEET_ZOOM the tiles give way to the sheet, which also lies under
 * them at every zoom (./sheet.ts), so ground they haven't covered yet shows
 * the world, soft, rather than the bare backdrop.
 */
export class AzaniaTileLayer extends L.TileLayer {
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
      updateWhenZooming: false,
      errorTileUrl: EMPTY_TILE,
      className: 'az-tile',
    })
  }

  getTileUrl(coords: L.Coords): string {
    return cachedTileUrl('flat', -coords.z, coords.x, coords.y)
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
    for (const key in tiles) tiles[key].retain = tiles[key].current
    for (const key in tiles) {
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
