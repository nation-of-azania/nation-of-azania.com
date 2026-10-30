import type { Access, CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { hasRole, type Role } from '../access'
import { listVisibility } from '../access/lists'
import { slugField } from '../fields/slug'
import { recordListChange } from '../lib/lists'
import { ENTRY_KINDS, PLAYER_NAME } from '../lists/resolve'

/**
 * A list of players, named outright or through the towns and nations they
 * live in (src/lists/resolve.ts renders it down to names), kept by staff,
 * with a changelog written as it changes (src/collections/ListChanges.ts):
 * by an edit here, or by the map's watch as people move in and out of a
 * listed town or nation (src/lib/lists.ts → syncLists).
 *
 * A list means whatever its kind says, and only a kind the site knows how
 * to show is shown: a sanction list in the Gazette of the context it
 * belongs to, at /<top>/sanctions/<slug>, on its front page, and through
 * the Sanction list block. A plain list is data for other features (the
 * guilds to come), read through the API by whoever its visibility allows.
 * There is deliberately no page of every list.
 */

export const LIST_KINDS = {
  sanctions: 'Sanction list: shown in the Gazette of its context',
  plain: 'Plain: no page; data for other features',
} as const
export type ListKind = keyof typeof LIST_KINDS

export const LIST_VISIBILITY = {
  public: 'Public: anyone, and shown on the site',
  members: 'Members: anyone signed in',
  staff: 'Staff: editors and admins',
} as const

const staffOnly = ({ req }: { req: { user?: unknown } }) => hasRole(req.user as { role?: Role | null }, 'admin', 'editor')

const readLists: Access = ({ req }) => listVisibility(req.user)

const options = (registry: Record<string, string>) =>
  Object.entries(registry).map(([value, label]) => ({ value, label }))

type EntryRow = { id?: string | null; addedAt?: string | null }

/** New entries are dated; the note for this change is held for the changelog, and not kept on the list. */
const prepare: CollectionBeforeChangeHook = ({ data, req }) => {
  const now = new Date().toISOString()
  if (Array.isArray(data.entries)) {
    data.entries = (data.entries as EntryRow[]).map((row) => ({ ...row, addedAt: row.addedAt ?? now }))
  }
  // Each save's own note, or none: a request that saves the list twice mustn't lend the first note to the second.
  req.context.listChangeNote = typeof data.changeNote === 'string' && data.changeNote.trim() ? data.changeNote.trim() : undefined
  data.changeNote = null
  return data
}

/** Every edit of the entries goes into the changelog, with what it did to the players. */
const record: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (req.context.listSync) return doc
  await recordListChange(req.payload, {
    list: doc,
    before: operation === 'create' ? [] : previousDoc?.entries,
    source: 'edit',
    by: req.user && typeof (req.user as { id?: unknown }).id === 'number' ? (req.user as { id: number }).id : null,
    note: typeof req.context.listChangeNote === 'string' ? req.context.listChangeNote : null,
    req,
  })
  return doc
}

export const Lists: CollectionConfig = {
  slug: 'lists',
  labels: { singular: 'List', plural: 'Lists' },
  admin: {
    group: 'Lists',
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'visibility', 'updatedAt'],
    description:
      'Players, named or through their town or nation. Every change is written to the changelog, including people moving in and out of a listed town or nation.',
    hidden: ({ user }) => !hasRole(user as { role?: Role | null }, 'admin', 'editor'),
  },
  access: {
    read: readLists,
    create: staffOnly,
    update: staffOnly,
    delete: ({ req }) => hasRole(req.user as { role?: Role | null }, 'admin'),
  },
  hooks: {
    beforeChange: [prepare],
    afterChange: [record],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 120 },
    slugField('name'),
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          type: 'select',
          required: true,
          defaultValue: 'plain',
          options: options(LIST_KINDS),
          admin: { width: '50%', description: 'What the list is, and so where the site shows it.' },
        },
        {
          name: 'visibility',
          type: 'select',
          required: true,
          defaultValue: 'staff',
          options: options(LIST_VISIBILITY),
          admin: { width: '50%', description: 'Who may read it. Only a public list is shown on the site.' },
        },
      ],
    },
    {
      name: 'context',
      type: 'relationship',
      relationTo: 'contexts',
      admin: {
        condition: (data) => data?.kind === 'sanctions',
        description: 'The publication it belongs to: its page is /<that context>/sanctions/<slug>, and its front page links to it.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'What the list is and what it asks of readers, shown on its page.' },
    },
    {
      name: 'classes',
      type: 'array',
      labels: { singular: 'Class', plural: 'Classes' },
      admin: {
        description: 'The classes an entry can carry (“Indefinite”, “War crime”, “Moral code”), in the order they’re shown.',
        initCollapsed: true,
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, maxLength: 40, admin: { width: '35%' } },
            { name: 'description', type: 'text', maxLength: 200, admin: { width: '65%' } },
          ],
        },
      ],
    },
    {
      name: 'entries',
      type: 'array',
      labels: { singular: 'Entry', plural: 'Entries' },
      admin: {
        description:
          'A player, or a town or nation whose residents are listed for as long as they live there. The changelog records who comes and goes.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'kind',
              type: 'select',
              required: true,
              defaultValue: 'player',
              options: options(ENTRY_KINDS),
              admin: { width: '30%' },
            },
            {
              name: 'name',
              type: 'text',
              required: true,
              maxLength: 60,
              validate: (value: unknown, { siblingData }: { siblingData: { kind?: string } }) => {
                const name = typeof value === 'string' ? value.trim() : ''
                if (!name) return 'Give a name.'
                if (siblingData?.kind === 'player' && !PLAYER_NAME.test(name)) {
                  return 'A Minecraft name: 3 to 16 letters, digits or underscores (a Bedrock player’s with its leading dot).'
                }
                return true
              },
              admin: {
                width: '70%',
                description: 'A player’s Minecraft name, or the town or nation as the map spells it (Imperial_Avalonia).',
                components: { Field: '/components/admin/ListEntryFields#EntryNameField' },
              },
            },
          ],
        },
        {
          name: 'classes',
          type: 'text',
          hasMany: true,
          validate: (value: unknown, { data }: { data: { classes?: { name?: string }[] } }) => {
            const known = new Set((data?.classes ?? []).map((item) => item.name?.trim().toLowerCase()).filter(Boolean))
            const wrong = (Array.isArray(value) ? value : []).filter(
              (name) => typeof name === 'string' && !known.has(name.trim().toLowerCase()),
            )
            return wrong.length ? `Not one of the list’s classes: ${wrong.join(', ')}.` : true
          },
          admin: {
            description: 'Of the list’s classes above.',
            components: { Field: '/components/admin/ListEntryFields#EntryClassesField' },
          },
        },
        {
          name: 'reason',
          type: 'text',
          maxLength: 200,
          admin: { description: 'Why, in a line (“Leader and initiator of the Condorian Genocide”).' },
        },
        {
          type: 'row',
          admin: { condition: (_, siblingData) => siblingData?.kind === 'town' || siblingData?.kind === 'nation' },
          fields: [
            {
              name: 'exceptTowns',
              type: 'text',
              hasMany: true,
              label: 'Except these towns',
              admin: { width: '50%', description: 'Towns whose residents aren’t listed, e.g. ones the nation holds by occupation.' },
            },
            {
              name: 'exceptPlayers',
              type: 'text',
              hasMany: true,
              label: 'Except these players',
              admin: { width: '50%' },
            },
          ],
        },
        { name: 'addedAt', type: 'date', admin: { readOnly: true, hidden: true } },
      ],
    },
    {
      name: 'changeNote',
      type: 'text',
      maxLength: 200,
      label: 'Note for this change',
      admin: {
        description: 'Goes into the changelog with what this save changes, e.g. the decree that ordered it. Not kept on the list.',
      },
    },
    {
      // The list rendered down to players as last recorded (src/lib/lists.ts), kept by the server.
      name: 'roster',
      type: 'json',
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
    {
      name: 'rosterAt',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
  ],
}
