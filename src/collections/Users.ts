import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'

import { hasRole, isAdmin, isAdminField } from '../access'
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
    // Gate the admin panel to staff, checked against the database on every
    // admin request. Residents get their own account page on the front end
    // (src/app/(frontend)/account): Payload's "Unauthorized" page redirects
    // there (src/components/admin/RedirectToAccount.tsx).
    // (Inlined rather than the `isEditorOrAdmin` Access helper: `access.admin`
    // must return a plain boolean, not a Where query.)
    admin: ({ req }) => hasRole(req.user, 'editor', 'admin'),
    create: isAdmin,
    delete: isAdmin,
    // Everyone can see who exists (needed for author bylines in the admin UI);
    // email stays visible only to admins and the account owner (field-level).
    read: ({ req }) => Boolean(req.user),
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
        { label: 'Resident: no admin access', value: 'resident' },
        { label: 'Can publish', value: 'editor' },
        { label: 'Admin', value: 'admin' },
      ],
      access: {
        // Only admins may grant or change roles.
        create: isAdminField,
        update: isAdminField,
      },
      saveToJWT: true,
      admin: {
        description:
          'Residents have the resident area only, no admin access. Can publish: edit and publish anything. Admin: also manage accounts. Roles within Azania are set on Profiles.',
      },
    },
  ],
}
