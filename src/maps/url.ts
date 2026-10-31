import { isCoordinate, type Point } from './geo'
import type { MapName } from './source'
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
 *   /maps/abroad/<slug>         a town of another nation, or of none
 *   /maps/nation/<slug>         another nation
 *
 * and the view itself travels in the query, on any of them:
 *
 *   ?at=<x>,<z>,<zoom>          centre and zoom (zoom 0 is the map's native scale, 2 px per block)
 *   &layers=towns,roads         which layers show (all, when absent), with the layers that
 *                               aren't the nation's own data among them (EXTRA_LAYERS:
 *                               `players` and `world` on, `diplomacy` and `war` off), each
 *                               at its default when absent; `war` is the war view, a mode
 *                               of the whole page rather than a layer, which travels the
 *                               same way so a link shares it
 *   &view=<id>                  an article's map view, framed with its highlights
 *   &draw=view                  the view editor, open: a new view, or the one named by &view=
 *   &globe=1                    the world as a globe, facing at's spot (its zoom −8 to −5);
 *                               a view or the editor in the address outranks it
 *   &siege=<Towny id>           the siege of that town, its card opened at the banner on
 *                               arrival (a siege alert's link); read once, then dropped
 *
 * Old links carried `&map=biomes` for the biome map, which is no longer
 * drawn; the parameter is ignored, so they still open.
 */

export type MapSelection =
  | { kind: 'town'; slug: string }
  | { kind: 'place'; id: number }
  | { kind: 'road'; id: number }
  | { kind: 'event'; id: number }
  | { kind: 'abroad'; slug: string }
  | { kind: 'nation'; slug: string }

export type MapPosition = { centre: Point; zoom: number }

export const MAPS_PATH = '/maps'

export const townHref = (slug: string) => `${MAPS_PATH}/town/${encodeURIComponent(slug)}`
export const placeHref = (id: number) => `${MAPS_PATH}/place/${id}`
export const roadHref = (id: number) => `${MAPS_PATH}/road/${id}`
export const eventHref = (id: number) => `${MAPS_PATH}/event/${id}`
export const abroadHref = (slug: string) => `${MAPS_PATH}/abroad/${encodeURIComponent(slug)}`
export const nationHref = (slug: string) => `${MAPS_PATH}/nation/${encodeURIComponent(slug)}`

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
    case 'abroad':
      return abroadHref(selection.slug)
    case 'nation':
      return nationHref(selection.slug)
  }
}

/** Whether a selection is named by a slug rather than an id. */
const bySlug = (selection: MapSelection): selection is Extract<MapSelection, { slug: string }> =>
  'slug' in selection

/** The selection a path names, or null for the plain map. */
export function selectionOf(pathname: string): MapSelection | null {
  const match = /^\/maps\/(town|place|road|event|abroad|nation)\/([^/?#]+)\/?$/.exec(pathname)
  if (!match) return null
  const [, kind, raw] = match
  if (kind === 'town' || kind === 'abroad' || kind === 'nation') return { kind, slug: decodeURIComponent(raw) }
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : null
  if (id == null) return null
  return { kind: kind as 'place' | 'road' | 'event', id }
}

export const sameSelection = (a: MapSelection | null, b: MapSelection | null): boolean =>
  a === b ||
  (a != null &&
    b != null &&
    a.kind === b.kind &&
    (bySlug(a) ? a.slug === (b as { slug: string }).slug : a.id === (b as { id: number }).id))

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

/**
 * The layers that aren't the nation's own data, and so aren't MAP_LAYERS,
 * which a map view stores: the players online, the server's, live; the
 * rest of the world around the nation; and Azania's diplomacy, the other
 * nations tinted by where it stands with them, with the nations' reach
 * about their capitals (layers/ReachLayer.tsx), which shows only with it;
 * and the war view (src/components/maps/panels/WarPanel.tsx), a mode of
 * the page for the hour of a battle rather than a layer, kept here all
 * the same so that a link to it shares it.
 * None is ever part of a view. Each has its token
 * in `layers` and is at its default when the address names no layers;
 * when it names some, a token is on when it's there.
 */
export const EXTRA_LAYERS = {
  players: { on: true },
  world: { on: true },
  diplomacy: { on: false },
  war: { on: false },
} as const satisfies Record<string, { on: boolean }>
export type ExtraLayer = keyof typeof EXTRA_LAYERS
export type Extras = Record<ExtraLayer, boolean>

export const DEFAULT_EXTRAS = Object.fromEntries(
  Object.entries(EXTRA_LAYERS).map(([layer, { on }]) => [layer, on]),
) as Extras

const isExtra = (value: string): value is ExtraLayer => value in EXTRA_LAYERS

export function decodeLayers(value: string | null | undefined): MapLayer[] | null {
  if (value == null) return null
  const layers = value.split(',').filter(isMapLayer)
  return layers
}

/** Which of the extra layers `layers` turns on; null when the address names no layers at all. */
export function decodeExtras(value: string | null | undefined): Extras | null {
  if (value == null) return null
  const named = new Set(value.split(',').filter(isExtra))
  return Object.fromEntries(Object.keys(EXTRA_LAYERS).map((layer) => [layer, named.has(layer as ExtraLayer)])) as Extras
}

const sameExtras = (a: Extras, b: Extras) => (Object.keys(EXTRA_LAYERS) as ExtraLayer[]).every((layer) => a[layer] === b[layer])

/** What the editor may be asked to open on arrival. */
export type MapDraw = 'view'

/** The map's state as a query, for sharing, for the Map block's mark, and for the admin's way in. */
export function mapsQuery({
  at,
  layers,
  extras,
  view,
  draw,
  globe,
}: {
  at?: MapPosition | null
  /** Accepted for the callers that still name a base map; there is only the one, so it isn't written. */
  map?: MapName | null
  layers?: MapLayer[] | null
  /** The extra layers; written only when they or the layers differ from the defaults. */
  extras?: Extras
  view?: number | null
  draw?: MapDraw | null
  /** The world shown as a globe. */
  globe?: boolean
}): string {
  const query = new URLSearchParams()
  if (at) query.set('at', encodeAt(at))
  const shown = extras ?? DEFAULT_EXTRAS
  if (layers && (layers.length !== ALL_LAYERS.length || !sameExtras(shown, DEFAULT_EXTRAS))) {
    const on = (Object.keys(EXTRA_LAYERS) as ExtraLayer[]).filter((layer) => shown[layer])
    query.set('layers', [...layers, ...on].join(','))
  }
  if (globe) query.set('globe', '1')
  if (view) query.set('view', String(view))
  if (draw) query.set('draw', draw)
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const decodeDraw = (value: string | null | undefined): MapDraw | null => (value === 'view' ? value : null)

/** Whether the address asks for the globe. */
export const decodeGlobe = (value: string | null | undefined): boolean => value === '1'

/** A link into Azania Maps at a spot, as the Map block's mark gives it. */
export const mapsHref = (options: Parameters<typeof mapsQuery>[0], path = MAPS_PATH): string =>
  `${path}${mapsQuery(options)}`
