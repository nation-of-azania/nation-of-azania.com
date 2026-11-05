import type { Point } from './geo'

/**
 * A road's lanes on Azania Maps: its cross-section, the parts across it
 * from left to right as seen looking along the road the way it was drawn,
 * each as wide as built, in blocks. A road without one is drawn by its
 * class (src/maps/palette.ts → ROAD_STYLES); with one, the map can draw it
 * at its true width once zoomed in far enough for that to show, lanes,
 * lines, strips (medians, verges) and pavements where they are, so the drawing lies on the
 * build seen through it.
 *
 * Which way a lane runs is its own: with the road (the way it was drawn),
 * against it, or both (a town's three-wide street, shared). So the side
 * traffic keeps to is no rule of the map's, only how the presets fill in
 * the directions, and a one-way street or a local oddity is lanes set as
 * they really run. Towns build their streets differently (pavements wide
 * or narrow, on one side, behind a grass verge): each road keeps its own,
 * and the editor offers a town's own ones first (lanesInUse).
 *
 * The drawn line (the road's points, and the nodes it shares at junctions,
 * src/maps/junctions.ts) always runs down the middle of the carriageway:
 * the lanes, the lines between them and any median, the pavements and
 * verges along the edges not counted (lanesAxis). So a part widened grows
 * the road about the line, both ways, and a pavement on one side leaves the
 * lanes where they lie; Hauptallee's line lies on its median. `axis` keeps
 * where that is, in blocks from the left edge, worked out from the parts
 * and never set apart from them.
 *
 * One cross-section holds for the whole road for now; changes along it (a
 * median widening, a turn lane) are for later.
 */

/** Which way a lane's traffic runs, beside the way the road was drawn. */
export type LaneDirection = 'with' | 'against' | 'both'
export type LineStyle = 'dashed' | 'solid'
export type StripSurface = 'grass' | 'paved'

export type LanePart =
  /** A lane: 3 blocks in most builds. */
  | { kind: 'lane'; width: number; dir: LaneDirection }
  /** A line between lanes: a block of white in most builds, or none wide where it's painted on. */
  | { kind: 'line'; width: number; style: LineStyle }
  /**
   * A strip of grass, or paved and raised: between the carriageways a
   * median, between the road and a pavement a verge (partLabel).
   */
  | { kind: 'strip'; width: number; surface: StripSurface }
  /** A pavement, along the edge. */
  | { kind: 'walk'; width: number }

export type LanePartKind = LanePart['kind']

export type RoadLanes = {
  /** Left to right, looking along the road the way it was drawn. */
  parts: LanePart[]
  /** Where the drawn line lies across them, in blocks from the left edge: the carriageway's middle, always (lanesAxis). */
  axis: number
}

/** How wide each kind of part may be, in blocks, and how wide it starts. */
export const PART_WIDTHS: Record<LanePartKind, { min: number; max: number; usual: number }> = {
  lane: { min: 1, max: 8, usual: 3 },
  line: { min: 0, max: 2, usual: 1 },
  strip: { min: 0.5, max: 32, usual: 2 },
  walk: { min: 1, max: 16, usual: 2 },
}

export const PART_LABELS: Record<LanePartKind, string> = {
  lane: 'Lane',
  line: 'Line',
  strip: 'Strip',
  walk: 'Pavement',
}

/** At most this many parts across a road. */
export const MAX_PARTS = 24

const DIRECTIONS: LaneDirection[] = ['with', 'against', 'both']
const LINE_STYLES: LineStyle[] = ['dashed', 'solid']
const SURFACES: StripSurface[] = ['grass', 'paved']

/** To the half block, as everything on the map is. */
const half = (value: number) => Math.round(value * 2) / 2

const clampWidth = (kind: LanePartKind, value: unknown): number => {
  const { min, max, usual } = PART_WIDTHS[kind]
  const width = typeof value === 'number' && Number.isFinite(value) ? half(value) : usual
  return Math.min(max, Math.max(min, width))
}

function parsePart(value: unknown): LanePart | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  switch (raw.kind) {
    case 'lane':
      return { kind: 'lane', width: clampWidth('lane', raw.width), dir: DIRECTIONS.includes(raw.dir as LaneDirection) ? (raw.dir as LaneDirection) : 'both' }
    case 'line':
      return { kind: 'line', width: clampWidth('line', raw.width), style: LINE_STYLES.includes(raw.style as LineStyle) ? (raw.style as LineStyle) : 'dashed' }
    case 'strip':
      return { kind: 'strip', width: clampWidth('strip', raw.width), surface: SURFACES.includes(raw.surface as StripSurface) ? (raw.surface as StripSurface) : 'grass' }
    case 'walk':
      return { kind: 'walk', width: clampWidth('walk', raw.width) }
    default:
      return null
  }
}

/** All the parts' widths together: the road's width in blocks, pavements included. */
export const lanesWidth = (lanes: Pick<RoadLanes, 'parts'>): number => lanes.parts.reduce((sum, part) => sum + part.width, 0)

/**
 * Where the drawn line lies across these parts, in blocks from the left
 * edge: the middle of the carriageway, from the first lane or line to the
 * last (a median between them counted, the verges and pavements outside
 * them not), so the road grows about the line both ways as a part of it
 * widens, and a pavement on one side doesn't push the lanes off it.
 */
export function lanesAxis(parts: LanePart[]): number {
  const onRoad = (p: LanePart) => p.kind === 'lane' || p.kind === 'line'
  const first = parts.findIndex(onRoad)
  if (first < 0) return lanesWidth({ parts }) / 2
  const last = parts.length - 1 - [...parts].reverse().findIndex(onRoad)
  const before = parts.slice(0, first).reduce((sum, p) => sum + p.width, 0)
  const across = parts.slice(first, last + 1).reduce((sum, p) => sum + p.width, 0)
  return before + across / 2
}

/** Parts with the drawn line down the middle of their carriageway (lanesAxis). */
const centred = (parts: LanePart[]): RoadLanes => ({ parts, axis: lanesAxis(parts) })

/**
 * A cross-section as kept: parts of the known kinds with their widths held
 * to what's built (half blocks, within PART_WIDTHS), and the drawn line
 * down the middle of their carriageway, whatever axis was sent (lanesAxis);
 * them. Nothing (null) where there's no lane among the parts: a road is
 * driven, walked or sailed along a lane.
 */
export function parseLanes(value: unknown): RoadLanes | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as { parts?: unknown }
  if (!Array.isArray(raw.parts)) return null
  const parts = raw.parts.slice(0, MAX_PARTS).map(parsePart).filter((part): part is LanePart => part != null)
  if (!parts.some((part) => part.kind === 'lane')) return null
  return centred(parts)
}

/** What's wrong with a cross-section as sent, for the form; null when it's fine. */
export function lanesProblem(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'object' || !Array.isArray((value as { parts?: unknown }).parts)) return 'Lanes are a list of parts across the road.'
  const parts = (value as { parts: unknown[] }).parts
  if (parts.length > MAX_PARTS) return `At most ${MAX_PARTS} parts across a road.`
  if (parts.some((part) => parsePart(part) == null)) return 'Each part is a lane, a line, a strip or a pavement.'
  if (!parts.some((part) => (part as { kind?: unknown }).kind === 'lane')) return 'A road with lanes has one lane at least.'
  return null
}

/** One part where it lies: from and to, signed blocks from the drawn line, right of it positive. */
export type PlacedPart = { part: LanePart; index: number; from: number; to: number; centre: number }

/**
 * The parts placed across the road beside the drawn line: negative to its
 * left, positive to its right, looking along it the way it was drawn.
 */
export function placedParts(lanes: RoadLanes): PlacedPart[] {
  let at = -lanes.axis
  return lanes.parts.map((part, index) => {
    const from = at
    at += part.width
    return { part, index, from, to: at, centre: (from + at) / 2 }
  })
}

/** How far the road reaches each side of the drawn line, in blocks: left (as a positive number) and right. */
export function reachOf(lanes: RoadLanes): { left: number; right: number } {
  const width = lanesWidth(lanes)
  return { left: lanes.axis, right: width - lanes.axis }
}

/**
 * The traffic side the lanes keep to, where they say: on the right when
 * every lane running with the road lies right of every lane running
 * against it, on the left when the other way round; null for a road all
 * one way or shared.
 */
export function drivingSide(lanes: RoadLanes): 'right' | 'left' | null {
  const placed = placedParts(lanes).filter((p): p is PlacedPart & { part: Extract<LanePart, { kind: 'lane' }> } => p.part.kind === 'lane')
  const withs = placed.filter((p) => p.part.dir === 'with').map((p) => p.centre)
  const againsts = placed.filter((p) => p.part.dir === 'against').map((p) => p.centre)
  if (!withs.length || !againsts.length) return null
  if (Math.min(...withs) > Math.max(...againsts)) return 'right'
  if (Math.max(...withs) < Math.min(...againsts)) return 'left'
  return null
}

/** Does a strip lie between lanes, a median, rather than between the road and its edge, a verge? */
export const isMedian = (lanes: RoadLanes, index: number): boolean =>
  lanes.parts.slice(0, index).some((p) => p.kind === 'lane') && lanes.parts.slice(index + 1).some((p) => p.kind === 'lane')

/** What a part is called where it lies: a strip between lanes is a median, at the side a verge. */
export function partLabel(lanes: RoadLanes, index: number): string {
  const part = lanes.parts[index]
  if (part?.kind !== 'strip') return part ? PART_LABELS[part.kind] : ''
  return isMedian(lanes, index) ? 'Median' : 'Verge'
}

/** Is it a divided road: two carriageways with a median between them? */
export const isDivided = (lanes: RoadLanes): boolean => lanes.parts.some((part, i) => part.kind === 'strip' && isMedian(lanes, i))

/** Is the road one-way: every lane running the same way, and that not shared? */
export function oneWay(lanes: RoadLanes): LaneDirection | null {
  const dirs = new Set(lanes.parts.flatMap((part) => (part.kind === 'lane' ? [part.dir] : [])))
  if (dirs.size !== 1) return null
  const [dir] = dirs
  return dir === 'both' ? null : dir
}

const flip = (dir: LaneDirection): LaneDirection => (dir === 'with' ? 'against' : dir === 'against' ? 'with' : 'both')

/** The lanes with traffic on the other side: every lane's direction turned about. */
export const otherSide = (lanes: RoadLanes): RoadLanes => ({
  ...lanes,
  parts: lanes.parts.map((part) => (part.kind === 'lane' ? { ...part, dir: flip(part.dir) } : part)),
})

/**
 * The lanes of the same road drawn the other way (as the editor turns a
 * road about to carry on from its start): the parts in the opposite order,
 * each lane's direction turned. The road's traffic is as it was.
 */
export const reversedLanes = (lanes: RoadLanes): RoadLanes =>
  centred([...lanes.parts].reverse().map((part) => (part.kind === 'lane' ? { ...part, dir: flip(part.dir) } : part)))

/** The kinds of road a cross-section's lanes are offered for: roads that are driven or walked, not railways or waterways. */
export const HAS_LANES = new Set(['highway', 'main', 'street', 'path'])

export type LanePresetId = 'shared' | 'two-way' | 'divided' | 'one-way'

export const LANE_PRESETS: { id: LanePresetId; label: string }[] = [
  { id: 'shared', label: 'One shared lane' },
  { id: 'two-way', label: 'A lane each way' },
  { id: 'divided', label: 'Two each way, divided' },
  { id: 'one-way', label: 'One-way' },
]

/**
 * A cross-section to start from, with traffic on `side`: a town's
 * three-wide street; a lane each way with a line between; two lanes each
 * way either side of a median (as Hauptallee); one lane, one way. The drawn
 * line lies at the middle, on the median where there is one.
 */
export function lanePreset(id: LanePresetId, side: 'right' | 'left' = 'right'): RoadLanes {
  // On the right, the lanes left of the line run against the road, those right of it with it.
  const left: LaneDirection = side === 'right' ? 'against' : 'with'
  const right: LaneDirection = side === 'right' ? 'with' : 'against'
  const lane = (dir: LaneDirection): LanePart => ({ kind: 'lane', width: 3, dir })
  const dashed: LanePart = { kind: 'line', width: 1, style: 'dashed' }
  const parts: LanePart[] =
    id === 'shared'
      ? [lane('both')]
      : id === 'two-way'
        ? [lane(left), dashed, lane(right)]
        : id === 'divided'
          ? [lane(left), dashed, lane(left), { kind: 'strip', width: 2, surface: 'grass' }, lane(right), dashed, lane(right)]
          : [lane('with')]
  return centred(parts)
}

/**
 * The lanes with a pavement of `width` blocks along each edge, or along
 * one, and a grass verge of `verge` blocks between it and the road where
 * the town builds one; the lanes stay about the drawn line.
 */
export function withPavements(lanes: RoadLanes, width: number, sides: 'both' | 'left' | 'right' = 'both', verge = 0): RoadLanes {
  const walk: LanePart = { kind: 'walk', width: clampWidth('walk', width) }
  const side: LanePart[] = verge > 0 ? [walk, { kind: 'strip', width: clampWidth('strip', verge), surface: 'grass' }] : [walk]
  const addLeft = sides !== 'right'
  const addRight = sides !== 'left'
  return centred([...(addLeft ? side : []), ...lanes.parts, ...(addRight ? [...side].reverse() : [])])
}

/** Two cross-sections alike: the same parts, as wide, the line where it lies. */
export const sameLanes = (a: RoadLanes, b: RoadLanes): boolean => JSON.stringify(a) === JSON.stringify(b)

/** A part of `kind` as it starts out, at its usual width. */
export function newPart(kind: LanePartKind): LanePart {
  const width = PART_WIDTHS[kind].usual
  switch (kind) {
    case 'lane':
      return { kind, width, dir: 'both' }
    case 'line':
      return { kind, width, style: 'dashed' }
    case 'strip':
      return { kind, width, surface: 'grass' }
    case 'walk':
      return { kind, width }
  }
}

/** The lanes with the part at `index` set `width` blocks wide (to the half block, within PART_WIDTHS), growing about the drawn line. */
export function withWidth(lanes: RoadLanes, index: number, width: number): RoadLanes {
  const part = lanes.parts[index]
  if (!part) return lanes
  const next = clampWidth(part.kind, width)
  return centred(lanes.parts.map((p, i) => (i === index ? { ...p, width: next } : p)))
}

/** The lanes with `part` put in at `index` (before the part there now; at the end for `parts.length`). */
export function withPartAt(lanes: RoadLanes, index: number, part: LanePart): RoadLanes {
  if (lanes.parts.length >= MAX_PARTS) return lanes
  const at = Math.max(0, Math.min(lanes.parts.length, index))
  return centred([...lanes.parts.slice(0, at), part, ...lanes.parts.slice(at)])
}

/** The lanes without the part at `index`; the last lane can't go (null). */
export function withoutPart(lanes: RoadLanes, index: number): RoadLanes | null {
  if (!lanes.parts[index]) return lanes
  const parts = lanes.parts.filter((_, i) => i !== index)
  if (!parts.some((p) => p.kind === 'lane')) return null
  return centred(parts)
}

/** The lanes with a part's own setting changed: a lane's direction, a line's style, a strip's surface. */
export function withPart(lanes: RoadLanes, index: number, change: Partial<LanePart>): RoadLanes {
  return { ...lanes, parts: lanes.parts.map((p, i) => (i === index ? (parsePart({ ...p, ...change }) ?? p) : p)) }
}

/** Which sides have a pavement: at the left edge, the right, both or neither, by the outermost parts. */
export function pavementSides(lanes: RoadLanes): { left: boolean; right: boolean } {
  const outer = (parts: LanePart[]) => parts.find((p) => p.kind !== 'strip')
  return { left: outer(lanes.parts)?.kind === 'walk', right: outer([...lanes.parts].reverse())?.kind === 'walk' }
}

/**
 * The cross-section in a few words, for the road's page: "2 + 2 lanes,
 * divided", "1 + 1 lanes", "One shared lane", "One-way, 2 lanes"; then the
 * pavements, where there are any.
 */
export function describeLanes(lanes: RoadLanes): string {
  const lanesOf = (dir: LaneDirection) => lanes.parts.filter((p) => p.kind === 'lane' && p.dir === dir).length
  const withs = lanesOf('with')
  const againsts = lanesOf('against')
  const boths = lanesOf('both')
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  let words: string
  if (oneWay(lanes)) words = `One-way, ${plural(withs + againsts, 'lane')}`
  else if (!withs && !againsts) words = boths === 1 ? 'One shared lane' : `${boths} shared lanes`
  else {
    const [a, b] = drivingSide(lanes) === 'left' ? [withs, againsts] : [againsts, withs]
    words = `${a} + ${b} lanes${boths ? `, ${plural(boths, 'shared lane')}` : ''}${isDivided(lanes) ? ', divided' : ''}`
  }
  const { left, right } = pavementSides(lanes)
  const pavements = left && right ? 'pavements both sides' : left ? 'pavement on the left' : right ? 'pavement on the right' : ''
  return pavements ? `${words} · ${pavements}` : words
}

/**
 * The cross-sections a town's roads have already, most used first, each
 * once with the roads that have it: what the editor offers first for a
 * road drawn in that town, so a town's way of building its streets (its
 * pavements, verges, lanes) is kept by example, not by a rule written
 * down somewhere. Roads drawn the other way count as the same.
 */
export function lanesInUse<R extends { lanes: RoadLanes | null; name?: string | null }>(roads: R[]): { lanes: RoadLanes; roads: R[] }[] {
  const found: { lanes: RoadLanes; roads: R[] }[] = []
  for (const road of roads) {
    if (!road.lanes) continue
    const same = found.find((entry) => sameLanes(entry.lanes, road.lanes!) || sameLanes(entry.lanes, reversedLanes(road.lanes!)))
    if (same) same.roads.push(road)
    else found.push({ lanes: road.lanes, roads: [road] })
  }
  return found.sort((a, b) => b.roads.length - a.roads.length)
}

/*
 * Geometry: the line a part runs along, beside the road's course.
 */

const EPSILON = 1e-9
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]]
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]]
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k]
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0]
const length = (a: Point) => Math.hypot(a[0], a[1])

/** Where lines a→b and c→d meet, as far along each as they must go; null when they run alongside. */
function meet(a: Point, b: Point, c: Point, d: Point): { point: Point; t: number; u: number } | null {
  const r = sub(b, a)
  const s = sub(d, c)
  const denominator = cross(r, s)
  if (Math.abs(denominator) < EPSILON) return null
  const t = cross(sub(c, a), s) / denominator
  const u = cross(sub(c, a), r) / denominator
  return { point: add(a, scale(r, t)), t, u }
}

/** A miter longer than this many times the offset is cut square (beveled). */
const MITER_LIMIT = 2.5

type Piece = { a: Point; b: Point; along: Point }

/**
 * Where two pieces of an offset line, one after the other, join: on the
 * inside of a bend where they cross, round its outside at their mitre, or
 * cut square where the mitre would reach too far (and where they run on
 * alongside, or straight back, from the one's end to the other's start).
 */
function joinOf(here: Piece, next: Piece, offset: number): Point[] {
  const found = meet(here.a, here.b, next.a, next.b)
  if (!found) return [here.b, next.a]
  // Turning toward the offset's side (right, with z south), the bend's inside.
  if (cross(here.along, next.along) * offset > 0) return [found.point]
  const corner = scale(add(here.b, next.a), 0.5)
  return length(sub(found.point, corner)) <= Math.abs(offset) * MITER_LIMIT ? [found.point] : [here.b, next.a]
}

/**
 * The line `offset` blocks beside a course (right of it positive, looking
 * along it): the course of a lane, a line or a strip's edge across a road.
 * Each piece is moved aside along its own normal, and the pieces joined
 * (joinOf). Where a bend is tighter than the offset (the inside of a
 * hairpin, for a wide road), a piece between two joins would run
 * backwards: it's dropped and its neighbours joined instead, until none
 * does, so the line cuts across the inside of the bend as a kerb would.
 * Loops it still ties in itself are cut out after (withoutLoops).
 */
export function offsetCourse(course: Point[], offset: number): Point[] {
  const points = course.filter((point, i) => i === 0 || length(sub(point, course[i - 1])) > EPSILON)
  if (points.length < 2 || Math.abs(offset) < EPSILON) return points.slice()
  let pieces: Piece[] = points.slice(1).map((b, i) => {
    const a = points[i]
    const along = scale(sub(b, a), 1 / length(sub(b, a)))
    const aside = scale([-along[1], along[0]], offset)
    return { a: add(a, aside), b: add(b, aside), along }
  })
  let joins: Point[][] = []
  for (let guard = 0; guard <= points.length; guard++) {
    joins = pieces.slice(0, -1).map((piece, i) => joinOf(piece, pieces[i + 1], offset))
    const backwards = pieces.findIndex((piece, i) => {
      const start = i === 0 ? piece.a : joins[i - 1][joins[i - 1].length - 1]
      const end = i === pieces.length - 1 ? piece.b : joins[i][0]
      const ahead = sub(end, start)
      return ahead[0] * piece.along[0] + ahead[1] * piece.along[1] < -EPSILON
    })
    if (backwards < 0 || pieces.length <= 1) break
    pieces = pieces.filter((_, i) => i !== backwards)
  }
  const out = [pieces[0].a, ...joins.flat(), pieces[pieces.length - 1].b].filter(
    (point, i, all) => i === 0 || length(sub(point, all[i - 1])) > EPSILON,
  )
  return withoutLoops(out, Math.abs(offset))
}

/**
 * A line with the small loops it ties in itself cut out: where a piece
 * crosses one a little further on (within about the loop an offset of
 * `reach` can tie), the line runs straight from the one to the other.
 */
function withoutLoops(line: Point[], reach: number): Point[] {
  const window = 8 * reach + 4
  let out = line.slice()
  for (let i = 0; i < out.length - 3; i++) {
    let walked = 0
    for (let j = i + 2; j < out.length - 1; j++) {
      walked += length(sub(out[j], out[j - 1]))
      if (walked > window) break
      const found = meet(out[i], out[i + 1], out[j], out[j + 1])
      if (found && found.t > EPSILON && found.t < 1 - EPSILON && found.u > EPSILON && found.u < 1 - EPSILON) {
        out = [...out.slice(0, i + 1), found.point, ...out.slice(j + 1)]
        break
      }
    }
  }
  return out
}

/** One part of a road's cross-section along its course: where it runs, in blocks. */
export type PartCourse = PlacedPart & {
  /** The line along its middle: a lane's arrows, a line's dashes, a strip's or a pavement's stroke. */
  middle: Point[]
}

/**
 * Every part of a road's cross-section laid along its course (the course
 * as src/maps/geo.ts → roadCourse gives it): what the map strokes, each
 * part as wide as it is, along the line through its middle.
 */
export function partCourses(course: Point[], lanes: RoadLanes): PartCourse[] {
  return placedParts(lanes).map((placed) => ({ ...placed, middle: offsetCourse(course, placed.centre) }))
}

/** The road's two edges along its course, left and right: where a casing would run. */
export function edgeCourses(course: Point[], lanes: RoadLanes): { left: Point[]; right: Point[] } {
  const { left, right } = reachOf(lanes)
  return { left: offsetCourse(course, -left), right: offsetCourse(course, right) }
}

/**
 * The carriageway: from the first lane to the last, lines and medians
 * between them included, verges and pavements outside them not. What the
 * map weighs against a road's class to decide when its true width shows.
 */
export function carriagewayWidth(lanes: RoadLanes): number {
  const first = lanes.parts.findIndex((p) => p.kind === 'lane')
  const last = lanes.parts.length - 1 - [...lanes.parts].reverse().findIndex((p) => p.kind === 'lane')
  return first < 0 ? 0 : lanes.parts.slice(first, last + 1).reduce((sum, p) => sum + p.width, 0)
}

/** One part of a road laid along its course as an area: the ring round it, in blocks, and the line along its middle. */
export type LaneArea = PlacedPart & {
  /** The ring round the part: its left edge forward, its right edge back; null for a part no blocks wide. */
  ring: Point[] | null
  /** The line along its middle: for a line's dashes, a lane's marks. */
  middle: Point[]
}

/** A road's cross-section laid along its course, ready to draw (laneAreas). */
export type RoadAreas = {
  parts: LaneArea[]
  /** The road's two edges, left and right, open at the ends: where the kerb lines run. */
  edges: { left: Point[]; right: Point[] }
  /** The ring round the whole road. */
  outline: Point[]
  /** The line down the middle of the road, kerb to kerb, which may lie off the drawn line. */
  middle: Point[]
  /** Each boundary between two parts, in order, as a line along the course: index i lies between parts i−1 and i. */
  boundaries: Point[][]
  width: number
  carriageway: number
}

/**
 * Every part of a road's cross-section laid along its course as an area to
 * fill: the line beside the course at each boundary between two parts is
 * worked out once (offsetCourse), and each part's ring is its left
 * boundary forward and its right boundary back, so parts side by side meet
 * exactly, round a bend as on the straight. What the map draws once the
 * road is close enough to show at its true width.
 */
export function laneAreas(course: Point[], lanes: RoadLanes): RoadAreas {
  const placed = placedParts(lanes)
  const width = lanesWidth(lanes)
  const boundaries = [-lanes.axis, ...placed.map((p) => p.to)].map((offset) => offsetCourse(course, offset))
  const parts = placed.map((p) => ({
    ...p,
    ring: p.part.width > 0 ? [...boundaries[p.index], ...boundaries[p.index + 1].slice().reverse()] : null,
    middle: p.part.kind === 'lane' || p.part.kind === 'line' ? offsetCourse(course, p.centre) : [],
  }))
  const left = boundaries[0]
  const right = boundaries[boundaries.length - 1]
  return {
    parts,
    edges: { left, right },
    outline: [...left, ...right.slice().reverse()],
    middle: offsetCourse(course, width / 2 - lanes.axis),
    boundaries,
    width,
    carriageway: carriagewayWidth(lanes),
  }
}

/** A mark along a lane: where it sits and which way the lane runs there, in radians on the plane (x east, z south). */
export type LaneMark = { at: Point; heading: number }

/**
 * Marks every `every` blocks along a line, from half that in, each with the
 * line's heading there: where a lane's direction is drawn. Turned about for
 * a lane running against the road.
 */
export function marksAlong(line: Point[], every: number, against = false): LaneMark[] {
  const marks: LaneMark[] = []
  let next = every / 2
  let walked = 0
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1]
    const [bx, bz] = line[i]
    const step = Math.hypot(bx - ax, bz - az)
    const heading = against ? Math.atan2(az - bz, ax - bx) : Math.atan2(bz - az, bx - ax)
    while (next <= walked + step && step > 0) {
      const t = (next - walked) / step
      marks.push({ at: [ax + (bx - ax) * t, az + (bz - az) * t], heading })
      next += every
    }
    walked += step
  }
  return marks
}
