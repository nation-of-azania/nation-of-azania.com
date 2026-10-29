import type { Access, CollectionConfig } from 'payload'

import { hasRole, type Role } from '../access'
import { listVisibility } from '../access/lists'

/**
 * A list's changelog (src/collections/Lists.ts), one record per change,
 * written by the server only (src/lib/lists.ts): an edit of the entries,
 * with the players it brought onto the list or took off it, or the map's
 * watch seeing people move in and out of a listed town or nation. What it
 * records is fixed once written; staff may add a note afterwards. Readable
 * as its list is, so a public list's changelog is public, and an article
 * can show one change or the log as it grows (the Sanction list block).
 */

const isStaff = (user: unknown) => hasRole(user as { role?: Role | null }, 'admin', 'editor')

const readChanges: Access = ({ req }) => listVisibility(req.user, 'list.visibility')

/** Only the note is anyone's to change. */
const fixed = { create: () => false, update: () => false }

export const ListChanges: CollectionConfig = {
  slug: 'list-changes',
  labels: { singular: 'List change', plural: 'List changes' },
  admin: {
    group: 'Lists',
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'list', 'at', 'source'],
    description: 'Every list’s changelog, written as lists change. A note can be added afterwards; nothing else changes.',
    hidden: ({ user }) => !isStaff(user),
  },
  access: {
    read: readChanges,
    create: () => false,
    update: ({ req }) => isStaff(req.user),
    delete: ({ req }) => hasRole(req.user as { role?: Role | null }, 'admin'),
  },
  defaultSort: '-at',
  fields: [
    { name: 'summary', type: 'text', access: fixed, admin: { readOnly: true } },
    { name: 'list', type: 'relationship', relationTo: 'lists', index: true, access: fixed, admin: { readOnly: true } },
    { name: 'at', type: 'date', required: true, index: true, access: fixed, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'source',
      type: 'select',
      required: true,
      access: fixed,
      options: [
        { value: 'edit', label: 'An edit of the list' },
        { value: 'world', label: 'The map: people moved' },
      ],
      admin: { readOnly: true },
    },
    { name: 'by', type: 'relationship', relationTo: 'users', access: fixed, admin: { readOnly: true } },
    {
      name: 'note',
      type: 'text',
      maxLength: 200,
      admin: { description: 'Why it changed, e.g. the decree that ordered it. Shown with the change.' },
    },
    {
      // EntryChange[] (src/lists/resolve.ts): what an edit did to the entries.
      name: 'entries',
      type: 'json',
      access: fixed,
      admin: { readOnly: true },
    },
    {
      // PlayerChange[] (src/lists/resolve.ts): who came onto the list and who left it, and why.
      name: 'players',
      type: 'json',
      access: fixed,
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
}
