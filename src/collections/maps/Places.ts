import type { CollectionConfig } from 'payload'

import { createMapFeature, editMapFeature } from '../../access/maps'
import { isPoint, type Point } from '../../maps/geo'
import { options, PLACE_CATEGORIES } from '../../maps/registry'
import { authorshipFields, pathField, pathPoints, placeOnMap, pointField, pointOf, townField } from './shared'

/**
 * Named places on Azania Maps: a pin with a category (café, town hall, port…)
 * and, for buildings, an optional outline. Drawn on /maps by the town's
 * mayors, cartographers and staff; anyone can look.
 */
export const Places: CollectionConfig = {
  slug: 'places',
  labels: { singular: 'Place', plural: 'Places' },
  admin: {
    useAsTitle: 'name',
    group: 'Azania Maps',
    defaultColumns: ['name', 'category', 'town', 'updatedAt'],
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
      placeOnMap((doc) => {
        const pin = pointOf(doc.point)
        const outline = Array.isArray(doc.outline) && doc.outline.every(isPoint) ? (doc.outline as Point[]) : []
        // The outline closes on itself; sample the closing edge too.
        return [...(pin ? [pin] : []), ...pathPoints(outline.length > 2 ? [...outline, outline[0]] : outline)]
      }),
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 80 },
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'landmark',
      options: options(PLACE_CATEGORIES),
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 600,
      admin: { description: 'A line or two: what it is, who runs it, when it’s open.' },
    },
    pointField({ name: 'point', label: 'Pin', required: true, height: true, description: 'Where the pin stands, in blocks.' }),
    pathField({
      name: 'outline',
      min: 3,
      description: 'Optional: the building’s footprint, [[x, z], …] in blocks.',
    }),
    townField,
    ...authorshipFields,
  ],
}
