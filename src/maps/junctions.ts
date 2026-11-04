import { roadCourse, roundPoint, type Point, type RoadShape } from './geo'
import type { RoadKind } from './registry'

/**
 * Where roads meet on Azania Maps. A junction is a **shared node**: a point
 * that two roads (or more) both have among their own points, at the same
 * spot to the half block. Nothing else marks it, so the roads stay plain
 * lines of points, and whatever later wants the network (a route planner,
 * say) finds it by the points the roads share.
 *
 * Drawing a road, its crossings with the roads already there are offered
 * as junctions (crossingsOf): by default where the two are of one network
 * (roads with roads, a railway with railways, waterways with waterways),
 * and the drawer may turn any of them off, for an underpass or a bridge.
 * Those kept become points of the new road (withJunctions); on saving, the
 * server gives the other road the same point (sharedInto), so the node is
 * both roads'. A point of a road dragged elsewhere takes the other roads'
 * point with it (followMoves), where the drawer may change them.
 *
 * Two roads whose courses cross without a shared node pass one over the
 * other (overpassesOf), the one of the higher class on top. Curved roads
 * cross along their curves (src/maps/geo.ts → roadCourse); a node put into
 * a curve becomes a point it bends through, so it moves the bend a touch.
 *
 * Pure, in blocks, for the editor, the server and the map alike.
 */

export type JunctionRoad = {
  id: number | string
  kind: RoadKind
  line: Point[]
  shape: RoadShape
  corners: number[]
}

/** A road being drawn: not saved yet, or being changed. */
export type DrawnRoad = Omit<JunctionRoad, 'id'> & { id?: number | string | null }

/** The networks a road's kind belongs to: its crossings within one are junctions by default. */
export const NETWORKS: Record<RoadKind, 'road' | 'rail' | 'water'> = {
  highway: 'road',
  main: 'road',
  street: 'road',
  path: 'road',
  rail: 'rail',
  iceroad: 'water',
  canal: 'water',
}

export const joinsByDefault = (a: RoadKind, b: RoadKind): boolean => NETWORKS[a] === NETWORKS[b]

/**
 * Which passes over which where two roads cross without meeting: the higher
 * here (a national road over a street, a railway over a path, anything over
 * a waterway); between equals, the one drawn later.
 */
const LAYER: Record<RoadKind, number> = { canal: 0, iceroad: 0, path: 1, street: 2, main: 3, rail: 4, highway: 5 }

/** Within this many blocks of a road's course, a point is on the road. */
export const ON_ROAD = 1

/** A crossing within this many blocks of an existing point of a road becomes that point, rather than one beside it. */
export const SNAP = 3

const EPSILON = 1e-9

const samePoint = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1]
const pointKey = ([x, z]: Point): string => `${x},${z}`
const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** A road's course (its curves drawn out) and where each of its own points sits in it. */
type Traced = { course: Point[]; at: number[]; box: { minX: number; maxX: number; minZ: number; maxZ: number } }

function trace(road: Pick<JunctionRoad, 'line' | 'shape' | 'corners'>): Traced {
  const course = roadCourse(road.line, road.shape, road.corners)
  // The course passes through the road's own points, in order.
  let from = 0
  const at = road.line.map((point) => {
    for (let i = from; i < course.length; i++)
      if (samePoint(course[i], point)) {
        from = i
        return i
      }
    return from
  })
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, z] of course) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  return { course, at, box: { minX, maxX, minZ, maxZ } }
}

const near = (a: Traced['box'], b: Traced['box'], margin: number): boolean =>
  a.minX - margin <= b.maxX && b.minX - margin <= a.maxX && a.minZ - margin <= b.maxZ && b.minZ - margin <= a.maxZ

/** The spot on a course nearest a point: where, along which segment (and how far along it, 0 to 1), and how far away. */
function nearestOnCourse(course: Point[], p: Point): { point: Point; segment: number; t: number; distance: number } | null {
  let best: { point: Point; segment: number; t: number; distance: number } | null = null
  for (let i = 0; i < course.length - 1; i++) {
    const [ax, az] = course[i]
    const [bx, bz] = course[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const length2 = dx * dx + dz * dz
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / length2))
    const point: Point = [ax + dx * t, az + dz * t]
    const d = distance(point, p)
    if (!best || d < best.distance) best = { point, segment: i, t, distance: d }
  }
  return best
}

/** Where two segments cross: the spot and how far along each (0 to 1); null when they don't, or run side by side. */
function crossing(p1: Point, p2: Point, q1: Point, q2: Point): { point: Point; t: number; u: number } | null {
  const rx = p2[0] - p1[0]
  const rz = p2[1] - p1[1]
  const sx = q2[0] - q1[0]
  const sz = q2[1] - q1[1]
  const denominator = rx * sz - rz * sx
  if (Math.abs(denominator) < EPSILON) return null
  const qpx = q1[0] - p1[0]
  const qpz = q1[1] - p1[1]
  const t = (qpx * sz - qpz * sx) / denominator
  const u = (qpx * rz - qpz * rx) / denominator
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return null
  return { point: [p1[0] + rx * t, p1[1] + rz * t], t, u }
}

/** Where a new point taken from the course's segment `segment` goes in the road's line: after every point at or before the segment's start. */
const indexFor = (traced: Traced, segment: number): number => traced.at.filter((position) => position <= segment).length

/** A spot where a road being drawn meets another. */
export type Crossing = {
  /** The spot, to the half block: the other road's point, or the drawn road's, when one is within SNAP. */
  at: Point
  /** The other road. */
  road: JunctionRoad['id']
  kind: RoadKind
  /** How far along the drawn road (its course position), to order the crossings. */
  along: number
  /** The drawn road's point here, or where in its line one would go. */
  index: number
  /** The drawn road has a point here already. */
  existing: boolean
  /** Both roads have it: a junction already. */
  shared: boolean
  /** Offered as a junction unless turned off: within one network, or already a point of the drawn road. */
  joins: boolean
}

/** A crossing's name, to keep the drawer's choice for it while the road is drawn on. */
export const crossingKey = (c: Pick<Crossing, 'road' | 'at'>): string => `${c.road}@${pointKey(c.at)}`

/**
 * Every spot where a road being drawn meets the others: where their courses
 * cross, where one of its points lies on another road (its end on a street,
 * a T), and where another road's point lies on it. Spots within SNAP of each
 * other along one road are one crossing, at an existing point where there
 * is one near (the other road's first), so a junction joins the nodes
 * already there rather than adding one beside them. In order along the road.
 */
export function crossingsOf(drawn: DrawnRoad, others: JunctionRoad[]): Crossing[] {
  if (drawn.line.length < 2) return []
  const a = trace(drawn)
  const found: Crossing[] = []
  for (const other of others) {
    if (other.id === drawn.id || other.line.length < 2) continue
    const b = trace(other)
    if (!near(a.box, b.box, SNAP)) continue
    // Every spot where the two meet, by how far along the drawn road.
    const spots: { point: Point; along: number; segment: number }[] = []
    for (let i = 0; i < a.course.length - 1; i++)
      for (let j = 0; j < b.course.length - 1; j++) {
        const hit = crossing(a.course[i], a.course[i + 1], b.course[j], b.course[j + 1])
        if (hit) spots.push({ point: hit.point, along: i + hit.t, segment: i })
      }
    drawn.line.forEach((point, k) => {
      const onOther = nearestOnCourse(b.course, point)
      if (onOther && onOther.distance <= ON_ROAD) spots.push({ point, along: a.at[k], segment: Math.max(0, a.at[k] - 1) })
    })
    for (const point of other.line) {
      const onDrawn = nearestOnCourse(a.course, point)
      if (onDrawn && onDrawn.distance <= ON_ROAD) spots.push({ point: onDrawn.point, along: onDrawn.segment + onDrawn.t, segment: onDrawn.segment })
    }
    spots.sort((x, y) => x.along - y.along)
    // Spots close together are one meeting.
    const groups: (typeof spots)[] = []
    for (const spot of spots) {
      const last = groups.at(-1)
      if (last && distance(last[0].point, spot.point) <= SNAP) last.push(spot)
      else groups.push([spot])
    }
    for (const group of groups) {
      const middle = group[Math.floor(group.length / 2)]
      // The other road's point near, else the drawn road's, else the spot itself to the half block.
      const theirs = other.line.find((point) => group.some((spot) => distance(point, spot.point) <= SNAP))
      const ours = drawn.line.findIndex((point) => group.some((spot) => distance(point, spot.point) <= SNAP))
      const at = theirs ?? (ours >= 0 ? drawn.line[ours] : roundPoint(middle.point))
      const mine = drawn.line.findIndex((point) => samePoint(point, at))
      const existing = mine >= 0
      const shared = existing && other.line.some((point) => samePoint(point, at))
      const placed = nearestOnCourse(a.course, at)
      found.push({
        at,
        road: other.id,
        kind: other.kind,
        along: existing ? a.at[mine] : (placed ? placed.segment + placed.t : middle.along),
        index: existing ? mine : indexFor(a, placed ? placed.segment : middle.segment),
        existing,
        shared,
        joins: shared || existing || joinsByDefault(drawn.kind, other.kind),
      })
    }
  }
  return found.sort((x, y) => x.along - y.along)
}

/**
 * The drawn road with a point at each of the given crossings it hasn't one
 * at yet (the junctions kept), in order along it; a curved road's sharp
 * corners move along with the points after them.
 */
export function withJunctions<R extends Pick<DrawnRoad, 'line' | 'corners'>>(drawn: R, crossings: Crossing[]): R {
  let line = [...drawn.line]
  let corners = [...drawn.corners]
  const added = crossings
    .filter((c) => !c.existing)
    // The last first, so each index still points where it did; at one index, the farther along first.
    .sort((x, y) => y.index - x.index || y.along - x.along)
  const seen = new Set<string>()
  for (const c of added) {
    const key = pointKey(c.at)
    if (seen.has(key) || line.some((point) => samePoint(point, c.at))) continue
    seen.add(key)
    line = [...line.slice(0, c.index), c.at, ...line.slice(c.index)]
    corners = corners.map((corner) => (corner >= c.index ? corner + 1 : corner))
  }
  return { ...drawn, line, corners }
}

/**
 * A road's points as the server keeps them: each that lies on another road
 * (within ON_ROAD of its course) is set on it exactly, on that road's point
 * when one is within SNAP, else on its course to the half block. So a
 * street drawn to end on another meets it, and the node is one spot.
 */
export function snapToRoads(road: Pick<DrawnRoad, 'id' | 'line'>, others: JunctionRoad[]): Point[] {
  const traced = others.filter((other) => other.id !== road.id && other.line.length >= 2).map((other) => ({ other, ...trace(other) }))
  return road.line.map((point) => {
    let best: { to: Point; distance: number } | null = null
    for (const { other, course } of traced) {
      if (other.line.some((p) => samePoint(p, point))) return point
      const on = nearestOnCourse(course, point)
      if (!on || on.distance > ON_ROAD) continue
      const node = other.line.find((p) => distance(p, point) <= SNAP)
      const to = node ?? roundPoint(on.point)
      const d = distance(to, point)
      if (!best || d < best.distance) best = { to, distance: d }
    }
    return best ? best.to : point
  })
}

/** Another road given a point: its new line and corners. */
export type Shared = { id: JunctionRoad['id']; line: Point[]; corners: number[] }

/**
 * The other roads that must take a point of this one to share the node:
 * each of its points that lies on another road's course (within ON_ROAD)
 * where that road has no point, put into it in its place along the course.
 */
export function sharedInto(road: Pick<JunctionRoad, 'id' | 'line'>, others: JunctionRoad[]): Shared[] {
  const changed: Shared[] = []
  for (const other of others) {
    if (other.id === road.id || other.line.length < 2) continue
    const b = trace(other)
    const points = road.line.filter((point) => {
      if (other.line.some((p) => samePoint(p, point))) return false
      const on = nearestOnCourse(b.course, point)
      return on != null && on.distance <= ON_ROAD
    })
    if (!points.length) continue
    const crossings: Crossing[] = points.map((point) => {
      const on = nearestOnCourse(b.course, point)!
      return { at: point, road: road.id, kind: other.kind, along: on.segment + on.t, index: indexFor(b, on.segment), existing: false, shared: false, joins: true }
    })
    const next = withJunctions({ line: other.line, corners: other.corners }, crossings)
    changed.push({ id: other.id, line: next.line, corners: next.corners })
  }
  return changed
}

/**
 * A road's points dragged elsewhere take the nodes they shared with them:
 * every other road with a point where one of this road's was moves it to
 * where that one went, if `mayChange` allows it (else the node comes
 * apart, and the other road keeps its point). Only for a road whose points
 * were moved, not added or taken away: then which went where is plain.
 */
export function followMoves(
  before: Point[],
  after: Point[],
  others: JunctionRoad[],
  mayChange: (road: JunctionRoad) => boolean = () => true,
): { id: JunctionRoad['id']; line: Point[] }[] {
  if (before.length !== after.length) return []
  const moves = new Map<string, Point>()
  before.forEach((point, i) => {
    if (!samePoint(point, after[i])) moves.set(pointKey(point), after[i])
  })
  if (!moves.size) return []
  const changed: { id: JunctionRoad['id']; line: Point[] }[] = []
  for (const other of others) {
    if (!other.line.some((point) => moves.has(pointKey(point))) || !mayChange(other)) continue
    changed.push({ id: other.id, line: other.line.map((point) => moves.get(pointKey(point)) ?? point) })
  }
  return changed
}

/** The nodes two roads or more share: the junctions to draw. */
export function junctionsOf(roads: Pick<JunctionRoad, 'id' | 'line'>[]): { at: Point; roads: JunctionRoad['id'][] }[] {
  const byPoint = new Map<string, { at: Point; roads: JunctionRoad['id'][] }>()
  for (const road of roads)
    for (const point of road.line) {
      const key = pointKey(point)
      const entry = byPoint.get(key) ?? { at: point, roads: [] }
      if (!entry.roads.includes(road.id)) entry.roads.push(road.id)
      byPoint.set(key, entry)
    }
  return [...byPoint.values()].filter((entry) => entry.roads.length >= 2)
}

/**
 * Where two roads' courses cross without a node they share: one passes
 * over the other, the higher class on top, between equals the later drawn
 * (the larger id). A crossing within SNAP of a node the two share is that
 * junction, not a bridge.
 */
export function overpassesOf(roads: JunctionRoad[]): { at: Point; over: JunctionRoad['id']; under: JunctionRoad['id'] }[] {
  const traced = roads.filter((road) => road.line.length >= 2).map((road) => ({ road, ...trace(road) }))
  const found: { at: Point; over: JunctionRoad['id']; under: JunctionRoad['id'] }[] = []
  for (let m = 0; m < traced.length; m++)
    for (let n = m + 1; n < traced.length; n++) {
      const a = traced[m]
      const b = traced[n]
      if (!near(a.box, b.box, 0)) continue
      const nodes = a.road.line.filter((point) => b.road.line.some((p) => samePoint(p, point)))
      const spots: Point[] = []
      for (let i = 0; i < a.course.length - 1; i++)
        for (let j = 0; j < b.course.length - 1; j++) {
          const hit = crossing(a.course[i], a.course[i + 1], b.course[j], b.course[j + 1])
          if (!hit) continue
          if (nodes.some((node) => distance(node, hit.point) <= SNAP)) continue
          if (spots.some((spot) => distance(spot, hit.point) <= SNAP)) continue
          spots.push(hit.point)
        }
      if (!spots.length) continue
      const aOver =
        LAYER[a.road.kind] !== LAYER[b.road.kind]
          ? LAYER[a.road.kind] > LAYER[b.road.kind]
          : String(a.road.id).localeCompare(String(b.road.id), undefined, { numeric: true }) > 0
      for (const at of spots) found.push({ at, over: aOver ? a.road.id : b.road.id, under: aOver ? b.road.id : a.road.id })
    }
  return found
}
