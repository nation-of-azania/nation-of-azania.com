'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { pixelsPerBlock } from '@/maps/palette'
import { TILE_SIZE, WORLD_LIMIT, type Bounds, type Point } from '@/maps/geo'
import { cachedTileUrl, MAPS, type MapName } from '@/maps/source'

import type { Projection } from '../layers/projection'

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

export const toLatLng = ([x, z]: Point): L.LatLng => L.latLng(z, x)
export const toPoint = (latlng: L.LatLng): Point => [latlng.lng, latlng.lat]
export const toLatLngBounds = (bounds: Bounds): L.LatLngBounds =>
  L.latLngBounds([bounds.minZ, bounds.minX], [bounds.maxZ, bounds.maxX])

export const MAX_ZOOM = 3
export const minZoomOf = (map: MapName) => -MAPS[map].maxLevel

/** A 1×1 transparent PNG: what a tile shows while the map can't be reached, so the backdrop shows through. */
const EMPTY_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/** The Rulercraft map's tiles through the site's cache (src/maps/source.ts). */
class AzaniaTileLayer extends L.TileLayer {
  constructor(private readonly mapName: MapName) {
    super('', {
      tileSize: TILE_SIZE,
      minZoom: minZoomOf(mapName),
      maxZoom: MAX_ZOOM,
      minNativeZoom: minZoomOf(mapName),
      maxNativeZoom: 0,
      keepBuffer: 3,
      updateWhenZooming: false,
      errorTileUrl: EMPTY_TILE,
      className: 'az-tile',
    })
  }

  getTileUrl(coords: L.Coords): string {
    return cachedTileUrl(this.mapName, -coords.z, coords.x, coords.y)
  }
}

export type MapPosition = { centre: Point; zoom: number }

type MapContextValue = { map: L.Map; version: number }

const MapContext = createContext<MapContextValue | null>(null)

/** The Leaflet map and a counter that advances whenever the view settles. */
export function useLeaflet(): MapContextValue {
  const value = useContext(MapContext)
  if (!value) throw new Error('useLeaflet needs a MapCanvas above it.')
  return value
}

/** The projection for the overlay at the current view; recomputed when the view settles. */
export function useProjection(id = 'map'): Projection {
  const { map, version } = useLeaflet()
  return useMemo(() => {
    const zoom = map.getZoom()
    const bounds = map.getBounds().pad(0.3)
    return {
      project: ([x, z]: Point) => {
        const p = map.latLngToLayerPoint(L.latLng(z, x))
        return [p.x, p.y]
      },
      ppb: pixelsPerBlock(zoom),
      zoom,
      bounds: {
        minX: bounds.getWest(),
        maxX: bounds.getEast(),
        minZ: bounds.getSouth(),
        maxZ: bounds.getNorth(),
      },
      id,
    }
    // version is the signal that the map has moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, version, id])
}

type CanvasProps = {
  mapName: MapName
  /** Where to open: a centre and zoom, or bounds to fit. */
  initial: MapPosition | { bounds: Bounds; padding?: number }
  className?: string
  /** The CSS cursor over the map, e.g. crosshair while drawing. */
  cursor?: string
  /** Dragging and zooming by hand; off for a still frame that opens on a tap. */
  interactive?: boolean
  onReady?: (map: L.Map) => void
  onMove?: (position: MapPosition) => void
  onPointer?: (point: Point | null) => void
  onClick?: (point: Point, event: L.LeafletMouseEvent) => void
  onDoubleClick?: (point: Point, event: L.LeafletMouseEvent) => void
  /** Rendered into the SVG overlay, in layer coordinates (useProjection). */
  children?: ReactNode
  /** Rendered over the map as ordinary DOM, inside the container (controls, frames). */
  chrome?: ReactNode
}

/**
 * The map itself: a Leaflet map in a div, its tiles from the cache, and an
 * SVG overlay the children are rendered into through a portal. Leaflet's
 * own SVG renderer owns that overlay, so it is positioned and scaled by
 * Leaflet during pans and zoom animations like any path layer; the
 * children re-render once the view settles, at the new layer points.
 */
export function MapCanvas({
  mapName,
  initial,
  className,
  cursor,
  interactive = true,
  onReady,
  onMove,
  onPointer,
  onClick,
  onDoubleClick,
  children,
  chrome,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tilesRef = useRef<AzaniaTileLayer | null>(null)
  const [overlay, setOverlay] = useState<SVGGElement | null>(null)
  const [context, setContext] = useState<MapContextValue | null>(null)
  const handlers = useRef({ onMove, onPointer, onClick, onDoubleClick })
  useEffect(() => {
    handlers.current = { onMove, onPointer, onClick, onDoubleClick }
  })

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return
    const map = L.map(container, {
      crs: AzaniaCRS,
      minZoom: minZoomOf(mapName),
      maxZoom: MAX_ZOOM,
      zoomSnap: 0,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      zoomControl: false,
      attributionControl: false,
      maxBounds: toLatLngBounds({
        minX: -WORLD_LIMIT,
        maxX: WORLD_LIMIT,
        minZ: -WORLD_LIMIT,
        maxZ: WORLD_LIMIT,
      }),
      maxBoundsViscosity: 0.9,
      boxZoom: false,
      doubleClickZoom: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      touchZoom: interactive,
      keyboard: interactive,
    })
    mapRef.current = map
    if ('bounds' in initial) {
      map.fitBounds(toLatLngBounds(initial.bounds), {
        padding: [initial.padding ?? 48, initial.padding ?? 48],
        animate: false,
      })
    } else {
      map.setView(toLatLng(initial.centre), initial.zoom, { animate: false })
    }

    const tiles = new AzaniaTileLayer(mapName).addTo(map)
    tilesRef.current = tiles

    // The overlay: Leaflet's SVG renderer, with a group of our own for React.
    const renderer = L.svg({ padding: 0.6 }).addTo(map)
    const svg = (renderer as unknown as { _container: SVGSVGElement })._container
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'az-overlay')
    svg.appendChild(group)
    setOverlay(group)

    let version = 0
    const settle = () => setContext({ map, version: ++version })
    map.on('moveend zoomend viewreset resize', settle)
    map.on('moveend', () =>
      handlers.current.onMove?.({ centre: toPoint(map.getCenter()), zoom: map.getZoom() }),
    )
    map.on('mousemove', (event: L.LeafletMouseEvent) =>
      handlers.current.onPointer?.(toPoint(event.latlng)),
    )
    map.on('mouseout', () => handlers.current.onPointer?.(null))
    map.on('click', (event: L.LeafletMouseEvent) =>
      handlers.current.onClick?.(toPoint(event.latlng), event),
    )
    map.on('dblclick', (event: L.LeafletMouseEvent) =>
      handlers.current.onDoubleClick?.(toPoint(event.latlng), event),
    )

    // The map's box changes when a panel opens beside it.
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(container)

    settle()
    handlers.current.onMove?.({ centre: toPoint(map.getCenter()), zoom: map.getZoom() })
    onReady?.(map)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      setOverlay(null)
      setContext(null)
    }
    // Created once; later changes come through the other effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching between the flat and the biome map.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !tilesRef.current) return
    if ((tilesRef.current as unknown as { mapName: MapName }).mapName === mapName) return
    const previous = tilesRef.current
    const next = new AzaniaTileLayer(mapName).addTo(map)
    tilesRef.current = next
    map.setMinZoom(minZoomOf(mapName))
    // Keep the old tiles until the new ones have painted, so the ground never blinks.
    next.once('load', () => previous.remove())
    window.setTimeout(() => previous.remove(), 2500)
  }, [mapName])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const toggle = (handler: L.Handler | undefined, on: boolean) =>
      on ? handler?.enable() : handler?.disable()
    toggle(map.dragging, interactive)
    toggle(map.scrollWheelZoom, interactive)
    toggle(map.touchZoom, interactive)
    toggle(map.keyboard, interactive)
  }, [interactive])

  return (
    <div
      className={className}
      ref={containerRef}
      style={{ cursor: cursor ?? undefined }}
      tabIndex={-1}
    >
      {context && overlay ? (
        <MapContext.Provider value={context}>
          {createPortal(children, overlay)}
          {chrome}
        </MapContext.Provider>
      ) : null}
    </div>
  )
}

/** Fly the map somewhere, settling without animation for readers who ask for less motion. */
export function flyTo(map: L.Map, centre: Point, zoom?: number): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const target = toLatLng(centre)
  const z = zoom ?? map.getZoom()
  if (reduced) map.setView(target, z, { animate: false })
  else map.flyTo(target, z, { duration: 0.8 })
}

export function fitBounds(map: L.Map, bounds: Bounds, padding = 48): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  map.fitBounds(toLatLngBounds(bounds), {
    padding: [padding, padding],
    animate: !reduced,
    duration: 0.8,
  })
}

export { L }
