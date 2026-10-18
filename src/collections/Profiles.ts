import type {
  Access,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import { ValidationError } from 'payload'

import { hasRole, isAuthenticated, isEditorOrAdminField } from '../access'
import { can, contextIdsWith, getScope } from '../access/scope'
import { minecraftNameField } from '../fields/minecraftName'

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

/** Staff manage every profile; everyone else only their own. */
const canManage: Access = ({ req }) => {
  if (hasRole(req.user, 'editor', 'admin')) return true
  if (req.user) return { owner: { equals: req.user.id } }
  return false
}

/**
 * Members always own the profiles they create, and make them only for contexts
 * they can write in. Name and Minecraft name default to the owner's, so a
 * profile usually needs only a role and a context.
 */
const fillDefaults: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data
  if (req.user && !hasRole(req.user, 'editor', 'admin')) {
    if (operation === 'create') data.owner = req.user.id
    const scope = await getScope(req)
    const contexts: unknown[] = Array.isArray(data.contexts) ? data.contexts : []
    if (contexts.some((context) => !can(scope, idOf(context), 'write'))) {
      throw new ValidationError({
        collection: 'profiles',
        errors: [{ path: 'contexts', message: 'Choose only contexts you can write in.' }],
        req,
      })
    }
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

/** The admin panel's label for a profile, e.g. "IPaaat · Co-Leader (Government)". */
const setLabel: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const name = data.name ?? originalDoc?.name
  const title = data.title ?? originalDoc?.title
  const { tree } = await getScope(req)
  const contexts: unknown[] = data.contexts ?? originalDoc?.contexts ?? []
  const where = contexts
    .map((context) => tree.byId.get(idOf(context) ?? -1)?.name)
    .filter(Boolean)
    .join(', ')
  data.label = `${name} · ${title}${where ? ` (${where})` : ''}`
  return data
}

/**
 * Byline profiles: how a person is credited on an article. One account can
 * hold several, e.g. "IPaaat, Co-Leader" for Government and "IPaaat,
 * Editor-in-Chief" for the Times. A profile signs articles in the contexts it
 * was made for and everything below them. Profiles without an owner are
 * shared bylines ("The Editors", or someone without an account).
 */
export const Profiles: CollectionConfig = {
  slug: 'profiles',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['name', 'title', 'contexts', 'owner', 'active'],
    group: 'Content',
    description:
      'How people are credited on articles: a name and a role in a context. Create one for each role you write in; switch it off when the role ends.',
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
        description: 'Their role in this context, e.g. "Co-Leader" or "Editor-in-Chief".',
      },
    },
    {
      name: 'contexts',
      type: 'relationship',
      relationTo: 'contexts',
      hasMany: true,
      required: true,
      minRows: 1,
      admin: {
        description:
          'Where this byline signs: these contexts and everything below them, e.g. Government for "Co-Leader".',
      },
      filterOptions: async ({ req }) => {
        const scope = await getScope(req)
        return scope.staff || !req.user ? true : { id: { in: [...contextIdsWith(scope, 'write'), -1] } }
      },
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
        // Members always own their profiles (see fillDefaults).
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
