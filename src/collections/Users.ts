import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'

import { hasRole, isAdmin, isAdminField } from '../access'
import { canUseAdmin, LEVEL_LABELS, LEVELS } from '../access/scope'
import { minecraftNameField } from '../fields/minecraftName'

/**
 * Byline profiles take their name and Minecraft name from the owner when
 * created. When the owner's Minecraft name changes, profiles still showing the
 * old one (as name or head) follow it; anything set differently by hand stays.
 */
const followMinecraftName: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const before = previousDoc?.minecraftName
  const after = doc.minecraftName
  if (!before || before === after) return doc
  const { docs } = await req.payload.find({
    collection: 'profiles',
    where: { owner: { equals: doc.id } },
    limit: 0,
    depth: 0,
    req,
  })
  for (const profile of docs) {
    const data = {
      ...(profile.minecraftName === before ? { minecraftName: after ?? null } : {}),
      ...(profile.name === before && after ? { name: after } : {}),
    }
    if (Object.keys(data).length) {
      await req.payload.update({ collection: 'profiles', id: profile.id, data, depth: 0, req })
    }
  }
  return doc
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'username', 'minecraftName', 'role'],
    group: 'Administration',
  },
  // Pure username/password auth. The nation owns no mail domain and no email
  // adapter is configured, so accounts carry no email address at all; admins
  // reset forgotten passwords from this panel (Users → edit → password).
  auth: {
    loginWithUsername: {
      allowEmailLogin: false,
      requireEmail: false,
      requireUsername: true,
    },
  },
  access: {
    // The admin panel is for staff and for members granted access to at least
    // one context, checked against the database on every admin request, so a
    // change applies immediately. Everyone else has their own account page on
    // the front end (src/app/(frontend)/account): Payload's "Unauthorized"
    // page redirects there (src/components/admin/RedirectToAccount.tsx).
    admin: ({ req }) => canUseAdmin(req.user),
    create: isAdmin,
    delete: isAdmin,
    // Staff see every account (author bylines in the admin UI). Members, who
    // may be representatives of other nations, see only their own.
    read: ({ req }) => {
      if (hasRole(req.user, 'editor', 'admin')) return true
      if (req.user) return { id: { equals: req.user.id } }
      return false
    },
    update: ({ req }) => {
      if (hasRole(req.user, 'admin')) return true
      if (req.user) return { id: { equals: req.user.id } }
      return false
    },
  },
  hooks: {
    afterChange: [followMinecraftName],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Display name',
      required: true,
      admin: {
        description:
          'Shown in the admin panel, and as the byline of articles without a byline profile.',
      },
    },
    minecraftNameField('Used as the default name and head on this person’s byline profiles.'),
    {
      // Permissions only. In-world roles ("Co-Leader", "Editor-in-Chief") live
      // on byline profiles (src/collections/Profiles.ts). The stored values
      // keep their original names; only the labels describe what they allow.
      name: 'role',
      type: 'select',
      label: 'Access level',
      required: true,
      defaultValue: 'resident',
      options: [
        { label: 'Resident: no admin access, except the contexts granted below', value: 'resident' },
        { label: 'Editor: publish in every context', value: 'editor' },
        { label: 'Admin: everything, including accounts and contexts', value: 'admin' },
      ],
      access: {
        // Only admins may grant or change roles.
        create: isAdminField,
        update: isAdminField,
      },
      saveToJWT: true,
      admin: {
        description:
          'Residents have the resident area, plus the contexts granted under Context access. Editors and admins act in every context. Roles within Azania ("Co-Leader") are set on Profiles.',
      },
    },
    {
      name: 'contextAccess',
      type: 'array',
      label: 'Context access',
      labels: { singular: 'Grant', plural: 'Grants' },
      access: {
        create: isAdminField,
        update: isAdminField,
      },
      admin: {
        description:
          'For members: each grant covers a context and everything below it. Write drafts, publish, or manage (publish, and create and edit the contexts below). Editors and admins don’t need grants.',
        condition: (data) => data?.role !== 'admin' && data?.role !== 'editor',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'context', type: 'relationship', relationTo: 'contexts', required: true, admin: { width: '60%' } },
            {
              name: 'level',
              type: 'select',
              required: true,
              defaultValue: 'write',
              options: LEVELS.map((value) => ({ label: LEVEL_LABELS[value], value })),
              admin: { width: '40%' },
            },
          ],
        },
      ],
    },
    {
      // Drawing rights on Azania Maps (src/access/maps.ts). Mayors draw on
      // /maps, not in this panel, so these grant no admin access.
      type: 'collapsible',
      label: 'Azania Maps',
      admin: {
        initCollapsed: true,
        condition: (data) => data?.role !== 'admin' && data?.role !== 'editor',
      },
      fields: [
        {
          name: 'mayorOf',
          type: 'relationship',
          relationTo: 'towns',
          hasMany: true,
          label: 'Mayor of',
          access: { create: isAdminField, update: isAdminField },
          admin: {
            description:
              'Draw and edit places, roads and events inside these towns’ claims on Azania Maps, and write the town’s description. Towns → a town shows who Towny says rules it.',
          },
        },
        {
          name: 'cartographer',
          type: 'checkbox',
          label: 'Cartographer',
          defaultValue: false,
          access: { create: isAdminField, update: isAdminField },
          admin: {
            description: 'Draw anywhere on Azania Maps, including national roads and places between towns.',
          },
        },
      ],
    },
  ],
}
