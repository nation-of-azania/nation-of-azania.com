import { roadPoints, type MapRoad } from '@/maps/data'
import type { Point } from '@/maps/geo'
import { crossingKey, crossingsOf, overpassesOf, SNAP, snapToRoads, withJunctions, type Crossing } from '@/maps/junctions'

import type { RoadDraft } from '../state'
import { insertPoint, nearestOnPath, removePoint } from './points'

/**
 * Changes to a road being drawn (RoadDraft), shared by the tools on the
 * map and the form in the panel. A curved road's sharp corners are kept by
 * index, so whatever adds or removes a point moves them along. Leaflet-free,
 * so the form can be rendered on the server.
 */

/**
 * Where each of the line's points sits in the course (src/maps/geo.ts →
 * roadCourse): the course passes through the points themselves, in order,
 * so each is found by walking on from the last.
 */
function positionsInCourse(line: Point[], course: Point[]): number[] {
  let from = 0
  return line.map((point) => {
    for (let i = from; i < course.length; i++) {
      if (course[i] === point || (course[i][0] === point[0] && course[i][1] === point[1])) {
        from = i
        return i
      }
    }
    return from
  })
}

/**
 * The spots between a road's points where a new point can be pulled out:
 * halfway along the course, which on a curved road is on the bend, not on
 * the chord between the points.
 */
export function betweenPoints(draft: RoadDraft): Point[] {
  const { line } = draft
  if (draft.shape !== 'curved') {
    return line.slice(1).map(([x, z], i) => [(x + line[i][0]) / 2, (z + line[i][1]) / 2] as Point)
  }
  const course = roadPoints(draft)
  const at = positionsInCourse(line, course)
  return line.slice(1).map((_, i) => course[Math.floor((at[i] + at[i + 1]) / 2)])
}

/**
 * The spot on the road's course nearest a point (on the bend, for a curved
 * road), and the place in the line a new point there would take, so a
 * press anywhere on the drawn road adds a point exactly there.
 */
export function nearestOnRoad(
  draft: RoadDraft,
  at: Point,
): { point: Point; index: number; distance: number } | null {
  const course = roadPoints(draft)
  const found = nearestOnPath(course, at)
  if (!found) return null
  if (draft.shape !== 'curved') return { ...found, index: found.segment + 1 }
  // The new point goes after every point of the line that lies at or before the segment's start.
  const index = positionsInCourse(draft.line, course).filter((position) => position <= found.segment).length
  return { point: found.point, index, distance: found.distance }
}

/** The draft with a point put in at `index`: the corners after it move along. */
export function withPointAt(draft: RoadDraft, index: number, point: Point): RoadDraft {
  return {
    ...draft,
    line: insertPoint(draft.line, index, point),
    corners: draft.corners.map((c) => (c >= index ? c + 1 : c)),
  }
}

/** The draft without the point at `index`: the corners after it move back, and the ends are never corners. */
export function withoutPointAt(draft: RoadDraft, index: number): RoadDraft {
  const line = removePoint(draft.line, index)
  const corners = draft.corners
    .filter((c) => c !== index)
    .map((c) => (c > index ? c - 1 : c))
    .filter((c) => c >= 1 && c <= line.length - 2)
  return { ...draft, line, corners }
}

/** The draft with the point at `index` made a sharp corner, or a smooth bend again. */
export function withCornerToggled(draft: RoadDraft, index: number): RoadDraft {
  if (index < 1 || index > draft.line.length - 2) return draft
  const corners = draft.corners.includes(index)
    ? draft.corners.filter((c) => c !== index)
    : [...draft.corners, index].sort((a, b) => a - b)
  return { ...draft, corners }
}

/** The same road run the other way, so drawing can carry on from what was its start. */
export function reversed(draft: RoadDraft): RoadDraft {
  const last = draft.line.length - 1
  return {
    ...draft,
    line: [...draft.line].reverse(),
    corners: draft.corners.map((c) => last - c).sort((a, b) => a - b),
  }
}

/*
 * Where the drawn road meets the others (src/maps/junctions.ts). Each
 * crossing is shown on the map as a mark the drawer can toggle: a junction,
 * the two roads sharing a node there, or a bridge, one passing over the
 * other. The kept junctions go into the line on save (keptJunctions); the
 * server then gives the other road the same point.
 */

/** The roads a road being drawn may meet: every road but itself. */
export const otherRoads = (roads: MapRoad[], id: number | null): MapRoad[] =>
  id == null ? roads : roads.filter((road) => road.id !== id)

/** A road not saved yet is the newest of all: between equals, it passes over. */
const NEW_ROAD = Number.MAX_SAFE_INTEGER

/**
 * A point as the server will keep it (src/maps/junctions.ts → snapToRoads):
 * within a block of another road, set onto it, onto its node when one is
 * near. For the preview of a point placed or dragged, so what the drawer
 * sees is what gets saved.
 */
export const snappedPoint = (point: Point, id: number | null, others: MapRoad[]): Point =>
  snapToRoads({ id: id ?? NEW_ROAD, line: [point] }, others)[0]

/** A crossing with another road, as the map shows it while the road is drawn. */
export type Meeting = {
  crossing: Crossing
  key: string
  other: MapRoad
  /** A junction, by the drawer's choice or the default; else a bridge. */
  joined: boolean
  /**
   * Not the drawer's to toggle: the drawn road has a point there already,
   * so the two come apart only by moving or removing that point.
   */
  fixed: boolean
  /** At a bridge, whether the drawn road passes over the other; null where the courses don't cross (the other road ends here). */
  over: boolean | null
  /** The drawn road's heading at the crossing, in degrees on the page (x east, z south); into the road, where it ends there. */
  heading: number
  otherHeading: number
  /** The drawn road ends at the crossing, or the other road does: a T. */
  ends: boolean
  otherEnds: boolean
}

const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Which way a course runs where it passes `at`; where it begins or ends there, the way into it. */
function headingAt(course: Point[], at: Point): { heading: number; ends: boolean } {
  const found = nearestOnPath(course, at)
  if (!found) return { heading: 0, ends: false }
  const last = course.length - 1
  const atStart = distance(at, course[0]) <= SNAP
  const atEnd = distance(at, course[last]) <= SNAP
  const [a, b] = atStart ? [course[0], course[1]] : atEnd ? [course[last], course[last - 1]] : [course[found.segment], course[found.segment + 1]]
  return { heading: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI, ends: atStart || atEnd }
}

/**
 * The drawer's choice at a crossing, if they made one: by the crossing's
 * own key, else by the other road alone, where the drawn road meets it
 * once (so a choice outlives a point dragged, which moves the crossing).
 */
const choiceFor = (choices: Record<string, boolean>, crossing: Crossing, once: boolean): boolean | undefined =>
  choices[crossingKey(crossing)] ?? (once ? choices[String(crossing.road)] : undefined)

/** The choices with one crossing toggled: under its own key, and under the road's where that is the one crossing with it. */
export function withChoice(choices: Record<string, boolean>, meeting: Meeting, meetings: Meeting[], joined: boolean): Record<string, boolean> {
  const next = { ...choices, [meeting.key]: joined }
  if (meetings.filter((m) => m.other.id === meeting.other.id).length === 1) next[String(meeting.other.id)] = joined
  return next
}

/** Every crossing of the drawn road with the others, in order along it, each with what the map shows of it. */
export function meetingsOf(draft: RoadDraft, id: number | null, others: MapRoad[], choices: Record<string, boolean>): Meeting[] {
  const drawnId = id ?? NEW_ROAD
  const crossings = crossingsOf({ ...draft, id: drawnId }, others)
  const course = roadPoints(draft)
  const bridges = new Map<MapRoad, ReturnType<typeof overpassesOf>>()
  return crossings.flatMap((crossing) => {
    const other = others.find((road) => road.id === crossing.road)
    if (!other) return []
    const fixed = crossing.existing || crossing.shared
    const once = crossings.filter((c) => c.road === crossing.road).length === 1
    const joined = fixed || (choiceFor(choices, crossing, once) ?? crossing.joins)
    let over: boolean | null = null
    if (!joined) {
      // Which passes over, as the map will draw it: worked out once per other road.
      const found = bridges.get(other) ?? overpassesOf([other, { ...draft, id: drawnId }])
      bridges.set(other, found)
      const bridge = found.find((b) => distance(b.at, crossing.at) <= SNAP)
      over = bridge ? bridge.over === drawnId : null
    }
    const mine = headingAt(course, crossing.at)
    const theirs = headingAt(roadPoints(other), crossing.at)
    return [
      {
        crossing,
        key: crossingKey(crossing),
        other,
        joined,
        fixed,
        over,
        heading: mine.heading,
        otherHeading: theirs.heading,
        ends: mine.ends,
        otherEnds: theirs.ends,
      },
    ]
  })
}

/** The draft with a point at each junction kept, as it is saved (src/maps/junctions.ts → withJunctions). */
export const withKeptJunctions = (draft: RoadDraft, meetings: Meeting[]): RoadDraft =>
  withJunctions(
    draft,
    meetings.filter((m) => m.joined).map((m) => m.crossing),
  )
