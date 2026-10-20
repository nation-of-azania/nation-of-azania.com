import { roadPoints } from '@/maps/data'
import type { Point } from '@/maps/geo'

import type { RoadDraft } from '../state'

/**
 * Changes to a road being drawn (RoadDraft), shared by the tools on the
 * map and the form in the panel. A curved road's sharp corners are kept by
 * index, so whatever adds or removes a point moves them along. Leaflet-free,
 * so the form can be rendered on the server.
 */

/**
 * The spots between a road's points where a new point can be pulled out:
 * halfway along the course, which on a curved road is on the bend, not on
 * the chord between the points. The course passes through the points
 * themselves (src/maps/geo.ts → roadCourse), so each pair is found in it.
 */
export function betweenPoints(draft: RoadDraft): Point[] {
  const { line } = draft
  if (draft.shape !== 'curved') {
    return line.slice(1).map(([x, z], i) => [(x + line[i][0]) / 2, (z + line[i][1]) / 2] as Point)
  }
  const course = roadPoints(draft)
  const at = line.map((point) => course.indexOf(point))
  return line.slice(1).map((_, i) => course[Math.floor((at[i] + at[i + 1]) / 2)])
}

/** The draft with a point put in at `index`: the corners after it move along. */
export function withPointAt(draft: RoadDraft, index: number, point: Point): RoadDraft {
  const line = [...draft.line]
  line.splice(index, 0, point)
  return { ...draft, line, corners: draft.corners.map((c) => (c >= index ? c + 1 : c)) }
}

/** The draft without the point at `index`: the corners after it move back, and the ends are never corners. */
export function withoutPointAt(draft: RoadDraft, index: number): RoadDraft {
  const line = draft.line.filter((_, i) => i !== index)
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
