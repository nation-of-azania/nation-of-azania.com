import type { CollectionConfig } from 'payload'

import { isAdmin } from '../../access'

/**
 * Who was online on the Rulercraft server, one row per day (UTC): for each
 * player, which of the day's 288 five-minute slots the watch found them
 * online in (src/lib/presence.ts), as a packed bitmap. What the fighters'
 * usual hours are counted from.
 */
export const PresenceDays: CollectionConfig = {
  slug: 'presence-days',
  labels: { singular: 'Presence day', plural: 'Presence' },
  admin: {
    useAsTitle: 'day',
    group: 'Azania Maps',
    defaultColumns: ['day', 'players'],
    description: 'Who was online, in five-minute slots, recorded by the watch.',
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  defaultSort: '-day',
  fields: [
    { name: 'day', type: 'text', required: true, unique: true, admin: { readOnly: true, description: 'YYYY-MM-DD, UTC.' } },
    { name: 'players', type: 'number', admin: { readOnly: true, description: 'Players seen online that day.' } },
    // { [name]: base64 of 36 bytes, a bit per five-minute slot }.
    { name: 'slots', type: 'json', admin: { readOnly: true, hidden: true } },
  ],
  timestamps: true,
}
