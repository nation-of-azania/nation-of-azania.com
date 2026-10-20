import { roadPoints } from '@/maps/data'
import type { Point } from '@/maps/geo'

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
