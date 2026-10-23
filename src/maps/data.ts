import type { Event, MapView, Place, Road, Town } from '@/payload-types'

import {
  boundsOf,
  isPoint,
  outlineToRing,
  outlinesChunks,
  pathLength,
  roadCourse,
  type Bounds,
  type Outline,
  type Point,
  type RoadShape,
} from './geo'
import type { MapName } from './source'
import { isPlaceCategory } from './icons'
import {
  drawingsProblem,
  isTownKind,
  ROAD_KINDS,
  type Drawing,
  type MapLayer,
  type PlaceCategory,
  type RoadKind,
  type Stance,
  type TownKind,
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
  /** The residents' names as Towny lists them, for telling Azanians apart among the players online; none for a site. */
  names: string[]
  chunks: number
  founded: string | null
  /** Towny's "Public Teleport": whether any player may `/t spawn` here; null when the map doesn't say. */
  publicSpawn: boolean | null
  /** A players' town, or a site the server runs and Azania holds (a quarry, a treasure ship): see isSite. */
  kind: TownKind
  /** A server site's terms as the map gives them; what it pays a day, in $; what a quarry produces. */
  site: { note: string | null; income: number | null; resource: string | null } | null
  home: Point | null
  claims: Outline[]
  /** Of the claims, for culling and fitting. */
  bounds: Bounds | null
  /** When the record last changed; versions its link-preview card. Absent on a draft. */
  updatedAt?: string
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
  updatedAt?: string
}

export type MapRoad = {
  id: number
  name: string | null
  kind: RoadKind
  /** The points as drawn; the course between them is `shape`'s (see roadPoints). */
  line: Point[]
  shape: RoadShape
  /** In a curved road, the points kept as sharp turns, by index. */
  corners: number[]
  town: number | null
  updatedAt?: string
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
  updatedAt?: string
}

export type MapViewData = {
  id: number
  title: string
  centre: Point
  span: number
  aspect: MapView['aspect']
  map: MapName
  layers: MapLayer[]
  drawings: Drawing[]
  createdBy: number | null
}

export type MapData = {
  towns: MapTown[]
  places: MapPlace[]
  roads: MapRoad[]
  events: MapEvent[]
  /** Where Azania stands with other nations (Settings → Azania Maps); the rest are neutral. */
  relations: Relation[]
}

/** Azania's stance toward another Towny nation, by its name as the map spells it. */
export type Relation = { nation: string; stance: Stance; note: string | null }

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

/**
 * The visitor's rights on the map, worked out in the browser from their
 * own account (/api/users/me), by the server's rule (src/access/maps.ts):
 * staff and cartographers draw anywhere, mayors inside their towns, and
 * map views are for staff, cartographers and anyone granted a context to
 * write in. The pages themselves are cached for everyone alike, so this is
 * the only thing about a visitor the map needs.
 */
export function mapRightsOf(user: unknown): MapRights {
  const account = user as {
    id?: number
    name?: string
    role?: string | null
    cartographer?: boolean | null
    mayorOf?: (number | { id: number })[] | null
    contextAccess?: { context?: number | { id: number } | null; level?: string | null }[] | null
  } | null
  if (!account || typeof account.id !== 'number') return NO_RIGHTS
  const anywhere = account.role === 'editor' || account.role === 'admin' || Boolean(account.cartographer)
  const towns = (account.mayorOf ?? []).map(idOf).filter((id): id is number => id !== null)
  const views =
    anywhere || (account.contextAccess ?? []).some((grant) => idOf(grant.context) !== null && Boolean(grant.level))
  return { user: { id: account.id, name: account.name ?? '' }, anywhere, towns, views }
}

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

/** Whether a town is a site the server runs (a quarry, a treasure ship), not a players' town. */
export const isSite = (town: Pick<MapTown, 'kind'>): boolean => town.kind !== 'town'

export function mapTown(town: Town): MapTown {
  const claims = outlinesOf(town.claims)
  const kind = isTownKind(town.kind) ? town.kind : 'town'
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
    names:
      kind === 'town' && Array.isArray(town.residents)
        ? town.residents.filter((name): name is string => typeof name === 'string')
        : [],
    chunks: town.chunks ?? 0,
    founded: town.founded ?? null,
    publicSpawn: typeof town.publicSpawn === 'boolean' ? town.publicSpawn : null,
    kind,
    site:
      kind === 'town'
        ? null
        : { note: town.siteNote ?? null, income: town.income ?? null, resource: town.resource ?? null },
    home,
    claims,
    bounds: boundsOf(claims.flatMap(outlineToRing)),
    updatedAt: town.updatedAt,
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
    updatedAt: place.updatedAt,
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
    shape: road.shape === 'curved' ? 'curved' : 'straight',
    corners: Array.isArray(road.corners)
      ? road.corners.filter((index): index is number => Number.isInteger(index))
      : [],
    town: idOf(road.town),
    updatedAt: road.updatedAt,
  }
}

/**
 * The course a road takes, as the map draws it and the server judges it
 * (src/maps/geo.ts → roadCourse): its own points when straight, a polyline
 * along the curve when curved.
 */
export const roadPoints = (road: Pick<MapRoad, 'line' | 'shape' | 'corners'>): Point[] =>
  roadCourse(road.line, road.shape, road.corners)

/** A road's length in blocks, along its course. */
export const roadLength = (road: Pick<MapRoad, 'line' | 'shape' | 'corners'>): number =>
  pathLength(roadPoints(road))

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
    updatedAt: event.updatedAt,
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
    map: 'flat',
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

/** A town's centre: its home block, else the middle of its claims. */
export const townCentre = (town: MapTown): Point | null =>
  town.home ??
  (town.bounds
    ? [(town.bounds.minX + town.bounds.maxX) / 2, (town.bounds.minZ + town.bounds.maxZ) / 2]
    : null)

/** The claim of a town that holds its home block, if one does. */
export function homeClaim(town: MapTown): Outline | null {
  if (!town.home) return null
  const [hx, hz] = town.home
  return (
    town.claims.find((claim) => {
      const b = boundsOf(outlineToRing(claim))
      return b && hx >= b.minX && hx <= b.maxX && hz >= b.minZ && hz <= b.maxZ
    }) ?? null
  )
}

/**
 * The claim of a town that holds its home: the main settlement, as against
 * far-flung outposts. The whole town, when the home lies in none.
 */
export function homeClaimBounds(town: MapTown): Bounds | null {
  const holding = homeClaim(town)
  return holding ? boundsOf(outlineToRing(holding)) : town.bounds
}

export type Outpost = { bounds: Bounds; chunks: number; centre: Point }

/**
 * A town's outposts: Towny claims away from the one holding the home block
 * (Patown's main claim is near (-15368, 2008), its outposts elsewhere),
 * largest first. Empty for a town in one piece.
 */
export function outpostsOf(town: MapTown): Outpost[] {
  const main = homeClaim(town)
  if (!main) return []
  return town.claims
    .filter((claim) => claim !== main)
    .map((claim) => {
      const bounds = boundsOf(outlineToRing(claim))!
      return {
        bounds,
        chunks: outlinesChunks([claim]),
        centre: [(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2] as Point,
      }
    })
    .sort((a, b) => b.chunks - a.chunks)
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

/**
 * The nation around a frame, for a map shown inside an article: towns whose
 * claims come near it and everything that stands within reach, so a reader
 * who pans a little finds the neighbourhood and the whole page carries no
 * more than it needs.
 */
export function around(data: MapData, bounds: Bounds, reach = 6): MapData {
  const dx = (bounds.maxX - bounds.minX) * reach
  const dz = (bounds.maxZ - bounds.minZ) * reach
  const area: Bounds = {
    minX: bounds.minX - dx,
    maxX: bounds.maxX + dx,
    minZ: bounds.minZ - dz,
    maxZ: bounds.maxZ + dz,
  }
  const inside = ([x, z]: Point) => x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ
  const touches = (b: Bounds | null) =>
    b !== null && b.minX <= area.maxX && b.maxX >= area.minX && b.minZ <= area.maxZ && b.maxZ >= area.minZ
  return {
    towns: data.towns.filter((town) => touches(town.bounds)),
    places: data.places.filter((place) => inside(place.point)),
    roads: data.roads.filter((road) => touches(boundsOf(road.line))),
    events: data.events.filter((event) => inside(event.point)),
    relations: data.relations,
  }
}
