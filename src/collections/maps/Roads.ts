import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig, PayloadRequest } from 'payload'

import { createMapFeature, editMapFeature, getMapRights } from '../../access/maps'
import { isPoint, roadCourse, samplePath, type Point } from '../../maps/geo'
import { followMoves, sharedInto, snapToRoads, type JunctionRoad } from '../../maps/junctions'
import { HAS_LANES, lanesProblem, parseLanes } from '../../maps/lanes'
import { options, ROAD_KINDS, ROAD_SHAPES, type RoadKind } from '../../maps/registry'
import { authorshipFields, JUNCTIONS, pathField, placeOnMap, townField } from './shared'

/** A curved road's sharp corners: indices of its inner points. */
const cornersOf = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((index): index is number => Number.isInteger(index)) : []

const lineOf = (value: unknown): Point[] => (Array.isArray(value) && value.every(isPoint) ? (value as Point[]) : [])
const idOf = (value: unknown): number | null =>
  typeof value === 'number' ? value : typeof (value as { id?: unknown } | null)?.id === 'number' ? (value as { id: number }).id : null
const kindOf = (value: unknown): RoadKind => (typeof value === 'string' && value in ROAD_KINDS ? (value as RoadKind) : 'street')

type Other = JunctionRoad & { town: number | null }

/** Every road but one, as junctions are worked out from (src/maps/junctions.ts), with its town. */
async function otherRoads(req: PayloadRequest, except: unknown): Promise<Other[]> {
  const { docs } = await req.payload.find({
    collection: 'roads',
    pagination: false,
    depth: 0,
    select: { kind: true, line: true, shape: true, corners: true, town: true },
    req,
  })
  return docs
    .filter((road) => road.id !== except)
    .map((road) => ({
      id: road.id,
      kind: kindOf(road.kind),
      line: lineOf(road.line),
      shape: road.shape === 'curved' ? 'curved' : 'straight',
      corners: cornersOf(road.corners),
      town: idOf(road.town),
    }))
}

/**
 * A point drawn on another road (within a block of it) is set on it
 * exactly, on its node when one is near: so a street drawn to end on
 * another meets it at one spot (src/maps/junctions.ts → snapToRoads).
 */
const snapPoints: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (req.context[JUNCTIONS] || !Array.isArray(data.line)) return data
  const line = lineOf(data.line)
  if (line.length < 2) return data
  data.line = snapToRoads({ id: originalDoc?.id, line }, await otherRoads(req, originalDoc?.id))
  return data
}

/**
 * Junctions are nodes both roads share. Once a road is saved, every other
 * road its points lie on takes those points too, and the other roads'
 * points where it had one that was dragged follow it, where the drawer may
 * change those roads (a mayor's street dragged off a national road comes
 * apart from it instead). The other roads are saved flagged (JUNCTIONS), so
 * nothing about them is checked or stamped as the drawer's own, and their
 * own saves share nothing further.
 */
const shareNodes: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (req.context[JUNCTIONS]) return doc
  const line = lineOf(doc.line)
  if (line.length < 2) return doc
  const others = await otherRoads(req, doc.id)
  const rights = getMapRights(req.user)
  const mayChange = (road: JunctionRoad) => {
    const town = (road as Other).town
    return !req.user || rights.anywhere || (town != null && rights.towns.includes(town))
  }
  const changed = new Map<Other['id'], { line: Point[]; corners?: number[] }>()
  if (operation === 'update') {
    for (const moved of followMoves(lineOf(previousDoc?.line), line, others, mayChange)) {
      changed.set(moved.id, { line: moved.line })
      const other = others.find((road) => road.id === moved.id)
      if (other) other.line = moved.line
    }
  }
  for (const shared of sharedInto({ id: doc.id, line }, others)) changed.set(shared.id, { line: shared.line, corners: shared.corners })
  if (!changed.size) return doc
  const before = req.context[JUNCTIONS]
  try {
    for (const [id, data] of changed) {
      await req.payload.update({ collection: 'roads', id: Number(id), data, depth: 0, req, overrideAccess: true, context: { [JUNCTIONS]: true } })
    }
  } finally {
    req.context[JUNCTIONS] = before
  }
  return doc
}

/**
 * Roads, railways and waterways on Azania Maps: a line with a name and a
 * class. A road inside one town belongs to it and its mayors; one that runs
 * between towns is national, for cartographers and staff.
 */
export const Roads: CollectionConfig = {
  slug: 'roads',
  labels: { singular: 'Road', plural: 'Roads' },
  admin: {
    useAsTitle: 'name',
    group: 'Azania Maps',
    defaultColumns: ['name', 'kind', 'town', 'updatedAt'],
    description: 'Drawn on Azania Maps (/maps) by mayors and cartographers.',
  },
  access: {
    read: () => true,
    create: createMapFeature,
    update: editMapFeature,
    delete: editMapFeature,
  },
  versions: { maxPerDoc: 25 },
  hooks: {
    beforeChange: [
      snapPoints,
      // Judged along the course as drawn, curves included, so a bend can't leave the claims.
      placeOnMap((doc) => {
        const line = Array.isArray(doc.line) && doc.line.every(isPoint) ? (doc.line as Point[]) : []
        return samplePath(roadCourse(line, doc.shape === 'curved' ? 'curved' : 'straight', cornersOf(doc.corners)))
      }),
    ],
    afterChange: [shareNodes],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      maxLength: 80,
      admin: { description: 'Optional: plenty of paths have no name.' },
    },
    { name: 'kind', type: 'select', required: true, defaultValue: 'street', options: options(ROAD_KINDS) },
    pathField({ name: 'line', required: true, min: 2, description: 'The road’s points, [[x, z], …] in blocks.' }),
    {
      name: 'shape',
      type: 'select',
      required: true,
      defaultValue: 'straight',
      options: options(ROAD_SHAPES),
      admin: { description: 'Curved roads bend smoothly through their points, one bend flowing into the next.' },
    },
    {
      name: 'corners',
      type: 'json',
      admin: {
        condition: (data) => data?.shape === 'curved',
        description: 'In a curved road, the points that stay sharp turns (as at a junction), by position: [2, 5].',
      },
      validate: (value: unknown, { siblingData }: { siblingData: { line?: unknown } }) => {
        if (value == null) return true
        const inner = Array.isArray(siblingData?.line) ? siblingData.line.length - 2 : 0
        return (
          (Array.isArray(value) &&
            value.every((index) => Number.isInteger(index) && index >= 1 && index <= inner) &&
            new Set(value).size === value.length) ||
          'Positions of the road’s inner points, each once.'
        )
      },
    },
    {
      name: 'lanes',
      type: 'json',
      admin: {
        condition: (data) => !data?.kind || HAS_LANES.has(data.kind),
        description:
          'Optional: the road’s cross-section as built, left to right looking along it the way it was drawn: lanes (width, dir with/against/both), lines (dashed/solid), strips (grass/paved: a median between lanes, a verge beside them) and pavements, in blocks; the drawn line always runs down the middle of the lanes. Changes along the road (changes: at and over, in blocks along it, to other parts) narrow or widen it. Set in the road editor on Azania Maps (src/maps/lanes.ts).',
      },
      validate: (value: unknown) => lanesProblem(value) ?? true,
      hooks: {
        // Kept as built (half blocks, known parts), and nothing for a railway or a waterway.
        beforeChange: [
          ({ value, siblingData, originalDoc }) => {
            // Not sent (a node shared into the road, say): left as it is.
            if (value === undefined) return value
            const kind = String(siblingData?.kind ?? originalDoc?.kind ?? 'street')
            return HAS_LANES.has(kind) ? parseLanes(value) : null
          },
        ],
      },
    },
    townField,
    ...authorshipFields,
  ],
}
