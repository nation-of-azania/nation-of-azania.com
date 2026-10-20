import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { createMapFeature, editMapFeature } from '../../access/maps'
import { authorshipFields, placeOnMap, pointField, pointOf, townField } from './shared'

/** An event held at a place stands where the place does. */
const standAtPlace: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const placeValue = data.place !== undefined ? data.place : originalDoc?.place
  const placeId = typeof placeValue === 'object' && placeValue ? placeValue.id : placeValue
  if (placeId == null) {
    if (pointOf(data.point !== undefined ? data.point : originalDoc?.point)) return data
    throw new APIError('Choose a place, or give a point.', 400, null, true)
  }
  const place = await req.payload.findByID({ collection: 'places', id: placeId, depth: 0, req }).catch(() => null)
  if (!place) throw new APIError('That place is no longer on the map.', 400, null, true)
  data.point = { x: place.point.x, z: place.point.z }
  return data
}

/**
 * Happenings on Azania Maps: a festival, a market day, an opening, an
 * election count. Each stands at a place or at a point, with a start and an
 * optional end, and can link the article announcing it.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  labels: { singular: 'Event', plural: 'Events' },
  admin: {
    useAsTitle: 'title',
    group: 'Azania Maps',
    defaultColumns: ['title', 'startsAt', 'town', 'updatedAt'],
    description: 'Shown on Azania Maps (/maps) while upcoming, and kept afterwards.',
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
      standAtPlace,
      placeOnMap((doc) => {
        const point = pointOf(doc.point)
        return point ? [point] : []
      }),
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 100 },
    { name: 'description', type: 'textarea', maxLength: 1000 },
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          required: true,
          index: true,
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'endsAt',
          type: 'date',
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' }, description: 'Optional.' },
          validate: (value: Date | null | string | undefined, { siblingData }: { siblingData: { startsAt?: string | null } }) =>
            !value || !siblingData?.startsAt || new Date(value) >= new Date(siblingData.startsAt) || 'Ends after it starts.',
        },
      ],
    },
    {
      name: 'place',
      type: 'relationship',
      relationTo: 'places',
      admin: { description: 'Where it’s held, if that’s a place on the map. Otherwise set the point below.' },
    },
    pointField({ name: 'point', label: 'Point', description: 'Where it’s held, in blocks. Taken from the place when there is one.' }),
    { name: 'host', type: 'text', maxLength: 80, admin: { description: 'Who’s holding it, as readers should see it.' } },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      admin: { description: 'Optional: the article announcing it.' },
    },
    townField,
    ...authorshipFields,
  ],
}
