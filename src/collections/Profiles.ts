import type {
  Access,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import { hasRole, isAuthenticated, isEditorOrAdminField } from '../access'
import { minecraftNameField } from '../fields/minecraftName'

export const PUBLICATION_LABELS = {
  government: 'Gazette',
  times: 'Times',
  both: 'Gazette & Times',
} as const

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

/** Staff manage every profile; everyone else only their own. */
const canManage: Access = ({ req }) => {
  if (hasRole(req.user, 'editor', 'admin')) return true
  if (req.user) return { owner: { equals: req.user.id } }
  return false
}

/**
 * Residents always own the profiles they create. Name and Minecraft name
 * default to the owner's, so a profile usually needs only a role.
 */
const fillDefaults: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data
  if (operation === 'create' && req.user && !hasRole(req.user, 'editor', 'admin')) {
    data.owner = req.user.id
  }
  const ownerId = idOf(data.owner ?? originalDoc?.owner)
  if (ownerId && (!data.name || !data.minecraftName)) {
    const owner = await req.payload
      .findByID({ collection: 'users', id: ownerId, depth: 0, req })
      .catch(() => null)
    if (owner) {
      data.name ||= owner.minecraftName || owner.name
      data.minecraftName ||= owner.minecraftName || undefined
    }
  }
  return data
}

/** The admin panel's label for a profile, e.g. "IPaaat · Co-Leader (Gazette)". */
const setLabel: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const name = data.name ?? originalDoc?.name
  const title = data.title ?? originalDoc?.title
  const publication = (data.publication ??
    originalDoc?.publication) as keyof typeof PUBLICATION_LABELS
  data.label = `${name} · ${title} (${PUBLICATION_LABELS[publication] ?? publication})`
  return data
}

/**
 * Byline profiles: how a person is credited on an article. One account can
 * hold several, e.g. "IPaaat, Co-Leader" in the Gazette and "IPaaat,
 * Editor-in-Chief" in the Times. Profiles without an owner are shared
 * bylines ("The Editors", or someone without an account).
 */
export const Profiles: CollectionConfig = {
  slug: 'profiles',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['name', 'title', 'publication', 'owner', 'active'],
    group: 'Content',
    description:
      'How people are credited on articles: a name and a role per publication. Create one for each role you write in; switch it off when the role ends.',
  },
  access: {
    read: () => true,
    create: isAuthenticated,
    update: canManage,
    delete: canManage,
  },
  hooks: {
    beforeValidate: [fillDefaults],
    beforeChange: [setLabel],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Shown in the byline. Defaults to the owner’s Minecraft name.' },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Role',
      required: true,
      admin: {
        description: 'Their role in this publication, e.g. "Co-Leader" or "Editor-in-Chief".',
      },
    },
    {
      name: 'publication',
      type: 'select',
      required: true,
      defaultValue: 'both',
      options: Object.entries(PUBLICATION_LABELS).map(([value, label]) => ({ label, value })),
      admin: { description: 'Where this byline can be used.' },
    },
    minecraftNameField(
      'Their head is the avatar unless one is uploaded below. Defaults to the owner’s.',
    ),
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { mimeType: { contains: 'image' } },
      admin: { description: 'Optional. Replaces the Minecraft head.' },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      defaultValue: ({ user }) => user?.id,
      admin: {
        position: 'sidebar',
        description:
          'The account that writes as this profile. Leave empty for a shared byline such as "The Editors".',
      },
      access: {
        // Residents always own their profiles (see fillDefaults).
        create: isEditorOrAdminField,
        update: isEditorOrAdminField,
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description:
          'Switch off when the role ends: past articles keep this byline, new ones can no longer choose it.',
      },
    },
    {
      name: 'label',
      type: 'text',
      admin: { hidden: true },
    },
  ],
}
