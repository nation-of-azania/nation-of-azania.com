import type { CollectionConfig } from 'payload'

import { createMapFeature, editMapFeature } from '../../access/maps'
import { options, ROAD_KINDS } from '../../maps/registry'
import { authorshipFields, pathField, pathPoints, placeOnMap, townField } from './shared'

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
    beforeChange: [placeOnMap((doc) => pathPoints(doc.line))],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      maxLength: 80,
      admin: { description: 'Optional: plenty of paths have no name.' },
    },
    { name: 'kind', type: 'select', required: true, defaultValue: 'street', options: options(ROAD_KINDS) },
    pathField({ name: 'line', required: true, min: 2, description: 'The road’s course, [[x, z], …] in blocks.' }),
    townField,
    ...authorshipFields,
  ],
}
