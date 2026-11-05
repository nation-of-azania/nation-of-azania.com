import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import { isPoint, roadCourse, type Point } from '../maps/geo'
import { distanceAlong, OVER_USUAL, parseLanes, type LaneChange, type LanePart } from '../maps/lanes'

/**
 * Content, not schema: Hauptallee was drawn as two roads meeting end to end
 * where it crosses Bahnhofsstraße, the north one with a 2-block median and
 * the south one wider, with pavements; between them the median narrows. Now
 * that a road's lanes can change along it (src/maps/lanes.ts → changes),
 * the two become one road: the south one (id 4) keeps its id and takes the
 * north one's points in front of its own, starts with the north one's
 * lanes, and changes to the south one's about where they met (centred on
 * it, over the usual stretch, to be slid or lengthened in the editor). The
 * north one goes. Done only where two roads of that name meet end to end,
 * so nothing happens where that's no longer so.
 */

const NAME = 'Hauptallee'

type Road = { id: number; line: Point[]; shape: 'straight' | 'curved'; corners: number[]; lanes: unknown }

const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1]
const lineOf = (value: unknown): Point[] => (Array.isArray(value) && value.every(isPoint) ? (value as Point[]) : [])
const cornersOf = (value: unknown): number[] => (Array.isArray(value) ? value.filter((c): c is number => Number.isInteger(c)) : [])

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const { docs } = await payload.find({ collection: 'roads', where: { name: { equals: NAME } }, pagination: false, depth: 0, sort: 'id', req })
  const roads: Road[] = docs.map((doc) => ({
    id: doc.id,
    line: lineOf(doc.line),
    shape: doc.shape === 'curved' ? 'curved' : 'straight',
    corners: cornersOf(doc.corners),
    lanes: doc.lanes,
  }))
  // The pair meeting end to end: one's last point the other's first, both drawn the same way.
  const pairs = roads.flatMap((first) => roads.filter((second) => second.id !== first.id && first.line.length >= 2 && second.line.length >= 2 && same(first.line.at(-1)!, second.line[0])).map((second) => ({ first, second })))
  if (pairs.length !== 1) {
    payload.logger.info(`[hauptallee] ${pairs.length ? 'more than one way to join' : 'no two sections meeting end to end'}; nothing merged`)
    return
  }
  const { first, second } = pairs[0]
  // The road kept is the one whose page has been linked to: the older, south section.
  const kept = Math.min(first.id, second.id)
  const gone = kept === first.id ? second.id : first.id
  const line = [...first.line, ...second.line.slice(1)]
  const shift = first.line.length - 1
  const corners = [...first.corners, ...second.corners.map((c) => c + shift)]
  const shape = first.shape === 'curved' || second.shape === 'curved' ? 'curved' : 'straight'

  const firstLanes = parseLanes(first.lanes)
  const secondLanes = parseLanes(second.lanes)
  let lanes: { parts: LanePart[]; changes: LaneChange[] } | null = null
  if (firstLanes || secondLanes) {
    const start = firstLanes ?? secondLanes!
    const course = roadCourse(line, shape, corners)
    const joint = distanceAlong(course, first.line.at(-1)!)
    const changes: LaneChange[] = [...(firstLanes?.changes ?? [])]
    if (firstLanes && secondLanes) {
      changes.push({ at: Math.max(0, joint - OVER_USUAL / 2), over: OVER_USUAL, parts: secondLanes.parts })
      // The south section's own changes, measured from where it now begins along the road.
      for (const change of secondLanes.changes ?? []) changes.push({ ...change, at: change.at + joint })
    }
    lanes = { parts: start.parts, changes }
  }

  await payload.update({ collection: 'roads', id: kept, data: { line, corners, shape, lanes }, depth: 0, req })
  await payload.delete({ collection: 'roads', id: gone, req })
  payload.logger.info(`[hauptallee] roads ${first.id} and ${second.id} merged into ${kept}: ${line.length} points, lanes changing at ${lanes ? 'the join' : 'nowhere'}`)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Content: the road can be drawn as two again in the editor.
}
