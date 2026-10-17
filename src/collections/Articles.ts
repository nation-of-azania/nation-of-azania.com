import {
  APIError,
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type Payload,
  type PayloadRequest,
  type Where,
} from 'payload'
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
import { articlePath, livePreview, previewButton } from '../lib/preview'

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
    throw new APIError(
      'The 3D model and Litematica blocks are available to editors and admins only.',
      403,
    )
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

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

/** Profiles a byline may use: the author's own (or, for staff, shared ones) in this publication. */
const bylineChoices = (authorId: number | undefined, section: string, staff: boolean): Where => ({
  and: [
    { publication: { in: [section, 'both'] } },
    staff
      ? {
          or: [
            { owner: { exists: false } },
            ...(authorId ? [{ owner: { equals: authorId } }] : []),
          ],
        }
      : { owner: { equals: authorId ?? 0 } },
  ],
})

/** The author's first active profile for the publication, if any. */
const defaultByline = async (
  payload: Payload,
  req: PayloadRequest,
  authorId: number,
  section: string,
) => {
  const { docs } = await payload.find({
    collection: 'profiles',
    where: { and: [{ active: { equals: true } }, bylineChoices(authorId, section, false)] },
    sort: 'createdAt',
    limit: 1,
    depth: 0,
    req,
  })
  return docs[0]?.id ?? null
}

/** Trusted local calls (seed, scripts) have no user; staff may also use shared profiles. */
const isStaff = (user: Parameters<typeof hasRole>[0]) => !user || hasRole(user, 'editor', 'admin')

/**
 * Keeps the byline consistent with the author and publication. A byline picked
 * in this request must be one of the author's active profiles for the
 * publication (staff may also use a shared one). Otherwise the author's
 * default profile fills an empty byline, and replaces a saved one that no
 * longer fits because the author or publication changed; a saved byline whose
 * profile was merely switched off stays.
 */
const applyDefaultByline: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const section = String(data.section ?? originalDoc?.section ?? 'government')
  const authorId = idOf(data.author ?? originalDoc?.author)
  const bylineId = idOf(data.byline !== undefined ? data.byline : originalDoc?.byline)
  const pickedNow = data.byline !== undefined && bylineId !== idOf(originalDoc?.byline)

  if (bylineId && pickedNow) {
    // Checked here rather than left to filterOptions, which Payload skips on
    // draft saves (and autosave is a draft save).
    const { totalDocs } = await req.payload.count({
      collection: 'profiles',
      where: {
        and: [
          { id: { equals: bylineId } },
          { active: { equals: true } },
          bylineChoices(authorId, section, isStaff(req.user)),
        ],
      },
      req,
    })
    if (totalDocs > 0) return data
    throw new ValidationError({
      collection: 'articles',
      errors: [
        {
          path: 'byline',
          message:
            'Choose one of the author’s active profiles for this publication (staff may also use a shared one).',
        },
      ],
      req,
    })
  }

  if (bylineId) {
    const { totalDocs } = await req.payload.count({
      collection: 'profiles',
      where: {
        and: [{ id: { equals: bylineId } }, bylineChoices(authorId, section, isStaff(req.user))],
      },
      req,
    })
    if (totalDocs > 0) return data
  }

  data.byline = authorId ? await defaultByline(req.payload, req, authorId, section) : null
  return data
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'section', 'author', 'category', '_status', 'publishedAt'],
    group: 'Content',
    description: 'News, decrees and documents of the Nation of Azania.',
    livePreview: livePreview(articlePath),
    preview: previewButton(articlePath),
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
    beforeValidate: [applyDefaultByline],
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
        { label: 'Azanian Times', value: 'times' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Which publication carries this article: the state Gazette (/gov) or the independent Azanian Times (/times).',
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
      name: 'byline',
      type: 'relationship',
      relationTo: 'profiles',
      admin: {
        position: 'sidebar',
        description:
          'How the author is credited, e.g. "IPaaat, Co-Leader". Defaults to their first profile for this publication; manage profiles under Content → Profiles.',
      },
      // Also enforced on save: Payload validates the value against these options.
      filterOptions: async ({ id, data, user, req }) => {
        const choices: Where = {
          and: [
            { active: { equals: true } },
            bylineChoices(idOf(data?.author), String(data?.section ?? 'government'), isStaff(user)),
          ],
        }
        // The byline already saved stays valid (and listed), even after its
        // profile is switched off, so old articles keep their credit.
        const saved = id
          ? await req.payload
              .findByID({ collection: 'articles', id, depth: 0, draft: true, req })
              .then((doc) => idOf(doc.byline))
              .catch(() => undefined)
          : undefined
        return saved ? { or: [choices, { id: { equals: saved } }] } : choices
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
