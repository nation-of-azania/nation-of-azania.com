import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'
import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'

import {
  canReadPublishedOrOwn,
  canUpdateOwnOrEditor,
  hasRole,
  isAuthenticated,
  isEditorOrAdmin,
  isEditorOrAdminField,
} from '../access'
import { contentBlocks } from '../blocks/config'
import { slugField } from '../fields/slug'

/** Block types reserved for editors and admins (heavy interactive exhibits). */
const RESTRICTED_BLOCKS = new Set(['model3d', 'litematic'])

/** Count restricted (editor-only) blocks anywhere in a Lexical editor state. */
const countRestrictedBlocks = (node: unknown): number => {
  if (Array.isArray(node))
    return node.reduce((sum: number, child) => sum + countRestrictedBlocks(child), 0)
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>
    const fields = record.fields as Record<string, unknown> | undefined
    const self =
      record.type === 'block' && RESTRICTED_BLOCKS.has(fields?.blockType as string) ? 1 : 0
    return self + countRestrictedBlocks(record.children ?? (record.root ? [record.root] : []))
  }
  return 0
}

/**
 * Residents cannot publish, and cannot add the editor-only exhibit blocks (3D
 * model, Litematica build). Draft saves stay fully available to them.
 */
const enforceResidentLimits: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!req.user || hasRole(req.user, 'editor', 'admin')) return data

  if (data?._status === 'published') {
    throw new APIError(
      'Residents cannot publish articles. Save as a draft and ask an editor to review it.',
      403,
    )
  }

  const before = countRestrictedBlocks(originalDoc?.content ?? null)
  const after = countRestrictedBlocks(data?.content ?? null)
  if (after > before) {
    throw new APIError('The 3D model and Litematica blocks are available to editors and admins only.', 403)
  }

  return data
}

/** Stamp publishedAt the first time an article is published. */
const stampPublishedAt: CollectionBeforeChangeHook = ({ data }) => {
  if (data?._status === 'published' && !data.publishedAt) {
    data.publishedAt = new Date().toISOString()
  }
  return data
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'section', 'author', 'category', '_status', 'publishedAt'],
    group: 'Content',
    description: 'News, decrees and documents of the Nation of Condoria.',
  },
  access: {
    read: canReadPublishedOrOwn,
    create: isAuthenticated,
    update: canUpdateOwnOrEditor,
    delete: isEditorOrAdmin,
  },
  versions: {
    drafts: {
      autosave: { interval: 1500 },
    },
    maxPerDoc: 30,
  },
  hooks: {
    beforeChange: [enforceResidentLimits, stampPublishedAt],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
      admin: {
        description: 'Short summary shown in article lists and on the homepage.',
      },
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          BlocksFeature({ blocks: contentBlocks }),
        ],
      }),
    },
    slugField('title'),
    {
      name: 'section',
      type: 'select',
      required: true,
      defaultValue: 'government',
      options: [
        { label: 'Government Gazette', value: 'government' },
        { label: 'Condor Times', value: 'times' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Which publication carries this article: the state Gazette (/gov) or the independent Condor Times (/times).',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Set automatically on first publish; can be backdated.',
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      defaultValue: ({ user }) => user?.id,
      admin: { position: 'sidebar' },
      access: {
        // Residents always write as themselves.
        update: isEditorOrAdminField,
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      admin: { position: 'sidebar' },
    },
    {
      name: 'pinned',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Pinned articles appear in the "Documents of State" section on the homepage.',
      },
      access: {
        create: isEditorOrAdminField,
        update: isEditorOrAdminField,
      },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
      filterOptions: { mimeType: { contains: 'image' } },
    },
  ],
}
