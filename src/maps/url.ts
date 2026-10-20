import { isCoordinate, type Point } from './geo'
import { isMapName, type MapName } from './source'
import { MAP_LAYERS, type MapLayer } from './registry'

/**
 * Azania Maps' addresses. Things have pages of their own, so a link to a
 * town or an event unfurls as that town or event:
 *
 *   /maps                       the map
 *   /maps/town/<slug>           a town, its panel open
 *   /maps/place/<id>            a place
 *   /maps/road/<id>             a road
 *   /maps/event/<id>            an event
 *
 * and the view itself travels in the query, on any of them:
 *
 *   ?at=<x>,<z>,<zoom>          centre and zoom (zoom 0 is the map's native scale, 2 px per block)
 *   &layers=towns,roads         which layers show (all, when absent)
 *   &view=<id>                  an article's map view, framed with its highlights
 *   &draw=view                  the view editor, open: a new view, or the one named by &view=
 */

export type MapSelection =
  | { kind: 'town'; slug: string }
  | { kind: 'place'; id: number }
  | { kind: 'road'; id: number }
  | { kind: 'event'; id: number }

export type MapPosition = { centre: Point; zoom: number }

export const MAPS_PATH = '/maps'

export const townHref = (slug: string) => `${MAPS_PATH}/town/${encodeURIComponent(slug)}`
export const placeHref = (id: number) => `${MAPS_PATH}/place/${id}`
export const roadHref = (id: number) => `${MAPS_PATH}/road/${id}`
export const eventHref = (id: number) => `${MAPS_PATH}/event/${id}`

export function selectionHref(selection: MapSelection | null): string {
  if (!selection) return MAPS_PATH
  switch (selection.kind) {
    case 'town':
      return townHref(selection.slug)
    case 'place':
      return placeHref(selection.id)
    case 'road':
      return roadHref(selection.id)
    case 'event':
      return eventHref(selection.id)
  }
}

/** The selection a path names, or null for the plain map. */
export function selectionOf(pathname: string): MapSelection | null {
  const match = /^\/maps\/(town|place|road|event)\/([^/?#]+)\/?$/.exec(pathname)
  if (!match) return null
  const [, kind, raw] = match
  if (kind === 'town') return { kind, slug: decodeURIComponent(raw) }
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : null
  if (id == null) return null
  return { kind: kind as 'place' | 'road' | 'event', id }
}

export const sameSelection = (a: MapSelection | null, b: MapSelection | null): boolean =>
  a === b ||
  (a != null &&
    b != null &&
    a.kind === b.kind &&
    (a.kind === 'town'
      ? a.slug === (b as { slug: string }).slug
      : a.id === (b as { id: number }).id))

/** "4296,4952,1.5": the `at` parameter. Coordinates to the block, zoom to a quarter step. */
export const encodeAt = ({ centre: [x, z], zoom }: MapPosition): string =>
  `${Math.round(x)},${Math.round(z)},${Math.round(zoom * 4) / 4}`

export function decodeAt(value: string | null | undefined): MapPosition | null {
  if (!value) return null
  const parts = value.split(',').map(Number)
  if (parts.length < 2 || parts.length > 3) return null
  const [x, z, zoom = 0] = parts
  if (!isCoordinate(x) || !isCoordinate(z) || !Number.isFinite(zoom) || zoom < -8 || zoom > 6)
    return null
  return { centre: [x, z], zoom }
}

export const isMapLayer = (value: unknown): value is MapLayer =>
  typeof value === 'string' && value in MAP_LAYERS

export const ALL_LAYERS = Object.keys(MAP_LAYERS) as MapLayer[]

export function decodeLayers(value: string | null | undefined): MapLayer[] | null {
  if (value == null) return null
  const layers = value.split(',').filter(isMapLayer)
  return layers
}

/** What the editor may be asked to open on arrival. */
export type MapDraw = 'view'

/** The map's state as a query, for sharing, for the Map block's mark, and for the admin's way in. */
export function mapsQuery({
  at,
  map,
  layers,
  view,
  draw,
}: {
  at?: MapPosition | null
  map?: MapName | null
  layers?: MapLayer[] | null
  view?: number | null
  draw?: MapDraw | null
}): string {
  const query = new URLSearchParams()
  if (at) query.set('at', encodeAt(at))
  if (map && map !== 'flat') query.set('map', map)
  if (layers && layers.length !== ALL_LAYERS.length) query.set('layers', layers.join(','))
  if (view) query.set('view', String(view))
  if (draw) query.set('draw', draw)
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const decodeDraw = (value: string | null | undefined): MapDraw | null => (value === 'view' ? value : null)

/** A link into Azania Maps at a spot, as the Map block's mark gives it. */
export const mapsHref = (options: Parameters<typeof mapsQuery>[0], path = MAPS_PATH): string =>
  `${path}${mapsQuery(options)}`

export const decodeMapName = (value: string | null | undefined): MapName =>
  isMapName(value) ? value : 'flat'
