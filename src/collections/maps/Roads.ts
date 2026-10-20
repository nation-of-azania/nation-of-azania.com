import type { CollectionConfig } from 'payload'

import { createMapFeature, editMapFeature } from '../../access/maps'
import { isPoint, roadCourse, samplePath, type Point } from '../../maps/geo'
import { options, ROAD_KINDS, ROAD_SHAPES } from '../../maps/registry'
import { authorshipFields, pathField, placeOnMap, townField } from './shared'

/** A curved road's sharp corners: indices of its inner points. */
const cornersOf = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((index): index is number => Number.isInteger(index)) : []

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
      // Judged along the course as drawn, curves included, so a bend can't leave the claims.
      placeOnMap((doc) => {
        const line = Array.isArray(doc.line) && doc.line.every(isPoint) ? (doc.line as Point[]) : []
        return samplePath(roadCourse(line, doc.shape === 'curved' ? 'curved' : 'straight', cornersOf(doc.corners)))
      }),
    ],
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
    townField,
    ...authorshipFields,
  ],
}
