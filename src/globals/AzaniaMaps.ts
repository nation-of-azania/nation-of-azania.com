import { revalidatePath } from 'next/cache'
import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { isAdmin } from '../access'
import { options, STANCES } from '../maps/registry'

/**
 * Which Towny towns are Azania's (src/lib/towns.ts). The nation's Towny name
 * is a setting rather than code because it can change (it was "Canada"
 * before it became "Azania"), and some towns count before they join. The
 * sync reads this, the Rulercraft map's marker file, and keeps the Towns
 * collection and the daily census; when Towny renames the nation, the sync
 * renames it here too.
 */
/**
 * An admin's change to the diplomacy shows on the map at once rather than
 * when its cached pages next regenerate. The sync's own writes (when it last
 * read the map) don't touch the relations and refresh nothing.
 */
const refreshDiplomacy: GlobalAfterChangeHook = ({ doc, previousDoc, req }) => {
  if (!req.user) return doc
  const relations = (value: unknown) => JSON.stringify((value as { relations?: unknown })?.relations ?? [])
  if (relations(doc) === relations(previousDoc)) return doc
  try {
    revalidatePath('/(frontend)/maps', 'layout')
  } catch {
    // Outside a request Next can refresh from (a script, a migration): the pages catch up within a minute.
  }
  return doc
}

/** Names picked from the Rulercraft map rather than typed (src/components/admin/WorldNameField.tsx). */
const NATION_PICKER = { path: '/components/admin/WorldNameField#WorldNameField', clientProps: { of: 'nations' } }
const TOWN_PICKER = { path: '/components/admin/WorldNameField#WorldNameField', clientProps: { of: 'towns' } }

export const AzaniaMaps: GlobalConfig = {
  slug: 'azania-maps',
  label: 'Azania Maps',
  admin: {
    group: 'Settings',
    description:
      'Which towns on the Rulercraft map are Azania’s. The map is read every ten minutes or so, and once a day for the census.',
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  hooks: { afterChange: [refreshDiplomacy] },
  fields: [
    {
      name: 'nations',
      type: 'array',
      label: 'Towny nations',
      labels: { singular: 'Nation', plural: 'Nations' },
      admin: {
        description:
          'Every town in these Towny nations counts as Azanian. When the nation is renamed in game, the next reading of the map follows the new name by itself (and says so under Result).',
      },
      fields: [{ name: 'name', type: 'text', required: true, admin: { components: { Field: NATION_PICKER } } }],
    },
    {
      name: 'towns',
      type: 'array',
      label: 'Also these towns',
      labels: { singular: 'Town', plural: 'Towns' },
      admin: {
        description:
          'Towns that count as Azanian whatever their nation, such as towns that haven’t joined yet.',
      },
      fields: [{ name: 'name', type: 'text', required: true, admin: { components: { Field: TOWN_PICKER } } }],
    },
    {
      name: 'relations',
      type: 'array',
      label: 'Diplomacy',
      labels: { singular: 'Relation', plural: 'Relations' },
      admin: {
        description:
          'Where Azania stands with other nations, for the map’s diplomacy layer, which anyone can see, and the siege alerts for allies (Settings → Discord). Nations not named here are neutral. Admins and diplomats (Users → Azania Maps) can also set these from a nation’s panel on Azania Maps.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'nation', type: 'text', required: true, admin: { width: '40%', components: { Field: NATION_PICKER } } },
            {
              name: 'stance',
              type: 'select',
              required: true,
              defaultValue: 'friendly',
              options: options(STANCES),
              admin: { width: '25%' },
            },
            {
              name: 'note',
              type: 'text',
              maxLength: 140,
              admin: { width: '35%', description: 'A line for readers, e.g. "Treaty of Oasis, October 2026".' },
            },
          ],
        },
      ],
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
    {
      // The sieges on the map as the siege alerts last saw them, and when (src/lib/siegeAlerts.ts).
      name: 'siegeWatch',
      type: 'json',
      admin: { hidden: true },
    },
  ],
}
