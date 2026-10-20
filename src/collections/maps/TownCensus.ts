import type { CollectionConfig } from 'payload'

import { isAdmin } from '../../access'

/**
 * One row per Azanian town per day: residents and claimed chunks as the
 * Rulercraft map had them at that day's last reading (src/lib/towns.ts).
 * Written by the sync only; it's the history behind Azania's growth charts.
 */
export const TownCensus: CollectionConfig = {
  slug: 'town-census',
  labels: { singular: 'Census entry', plural: 'Census' },
  admin: {
    useAsTitle: 'key',
    group: 'Azania Maps',
    defaultColumns: ['date', 'town', 'residents', 'chunks', 'nation'],
    description: 'Recorded daily from the Rulercraft map.',
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'date', type: 'text', required: true, index: true, admin: { width: '33%', description: 'YYYY-MM-DD, UTC.' } },
        { name: 'town', type: 'relationship', relationTo: 'towns', required: true, index: true, admin: { width: '67%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'residents', type: 'number', required: true, admin: { width: '33%' } },
        { name: 'chunks', type: 'number', required: true, admin: { width: '33%' } },
        { name: 'nation', type: 'text', admin: { width: '33%' } },
      ],
    },
  ],
}
