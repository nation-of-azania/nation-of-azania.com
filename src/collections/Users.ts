import type { CollectionConfig } from 'payload'

import { hasRole, isAdmin, isAdminField } from '../access'
import { minecraftNameField } from '../fields/minecraftName'

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
    // Gate the admin panel to staff. Residents get a branded register on the
    // front end instead (src/app/(frontend)/account) and are redirected away
    // from /admin by middleware.ts — this is the enforced, server-side boundary.
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
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Display name',
      required: true,
      admin: {
        description: 'Shown in the admin panel, and as the byline of articles without a byline profile.',
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
        { label: 'Drafts only', value: 'resident' },
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
          'Drafts only: write drafts of their own articles. Can publish: edit and publish anything. Admin: also manage accounts. Roles within Azania are set on Profiles.',
      },
    },
  ],
}
