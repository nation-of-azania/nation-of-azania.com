'use client'

import L from 'leaflet'

import { TILE_SIZE, type Bounds, type Point } from '@/maps/geo'
import { WORLD_EAST, WORLD_WEST } from '@/maps/source'

/**
 * Leaflet, taught the Rulercraft map's projection. Block (x, z) is pixel
 * (2x, 2z + 128) at Dynmap's level 0, each level up halving it
 * (src/maps/geo.ts); so a Leaflet "latitude" is z, a "longitude" x, zoom 0
 * is level 0 (2 px per block), and level n is zoom −n. Zooming past 0
 * scales the level-0 tiles up, pixel for pixel, which suits a world made
 * of blocks. Only ever loaded in the browser, through next/dynamic.
 */
export const AzaniaCRS: L.CRS = L.Util.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(2, 0, 2, TILE_SIZE),
  infinite: true,
})

/**
 * The same, with the world repeated east and west: Leaflet wraps the tiles'
 * columns at the world's edges (src/maps/source.ts), so a pan never runs
 * out of map. The world doesn't wrap in the game; the live map says so
 * without words, washing the echoes and tearing the sheet at every edge
 * (src/components/maps/layers/WorldEdge.tsx), and keeps the reader in the
 * real world by re-basing the map whenever the view's centre crosses a
 * seam (./home.ts).
 */
export const AzaniaWrappingCRS: L.CRS = L.Util.extend({}, AzaniaCRS, {
  wrapLng: [WORLD_WEST, WORLD_EAST],
})

export const toLatLng = ([x, z]: Point): L.LatLng => L.latLng(z, x)
export const toPoint = (latlng: L.LatLng): Point => [latlng.lng, latlng.lat]
export const toLatLngBounds = (bounds: Bounds): L.LatLngBounds =>
  L.latLngBounds([bounds.minZ, bounds.minX], [bounds.maxZ, bounds.maxX])
