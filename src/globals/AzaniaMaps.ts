import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access'

/**
 * Which Towny towns are Azania's (src/lib/towns.ts). The nation's Towny name
 * is a setting rather than code because it changes: Azania's towns sit in a
 * Towny nation that is still called something else, and some towns haven't
 * joined it yet. The sync reads this, the Rulercraft map's marker file, and
 * keeps the Towns collection and the daily census.
 */
export const AzaniaMaps: GlobalConfig = {
  slug: 'azania-maps',
  label: 'Azania Maps',
  admin: {
    group: 'Settings',
    description:
      'Which towns on the Rulercraft map are Azania’s. The map is read about once an hour while people use Azania Maps, and once a day for the census.',
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    {
      name: 'nations',
      type: 'array',
      label: 'Towny nations',
      labels: { singular: 'Nation', plural: 'Nations' },
      admin: {
        description:
          'Every town in these Towny nations counts as Azanian. Spelt as the map has it; when the nation is renamed in game, rename it here.',
      },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      name: 'towns',
      type: 'array',
      label: 'Also these towns',
      labels: { singular: 'Town', plural: 'Towns' },
      admin: {
        description:
          'Towns that count as Azanian whatever their nation, such as towns that haven’t joined yet. Spelt as the map has it.',
      },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'syncedAt',
          type: 'date',
          label: 'Last checked',
          admin: { readOnly: true, width: '40%', date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'syncNote',
          type: 'text',
          label: 'Result',
          admin: { readOnly: true, width: '60%' },
        },
      ],
    },
  ],
}
