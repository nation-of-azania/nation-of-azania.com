import type { CollectionBeforeDeleteHook, CollectionConfig, FieldAccess } from 'payload'

import { hasRole, isAdmin } from '../../access'
import { getMapRights } from '../../access/maps'

/** Copied from the Rulercraft map by the sync (src/lib/towns.ts); nobody edits it by hand. */
const synced: FieldAccess = () => false

/** A deleted town takes its census with it; its places, roads and events stay, unassigned. */
const dropCensus: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({ collection: 'town-census', where: { town: { equals: id } }, req })
}

/**
 * Azania's towns, as Towny has them on the Rulercraft map. The sync creates
 * and updates them, keyed on Towny's own town id so a rename keeps the town's
 * history, places and mayors. A town that leaves the nation or falls stays
 * here, marked, rather than taking its places with it. A town's mayors may
 * write its description; the rest is the map's.
 */
export const Towns: CollectionConfig = {
  slug: 'towns',
  labels: { singular: 'Town', plural: 'Towns' },
  admin: {
    useAsTitle: 'name',
    group: 'Azania Maps',
    defaultColumns: ['name', 'azanian', 'nation', 'ruler', 'residentCount', 'chunks'],
    description:
      'Read from the Rulercraft map. Which towns count as Azanian is set under Settings → Azania Maps.',
  },
  access: {
    read: () => true,
    create: () => false,
    update: ({ req }) => {
      if (hasRole(req.user, 'editor', 'admin')) return true
      const { towns } = getMapRights(req.user)
      return towns.length ? { id: { in: towns } } : false
    },
    delete: isAdmin,
  },
  hooks: { beforeDelete: [dropCensus] },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, access: { update: synced }, admin: { readOnly: true, width: '50%' } },
        {
          name: 'slug',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          access: { update: synced },
          admin: { readOnly: true, width: '50%', description: 'Its address on Azania Maps: /maps/town/<slug>.' },
        },
      ],
    },
    {
      name: 'about',
      type: 'textarea',
      admin: { description: 'A few lines about the town, written by its mayor. Shown on its page on Azania Maps.' },
      validate: (value: null | string | undefined) =>
        !value || value.length <= 600 || 'At most 600 characters.',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'azanian',
          type: 'checkbox',
          label: 'Azanian',
          access: { update: synced },
          admin: { readOnly: true, width: '33%', description: 'By its nation, or listed in the settings.' },
        },
        {
          name: 'present',
          type: 'checkbox',
          label: 'On the map',
          defaultValue: true,
          access: { update: synced },
          admin: { readOnly: true, width: '33%', description: 'Off once the town is gone from Towny.' },
        },
        {
          name: 'syncedAt',
          type: 'date',
          label: 'Last read',
          access: { update: synced },
          admin: { readOnly: true, width: '33%', date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'As Towny has it',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'townyId',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          access: { update: synced },
          admin: { readOnly: true, description: 'Towny’s id for the town; survives renames.' },
        },
        {
          type: 'row',
          fields: [
            { name: 'nation', type: 'text', access: { update: synced }, admin: { readOnly: true, width: '33%' } },
            { name: 'ruler', type: 'text', access: { update: synced }, admin: { readOnly: true, width: '33%' } },
            { name: 'founded', type: 'text', access: { update: synced }, admin: { readOnly: true, width: '33%' } },
          ],
        },
        {
          name: 'publicSpawn',
          type: 'checkbox',
          label: 'Public spawn',
          access: { update: synced },
          admin: {
            readOnly: true,
            description: 'Towny’s "Public Teleport": whether any player may /t spawn here.',
          },
        },
        {
          type: 'row',
          fields: [
            { name: 'culture', type: 'text', access: { update: synced }, admin: { readOnly: true, width: '33%' } },
            {
              name: 'residentCount',
              type: 'number',
              label: 'Residents',
              access: { update: synced },
              admin: { readOnly: true, width: '33%' },
            },
            {
              name: 'chunks',
              type: 'number',
              label: 'Claimed chunks',
              access: { update: synced },
              admin: { readOnly: true, width: '33%' },
            },
          ],
        },
        {
          name: 'residents',
          type: 'json',
          access: { update: synced },
          admin: { readOnly: true, description: 'Minecraft names, as the map lists them.' },
        },
        {
          name: 'home',
          type: 'group',
          admin: { description: 'The town’s home block.' },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'x', type: 'number', access: { update: synced }, admin: { readOnly: true, width: '33%' } },
                { name: 'y', type: 'number', access: { update: synced }, admin: { readOnly: true, width: '33%' } },
                { name: 'z', type: 'number', access: { update: synced }, admin: { readOnly: true, width: '33%' } },
              ],
            },
          ],
        },
        {
          name: 'claims',
          type: 'json',
          access: { update: synced },
          admin: { readOnly: true, description: 'Claim outlines in blocks: [{ x: [...], z: [...] }, ...].' },
        },
      ],
    },
  ],
}
