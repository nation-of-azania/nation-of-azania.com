import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { createMapView, editMapView } from '../../access/maps'
import { drawingsProblem, MAP_LAYERS, options, VIEW_ASPECTS } from '../../maps/registry'
import { MAPS } from '../../lib/dynmap'
import { pointField } from './shared'

const stampAuthor: CollectionBeforeChangeHook = ({ data, req, operation }) => {
  if (req.user) {
    if (operation === 'create') data.createdBy = req.user.id
    data.updatedBy = req.user.id
  }
  return data
}

/**
 * A framed piece of Azania Maps for an article's Map block: where it looks,
 * which of the map's layers show, and highlights drawn on top (strokes,
 * shaded areas, pins, words) to point the reader at something. Drawn on
 * /maps by anyone who writes articles; each view belongs to whoever drew it.
 */
export const MapViews: CollectionConfig = {
  slug: 'map-views',
  labels: { singular: 'Map view', plural: 'Map views' },
  admin: {
    useAsTitle: 'title',
    group: 'Azania Maps',
    defaultColumns: ['title', 'aspect', 'updatedAt'],
    description: 'Drawn on Azania Maps (/maps) and shown in articles through the Map block.',
  },
  access: {
    read: () => true,
    create: createMapView,
    update: editMapView,
    delete: editMapView,
  },
  hooks: { beforeChange: [stampAuthor] },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 100,
      admin: { description: 'For finding it again when choosing it in a Map block; readers don’t see it.' },
    },
    pointField({ name: 'centre', required: true, description: 'The middle of the frame, in blocks.' }),
    {
      type: 'row',
      fields: [
        {
          name: 'span',
          type: 'number',
          required: true,
          min: 32,
          max: 40000,
          defaultValue: 600,
          admin: { width: '33%', description: 'How many blocks the frame shows across.' },
        },
        {
          name: 'aspect',
          type: 'select',
          required: true,
          defaultValue: 'wide',
          options: options(VIEW_ASPECTS),
          admin: { width: '33%' },
        },
        {
          name: 'map',
          type: 'select',
          required: true,
          defaultValue: 'flat',
          options: Object.entries(MAPS).map(([value, { label }]) => ({ label, value })),
          admin: { width: '33%' },
        },
      ],
    },
    {
      name: 'layers',
      type: 'select',
      hasMany: true,
      defaultValue: ['towns', 'places', 'roads'],
      options: options(MAP_LAYERS),
      admin: { description: 'Which of Azania Maps’ own layers show under the highlights.' },
    },
    {
      name: 'drawings',
      type: 'json',
      admin: { description: 'The highlights, as drawn on /maps.' },
      validate: (value: unknown) => drawingsProblem(value) ?? true,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      access: { update: () => false },
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
      access: { update: () => false },
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
}
