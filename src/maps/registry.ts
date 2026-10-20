import { isPoint, type Point, type RoadShape } from './geo'

/**
 * What Azania Maps knows how to show, defined in code like the site's designs
 * and styles: the stored values are these keys, and the map draws each one
 * its own way (icons, line weights, colours). Adding an entry here is the
 * whole job of adding a category; renaming a key needs a migration.
 */

/** Places, grouped as a map legend would group them. */
export const PLACE_GROUPS = {
  food: 'Food & drink',
  shopping: 'Shopping & money',
  stay: 'Places to stay',
  civic: 'Government & civic',
  culture: 'Culture & faith',
  learning: 'Learning & health',
  transport: 'Getting around',
  outdoors: 'Outdoors',
  industry: 'Work & industry',
  other: 'Other',
} as const
export type PlaceGroup = keyof typeof PLACE_GROUPS

export const PLACE_CATEGORIES = {
  restaurant: { label: 'Restaurant', group: 'food' },
  cafe: { label: 'Café', group: 'food' },
  bar: { label: 'Bar or tavern', group: 'food' },
  bakery: { label: 'Bakery', group: 'food' },
  shop: { label: 'Shop', group: 'shopping' },
  market: { label: 'Market', group: 'shopping' },
  bank: { label: 'Bank', group: 'shopping' },
  hotel: { label: 'Hotel or inn', group: 'stay' },
  townhall: { label: 'Town hall', group: 'civic' },
  government: { label: 'Government building', group: 'civic' },
  embassy: { label: 'Embassy', group: 'civic' },
  court: { label: 'Court', group: 'civic' },
  post: { label: 'Post office', group: 'civic' },
  museum: { label: 'Museum or gallery', group: 'culture' },
  library: { label: 'Library', group: 'culture' },
  theatre: { label: 'Theatre or arena', group: 'culture' },
  worship: { label: 'Place of worship', group: 'culture' },
  monument: { label: 'Monument', group: 'culture' },
  castle: { label: 'Castle or palace', group: 'culture' },
  school: { label: 'School or university', group: 'learning' },
  hospital: { label: 'Hospital', group: 'learning' },
  station: { label: 'Station', group: 'transport' },
  port: { label: 'Port or harbour', group: 'transport' },
  airfield: { label: 'Airfield (elytra)', group: 'transport' },
  portal: { label: 'Nether portal', group: 'transport' },
  park: { label: 'Park or garden', group: 'outdoors' },
  viewpoint: { label: 'Viewpoint', group: 'outdoors' },
  beach: { label: 'Beach', group: 'outdoors' },
  farm: { label: 'Farm', group: 'industry' },
  mine: { label: 'Mine or quarry', group: 'industry' },
  workshop: { label: 'Workshop or factory', group: 'industry' },
  residence: { label: 'Residence', group: 'other' },
  landmark: { label: 'Landmark', group: 'other' },
  other: { label: 'Other', group: 'other' },
} as const satisfies Record<string, { label: string; group: PlaceGroup }>
export type PlaceCategory = keyof typeof PLACE_CATEGORIES

/** Roads by class, widest first, as a map ranks them when drawing. */
export const ROAD_KINDS = {
  highway: { label: 'National road' },
  main: { label: 'Main road' },
  street: { label: 'Street' },
  path: { label: 'Path or trail' },
  rail: { label: 'Railway' },
  iceroad: { label: 'Ice road (boats)' },
  canal: { label: 'Canal or waterway' },
} as const
export type RoadKind = keyof typeof ROAD_KINDS

/** How a road runs between its points (src/maps/geo.ts → roadCourse). Straight is the everyday choice. */
export const ROAD_SHAPES = {
  straight: { label: 'Straight from point to point' },
  curved: { label: 'Curved smoothly through the points' },
} as const satisfies Record<RoadShape, { label: string }>

/** What a map can show on top of the Rulercraft tiles. */
export const MAP_LAYERS = {
  towns: { label: 'Azanian towns (claims and names)' },
  places: { label: 'Places' },
  roads: { label: 'Roads' },
  events: { label: 'Events' },
} as const
export type MapLayer = keyof typeof MAP_LAYERS

/**
 * The inks a highlight may be drawn in: a fixed, on-brand set rather than a
 * colour picker, like the site's styles. The map decides the actual colours.
 */
export const INKS = {
  red: { label: 'Red' },
  gold: { label: 'Gold' },
  sea: { label: 'Sea' },
  green: { label: 'Green' },
  rose: { label: 'Rose' },
  ink: { label: 'Ink' },
  white: { label: 'White' },
} as const
export type Ink = keyof typeof INKS

/** A map view's frame shape, matching the Map block's aspects. */
export const VIEW_ASPECTS = {
  wide: { label: 'Wide (16:9)', ratio: 16 / 9 },
  square: { label: 'Square', ratio: 1 },
  banner: { label: 'Banner (3:1)', ratio: 3 },
} as const
export type ViewAspect = keyof typeof VIEW_ASPECTS

/**
 * Highlights drawn on a map view (src/collections/maps/MapViews.ts): marks
 * for a reader's eye, with no meaning on the map beyond the view itself.
 * Roads and places are their own collections, with names and categories.
 */
export type Drawing =
  /** A stroke: freehand or point-to-point, optionally ending in an arrow. */
  | { kind: 'line'; points: Point[]; ink: Ink; weight?: 1 | 2 | 3; arrow?: boolean; label?: string }
  /** A shaded area. */
  | { kind: 'area'; points: Point[]; ink: Ink; label?: string }
  | { kind: 'pin'; at: Point; ink: Ink; label?: string }
  | { kind: 'text'; at: Point; ink: Ink; text: string }

export const DRAWING_LIMITS = { drawings: 200, points: 2000, label: 80 } as const

export const options = (registry: Record<string, { label: string }>) =>
  Object.entries(registry).map(([value, { label }]) => ({ label, value }))

export const isInk = (value: unknown): value is Ink => typeof value === 'string' && value in INKS

const isLabel = (value: unknown) =>
  value === undefined || (typeof value === 'string' && value.length <= DRAWING_LIMITS.label)

const isPath = (value: unknown, min: number) =>
  Array.isArray(value) && value.length >= min && value.length <= DRAWING_LIMITS.points && value.every(isPoint)

/** Why a list of drawings can't be stored, or null when it can. */
export function drawingsProblem(value: unknown): string | null {
  if (value == null) return null
  if (!Array.isArray(value)) return 'Drawings must be a list.'
  if (value.length > DRAWING_LIMITS.drawings) return `At most ${DRAWING_LIMITS.drawings} drawings per view.`
  for (const [index, drawing] of value.entries()) {
    const d = drawing as Record<string, unknown>
    const where = `Drawing ${index + 1}`
    if (!isInk(d?.ink)) return `${where}: unknown ink.`
    switch (d.kind) {
      case 'line':
        if (!isPath(d.points, 2)) return `${where}: a line needs 2 to ${DRAWING_LIMITS.points} points on the map.`
        if (d.weight !== undefined && ![1, 2, 3].includes(d.weight as number)) return `${where}: weight is 1, 2 or 3.`
        if (d.arrow !== undefined && typeof d.arrow !== 'boolean') return `${where}: arrow is true or false.`
        if (!isLabel(d.label)) return `${where}: labels are at most ${DRAWING_LIMITS.label} characters.`
        break
      case 'area':
        if (!isPath(d.points, 3)) return `${where}: an area needs 3 to ${DRAWING_LIMITS.points} points on the map.`
        if (!isLabel(d.label)) return `${where}: labels are at most ${DRAWING_LIMITS.label} characters.`
        break
      case 'pin':
        if (!isPoint(d.at)) return `${where}: a pin needs a point on the map.`
        if (!isLabel(d.label)) return `${where}: labels are at most ${DRAWING_LIMITS.label} characters.`
        break
      case 'text':
        if (!isPoint(d.at)) return `${where}: text needs a point on the map.`
        if (typeof d.text !== 'string' || !d.text.trim() || d.text.length > DRAWING_LIMITS.label) {
          return `${where}: text is 1 to ${DRAWING_LIMITS.label} characters.`
        }
        break
      default:
        return `${where}: unknown kind of drawing.`
    }
  }
  return null
}
