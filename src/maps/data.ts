import type { Event, MapView, Place, Road, Town } from '@/payload-types'

import { boundsOf, isPoint, outlineToRing, type Bounds, type Outline, type Point } from './geo'
import { isPlaceCategory } from './icons'
import {
  drawingsProblem,
  ROAD_KINDS,
  type Drawing,
  type MapLayer,
  type PlaceCategory,
  type RoadKind,
} from './registry'

/**
 * What the map in the browser works with: the collections' documents
 * trimmed to the fields the map draws and the panels name, in block
 * coordinates, with every relation reduced to an id. Built on the server
 * (src/lib/maps.ts) and passed to the client once; a few kilobytes for the
 * whole nation. Pure functions only, so the Map block's static renderer
 * can use the same shapes on the server.
 */

export type MapTown = {
  id: number
  name: string
  slug: string
  nation: string | null
  ruler: string | null
  residents: number
  chunks: number
  founded: string | null
  home: Point | null
  claims: Outline[]
  /** Of the claims, for culling and fitting. */
  bounds: Bounds | null
}

export type MapPlace = {
  id: number
  name: string
  category: PlaceCategory
  description: string | null
  point: Point
  y: number | null
  outline: Point[] | null
  town: number | null
}

export type MapRoad = {
  id: number
  name: string | null
  kind: RoadKind
  line: Point[]
  town: number | null
}

export type MapEvent = {
  id: number
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
  point: Point
  place: number | null
  host: string | null
  article: number | null
  town: number | null
}

export type MapViewData = {
  id: number
  title: string
  centre: Point
  span: number
  aspect: MapView['aspect']
  map: MapView['map']
  layers: MapLayer[]
  drawings: Drawing[]
  createdBy: number | null
}

export type MapData = {
  towns: MapTown[]
  places: MapPlace[]
  roads: MapRoad[]
  events: MapEvent[]
}

/** What the signed-in person may do on the map; null fields for a visitor. */
export type MapRights = {
  user: { id: number; name: string } | null
  /** Staff or cartographer: draw anywhere. */
  anywhere: boolean
  /** Town ids they are mayor of. */
  towns: number[]
  /** May draw map views for articles. */
  views: boolean
}

export const NO_RIGHTS: MapRights = { user: null, anywhere: false, towns: [], views: false }

const idOf = (value: number | { id: number } | null | undefined): number | null =>
  value == null ? null : typeof value === 'number' ? value : value.id

const pathOf = (value: unknown): Point[] | null =>
  Array.isArray(value) && value.length > 0 && value.every(isPoint) ? (value as Point[]) : null

const outlinesOf = (value: unknown): Outline[] =>
  Array.isArray(value)
    ? value.filter(
        (outline): outline is Outline =>
          Boolean(outline) &&
          Array.isArray((outline as Outline).x) &&
          Array.isArray((outline as Outline).z) &&
          (outline as Outline).x.length === (outline as Outline).z.length &&
          (outline as Outline).x.length > 2,
      )
    : []

export function mapTown(town: Town): MapTown {
  const claims = outlinesOf(town.claims)
  const home = isPoint([town.home?.x, town.home?.z])
    ? ([town.home!.x!, town.home!.z!] as Point)
    : null
  return {
    id: town.id,
    name: town.name,
    slug: town.slug,
    nation: town.nation ?? null,
    ruler: town.ruler ?? null,
    residents: town.residentCount ?? 0,
    chunks: town.chunks ?? 0,
    founded: town.founded ?? null,
    home,
    claims,
    bounds: boundsOf(claims.flatMap(outlineToRing)),
  }
}

export function mapPlace(place: Place): MapPlace | null {
  if (!isPoint([place.point?.x, place.point?.z])) return null
  return {
    id: place.id,
    name: place.name,
    category: isPlaceCategory(place.category) ? place.category : 'other',
    description: place.description ?? null,
    point: [place.point.x, place.point.z],
    y: typeof place.point.y === 'number' ? place.point.y : null,
    outline: pathOf(place.outline),
    town: idOf(place.town),
  }
}

export function mapRoad(road: Road): MapRoad | null {
  const line = pathOf(road.line)
  if (!line || line.length < 2) return null
  return {
    id: road.id,
    name: road.name ?? null,
    kind: road.kind in ROAD_KINDS ? road.kind : 'street',
    line,
    town: idOf(road.town),
  }
}

export function mapEvent(event: Event): MapEvent | null {
  if (!isPoint([event.point?.x, event.point?.z])) return null
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? null,
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    point: [event.point!.x!, event.point!.z!],
    place: idOf(event.place),
    host: event.host ?? null,
    article: idOf(event.article),
    town: idOf(event.town),
  }
}

export function mapView(view: MapView): MapViewData | null {
  if (!isPoint([view.centre?.x, view.centre?.z])) return null
  return {
    id: view.id,
    title: view.title,
    centre: [view.centre.x, view.centre.z],
    span: view.span,
    aspect: view.aspect,
    map: view.map,
    layers: view.layers ?? [],
    drawings:
      drawingsProblem(view.drawings) === null && Array.isArray(view.drawings)
        ? (view.drawings as Drawing[])
        : [],
    createdBy: idOf(view.createdBy),
  }
}

/** "Cape_Agulhas" as Towny spells it, "Cape Agulhas" as a reader says it. */
export const spoken = (name: string): string => name.replace(/_/g, ' ')

/** Length of a line in blocks. */
export function lineLength(line: Point[]): number {
  let total = 0
  for (let i = 1; i < line.length; i++)
    total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
  return total
}

/** A town's centre: its home block, else the middle of its claims. */
export const townCentre = (town: MapTown): Point | null =>
  town.home ??
  (town.bounds
    ? [(town.bounds.minX + town.bounds.maxX) / 2, (town.bounds.minZ + town.bounds.maxZ) / 2]
    : null)

/**
 * The claim of a town that holds its home: the main settlement, as against
 * far-flung outposts. The whole town, when the home lies in none.
 */
export function homeClaimBounds(town: MapTown): Bounds | null {
  if (!town.home) return town.bounds
  const [hx, hz] = town.home
  const holding = town.claims.find((claim) => {
    const ring = outlineToRing(claim)
    const b = boundsOf(ring)
    return b && hx >= b.minX && hx <= b.maxX && hz >= b.minZ && hz <= b.maxZ
  })
  return holding ? boundsOf(outlineToRing(holding)) : town.bounds
}

/**
 * Where the map opens: around the towns' homes, ignoring outposts. Towns
 * far from the rest (a colony across the sea) are left out so the opening
 * view is the heartland rather than an ocean between two specks.
 */
export function heartland(towns: MapTown[]): Bounds | null {
  const homes = towns.map(townCentre).filter((point): point is Point => point !== null)
  if (homes.length === 0) return null
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
  const mx = median(homes.map(([x]) => x))
  const mz = median(homes.map(([, z]) => z))
  const near = homes.filter(([x, z]) => Math.hypot(x - mx, z - mz) <= 4000)
  return boundsOf(near.length ? near : homes)
}
