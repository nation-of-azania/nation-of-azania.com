'use client'

import L from 'leaflet'

import { cachedTileUrl, MAPS, WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH } from '@/maps/source'

/**
 * The whole world as one picture, for the zooms past SHEET_ZOOM where the
 * tiles would number in the hundreds and a pan would stutter: the level-5
 * tiles are drawn once into a canvas, at half their size since the sheet
 * is never shown larger than that, and the canvas is laid over the map as
 * an image overlay, placed and scaled by Leaflet like any other — three
 * times when the world wraps, the real sheet and an echo either side. Three
 * elements where the tile layer would have seven hundred. The tiles are
 * the tile layer's own, from the same cache, fetched the first time the map
 * goes this far out and drawn as they arrive.
 */

/** Below this zoom the sheet stands in for the tiles; the tile layer keeps its tiles down to here. */
export const SHEET_ZOOM = -6

const LEVEL = MAPS.flat.maxLevel
/** A level-5 tile's extent in blocks, and the pixels it takes in the sheet. */
const TILE_BLOCKS = 64 * 2 ** LEVEL
const TILE_PX = 64
/** Tiles fetched at once. */
const AT_ONCE = 12

/** The level-5 tile grid the sheet covers (src/maps/geo.ts → blockToPixel): the world's columns, and its rows from top to bottom. */
const column = (x: number) => Math.floor(x / TILE_BLOCKS)
const row = (z: number) => Math.floor((2 * z + 128) / (128 * 2 ** LEVEL))
const COLUMNS = { from: column(WORLD_WEST), to: column(WORLD_EAST - 1) }
const ROWS = { from: row(WORLD_NORTH), to: row(WORLD_SOUTH - 1) }

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
    self._image = element
  }
}

/**
 * Lays the sheets on the map and keeps them to the zooms past SHEET_ZOOM,
 * fetching the tiles the first time they're wanted. Returns what takes
 * them off again.
 */
export function attachSheets(map: L.Map, wrap: boolean): () => void {
  const width = (COLUMNS.to - COLUMNS.from + 1) * TILE_PX
  const height = (ROWS.to - ROWS.from + 1) * TILE_PX
  const copies = wrap ? [0, -1, 1] : [0]
  const canvases = copies.map(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  })
  const overlays = copies.map((copy, index) => {
    const shift = copy * WORLD_WIDTH
    const bounds = L.latLngBounds([SHEET.minZ, SHEET.minX + shift], [SHEET.maxZ, SHEET.maxX + shift])
    // Under the tiles, for the zooms where both are on the map.
    return new CanvasOverlay(canvases[index], bounds, { pane: 'tilePane', zIndex: 0, className: 'az-sheet' })
  })

  let cancelled = false
  let fetching = false
  const fetchTiles = () => {
    const tiles: [number, number][] = []
    for (let r = ROWS.from; r <= ROWS.to; r++) for (let c = COLUMNS.from; c <= COLUMNS.to; c++) tiles.push([c, r])
    let next = 0
    const take = () => {
      if (cancelled || next >= tiles.length) return
      const [c, r] = tiles[next++]
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => {
        if (cancelled) return
        const x = (c - COLUMNS.from) * TILE_PX
        const y = (r - ROWS.from) * TILE_PX
        for (const canvas of canvases) canvas.getContext('2d')?.drawImage(image, x, y, TILE_PX, TILE_PX)
        take()
      }
      image.onerror = take
      image.src = cachedTileUrl('flat', LEVEL, c, r)
    }
    for (let i = 0; i < AT_ONCE; i++) take()
  }

  const update = () => {
    const far = map.getZoom() < SHEET_ZOOM
    for (const overlay of overlays) {
      if (far && !map.hasLayer(overlay)) overlay.addTo(map)
      else if (!far && map.hasLayer(overlay)) overlay.remove()
    }
    if (far && !fetching) {
      fetching = true
      fetchTiles()
    }
  }
  map.on('zoom zoomend', update)
  update()
  return () => {
    cancelled = true
    map.off('zoom zoomend', update)
    for (const overlay of overlays) overlay.remove()
  }
}
