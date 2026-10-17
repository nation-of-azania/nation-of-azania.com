import type { CollectionConfig } from 'payload'

import { hasRole, isAdmin, isAdminField } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'username', 'role'],
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
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'resident',
      options: [
        { label: 'Resident', value: 'resident' },
        { label: 'Editor', value: 'editor' },
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
          'Residents write drafts of their own articles. Editors publish anything. Admins manage users.',
      },
    },
  ],
}
