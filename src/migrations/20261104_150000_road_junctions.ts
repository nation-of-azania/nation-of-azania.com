import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import { isPoint, type Point } from '../maps/geo'
import { crossingsOf, withJunctions, type JunctionRoad } from '../maps/junctions'
import { ROAD_KINDS, type RoadKind } from '../maps/registry'

/**
 * Content, not schema: the roads drawn before junctions (src/maps/
 * junctions.ts) meet where they cross, as a road drawn now would by
 * default: each crossing of two roads of one network becomes a node both
 * share. Each road takes its nodes through an ordinary save, and the Roads
 * hooks give the other road the same point (src/collections/maps/Roads.ts
 * → shareNodes). Crossings of different networks (a street over a canal)
 * stay bridges. On production that is Reiseweg and Löwenzahnweg.
 */

const lineOf = (value: unknown): Point[] => (Array.isArray(value) && value.every(isPoint) ? (value as Point[]) : [])
const kindOf = (value: unknown): RoadKind => (typeof value === 'string' && value in ROAD_KINDS ? (value as RoadKind) : 'street')

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const read = async (): Promise<JunctionRoad[]> => {
    const { docs } = await payload.find({ collection: 'roads', pagination: false, depth: 0, sort: 'id', req })
    return docs.map((road) => ({
      id: road.id,
      kind: kindOf(road.kind),
      line: lineOf(road.line),
      shape: road.shape === 'curved' ? 'curved' : 'straight',
      corners: Array.isArray(road.corners) ? (road.corners as unknown[]).filter((c): c is number => Number.isInteger(c)) : [],
    }))
  }
  let joined = 0
  for (const { id } of await read()) {
    // Read afresh each time: a road joined before may have given this one its nodes already.
    const roads = await read()
    const road = roads.find((candidate) => candidate.id === id)
    if (!road) continue
    const crossings = crossingsOf(road, roads).filter((crossing) => crossing.joins && !crossing.existing)
    if (!crossings.length) continue
    const next = withJunctions(road, crossings)
    await payload.update({ collection: 'roads', id: road.id, data: { line: next.line, corners: next.corners }, depth: 0, req })
    joined += crossings.length
    payload.logger.info(`[junctions] road ${road.id}: ${crossings.length} crossing(s) made junctions`)
  }
  payload.logger.info(`[junctions] ${joined ? `${joined} crossing(s) joined` : 'no crossings to join'}`)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Content: a junction comes apart by moving or removing its node in the editor.
}
