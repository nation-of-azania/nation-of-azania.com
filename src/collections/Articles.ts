import {
  APIError,
  ValidationError,
  type AccessResult,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type FieldAccess,
  type PayloadRequest,
  type Where,
} from 'payload'
import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'

import { isEditorOrAdminField } from '../access'
import { can, contextIdsWith, getScope, type Scope } from '../access/scope'
import { contentBlocks } from '../blocks/config'
import { DESIGNS, defaultTypeOf, isDesign, TYPE_LABELS, typesOf } from '../contexts/designs'
import { isStyle, STYLES, styleOptions, styleSupports } from '../contexts/styles'
import { slugField } from '../fields/slug'
import { announceArticle } from '../lib/discord'
import { articlePath, livePreview, previewButton } from '../lib/preview'

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

/** `in` with an empty list is rejected by some adapters; -1 matches nothing. */
const anyOf = (ids: number[]) => (ids.length ? ids : [-1])

/** Block types reserved for those who can publish (heavy interactive exhibits). */
const RESTRICTED_BLOCKS = new Set(['model3d', 'litematic'])

/** Count restricted blocks anywhere in a Lexical editor state. */
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

const fieldError = (req: PayloadRequest, path: string, message: string) =>
  new ValidationError({ collection: 'articles', errors: [{ path, message }], req })

/**
 * Places the article in its context: the author must be allowed to write
 * there (trusted local calls without a user are exempt), the article takes the
 * context's design, and its type must be one of that design's types. A type
 * left over from a previous context falls back to the new design's default;
 * so does a style of its own that the new design can't wear.
 */
const applyContext: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const contextId = idOf(data.context ?? originalDoc?.context)
  if (!contextId) return data // the required-field validation reports it

  const scope = await getScope(req)
  const contextChanged = contextId !== idOf(originalDoc?.context)
  if (req.user && contextChanged && !can(scope, contextId, 'write')) {
    throw fieldError(req, 'context', 'You don’t have access to write in that context.')
  }

  const design = scope.tree.designOf(contextId)
  data.design = design
  const type = data.type ?? originalDoc?.type
  const typePickedNow = data.type !== undefined && data.type !== originalDoc?.type
  if (!type || !typesOf(design).includes(type)) {
    if (type && typePickedNow) {
      throw fieldError(req, 'type', `“${TYPE_LABELS[type as keyof typeof TYPE_LABELS] ?? type}” isn’t a type of this context.`)
    }
    data.type = defaultTypeOf(design)
  }

  // Context styles come with the context; only open styles are picked per article.
  const style = data.style !== undefined ? data.style : originalDoc?.style
  if (isStyle(style) && !(STYLES[style].open && styleSupports(style, design))) {
    if (data.style !== undefined && data.style !== originalDoc?.style) {
      throw fieldError(req, 'style', `${STYLES[style].label} comes with its context; it can’t be picked here.`)
    }
    data.style = null
  }
  return data
}

/**
 * Who may publish: staff, and members granted Publish (or Manage) on the
 * article's context. Everyone else saves drafts for them to review. The heavy
 * exhibit blocks follow the same line.
 */
const enforcePublishing: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (!req.user) return data
  const scope = await getScope(req)
  const contextId = idOf(data.context ?? originalDoc?.context)
  if (can(scope, contextId, 'publish')) return data

  if (data._status === 'published') {
    throw new APIError(
      'You can write drafts in this context but not publish them. Save a draft and ask someone who can publish here to review it.',
      403,
    )
  }
  const before = countRestrictedBlocks(originalDoc?.content ?? null)
  const after = countRestrictedBlocks(data.content ?? null)
  if (after > before) {
    throw new APIError('The 3D model and Litematica blocks need publishing access in this context.', 403)
  }
  return data
}

const ANNOUNCE = 'azaniaAnnounce'

/**
 * The first time an article goes live it gets `announcedAt`, and, when a
 * signed-in person published it, a Discord announcement is queued for after
 * the save (src/lib/discord.ts). The stored row decides "first": it holds the
 * published version, whatever draft the editor was working from.
 */
const markFirstPublication: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (data._status !== 'published') return data
  const id = idOf(originalDoc?.id)
  const stored =
    id != null
      ? await req.payload.db.findOne<{ id: number; announcedAt?: string | null }>({
          collection: 'articles',
          where: { id: { equals: id } },
          req,
        })
      : null
  if (stored?.announcedAt) {
    data.announcedAt = stored.announcedAt
    return data
  }
  data.announcedAt = new Date().toISOString()
  const slug = data.slug ?? originalDoc?.slug
  if (req.user && slug) {
    const queued = (req.context[ANNOUNCE] as Set<string> | undefined) ?? new Set<string>()
    req.context[ANNOUNCE] = queued.add(slug)
  }
  return data
}

const announceFirstPublication: CollectionAfterChangeHook = async ({ doc, req }) => {
  const queued = req.context[ANNOUNCE] as Set<string> | undefined
  if (doc._status === 'published' && queued?.delete(doc.slug)) await announceArticle(req.payload, doc)
  return doc
}

/** Stamp publishedAt the first time an article is published. */
const stampPublishedAt: CollectionBeforeChangeHook = ({ data }) => {
  if (data?._status === 'published' && !data.publishedAt) {
    data.publishedAt = new Date().toISOString()
  }
  return data
}

/**
 * Profiles a byline may use: one of the author's own, or a shared (ownerless)
 * profile for those who can publish here, made for this context or one above
 * it. "IPaaat, Co-Leader" made for Government can sign anything in Government
 * and its ministries; a delegate's profile made for International can't.
 */
const bylineChoices = (
  scope: Scope,
  authorId: number | undefined,
  contextId: number | undefined,
  trusted: boolean,
): Where => {
  const contexts = contextId ? scope.tree.ancestors(contextId).map((context) => context.id) : []
  const shared = trusted || can(scope, contextId, 'publish')
  return {
    and: [
      { contexts: { in: anyOf(contexts) } },
      shared
        ? { or: [{ owner: { exists: false } }, ...(authorId ? [{ owner: { equals: authorId } }] : [])] }
        : { owner: { equals: authorId ?? -1 } },
    ],
  }
}

/**
 * Keeps the byline consistent with the author and context. A byline picked in
 * this request must be one of the allowed active profiles (checked here, not
 * only by filterOptions, which Payload skips on draft saves). Otherwise the
 * author's first matching profile fills an empty byline, and replaces a saved
 * one that no longer fits because the author or context changed; a saved
 * byline whose profile was merely switched off stays.
 */
const applyDefaultByline: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const scope = await getScope(req)
  const contextId = idOf(data.context ?? originalDoc?.context)
  const authorId = idOf(data.author ?? originalDoc?.author)
  const bylineId = idOf(data.byline !== undefined ? data.byline : originalDoc?.byline)
  const pickedNow = data.byline !== undefined && bylineId !== idOf(originalDoc?.byline)
  const choices = bylineChoices(scope, authorId, contextId, !req.user)
  const fits = async (extra: Where[]) =>
    (
      await req.payload.count({
        collection: 'profiles',
        where: { and: [{ id: { equals: bylineId } }, choices, ...extra] },
        req,
      })
    ).totalDocs > 0

  if (bylineId && pickedNow) {
    if (await fits([{ active: { equals: true } }])) return data
    throw fieldError(
      req,
      'byline',
      'Choose one of the author’s active profiles for this context (those who can publish here may also use a shared one).',
    )
  }
  if (bylineId && (await fits([]))) return data

  if (!authorId || !contextId) {
    data.byline = null
    return data
  }
  const { docs } = await req.payload.find({
    collection: 'profiles',
    where: {
      and: [{ active: { equals: true } }, { owner: { equals: authorId } }, bylineChoices(scope, authorId, contextId, false)],
    },
    sort: 'createdAt',
    limit: 1,
    depth: 0,
    req,
  })
  data.byline = docs[0]?.id ?? null
  return data
}

/** Field access: those who can publish in the article's context. */
const canPublishHere: FieldAccess = async ({ req, data, doc }) =>
  can(await getScope(req), idOf(data?.context ?? doc?.context), 'publish')

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'context', 'type', 'author', '_status', 'publishedAt'],
    group: 'Content',
    description: 'Everything published in a context: decrees, news, standards, case studies…',
    livePreview: livePreview(articlePath),
    preview: previewButton(articlePath),
  },
  access: {
    read: async ({ req }): Promise<AccessResult> => {
      if (!req.user) return { _status: { equals: 'published' } }
      const scope = await getScope(req)
      if (scope.staff) return true
      // Members also see their own drafts, and every draft where they publish (to review them).
      return {
        or: [
          { _status: { equals: 'published' } },
          { author: { equals: req.user.id } },
          { context: { in: anyOf(contextIdsWith(scope, 'publish')) } },
        ],
      }
    },
    create: async ({ req }) => {
      if (!req.user) return false
      const scope = await getScope(req)
      return contextIdsWith(scope, 'write').length > 0
    },
    update: async ({ req }): Promise<AccessResult> => {
      if (!req.user) return false
      const scope = await getScope(req)
      if (scope.staff) return true
      return {
        or: [
          {
            and: [
              { author: { equals: req.user.id } },
              { context: { in: anyOf(contextIdsWith(scope, 'write')) } },
            ],
          },
          { context: { in: anyOf(contextIdsWith(scope, 'publish')) } },
        ],
      }
    },
    delete: async ({ req }): Promise<AccessResult> => {
      if (!req.user) return false
      const scope = await getScope(req)
      if (scope.staff) return true
      return { context: { in: anyOf(contextIdsWith(scope, 'publish')) } }
    },
  },
  versions: {
    drafts: {
      autosave: { interval: 1500 },
    },
    maxPerDoc: 30,
  },
  hooks: {
    beforeValidate: [applyContext, applyDefaultByline],
    beforeChange: [enforcePublishing, stampPublishedAt, markFirstPublication],
    afterChange: [announceFirstPublication],
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
        description: 'Short summary shown in article lists and on landing pages.',
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
      name: 'context',
      type: 'relationship',
      relationTo: 'contexts',
      required: true,
      admin: {
        position: 'sidebar',
        description: 'Where this is published, e.g. Government › Ministry of Infrastructure. It sets the design and the URL.',
      },
      filterOptions: async ({ req }) => {
        const scope = await getScope(req)
        return scope.staff || !req.user ? true : { id: { in: anyOf(contextIdsWith(scope, 'write')) } }
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ label, value })),
      admin: {
        position: 'sidebar',
        description: 'What kind of text this is. The choices follow the context’s design.',
      },
      // Narrow the menu to the context's design (saved on the article by applyContext).
      filterOptions: ({ data, options }) =>
        isDesign(data?.design)
          ? options.filter((option) =>
              typesOf(data.design).includes((typeof option === 'string' ? option : option.value) as never),
            )
          : options,
    },
    {
      name: 'style',
      type: 'select',
      options: styleOptions('Plain: without its context’s style'),
      admin: {
        position: 'sidebar',
        description:
          'Empty: the style of its context, e.g. GirlieTown’s Cherry Blossom, on its page and wherever it is listed.',
      },
      // Plain, and the open styles of the context's design; context styles come with the context.
      filterOptions: ({ data, options }) =>
        options.filter((option) => {
          const value = typeof option === 'string' ? option : option.value
          return (
            !isStyle(value) ||
            (STYLES[value].open && isDesign(data?.design) && styleSupports(value, data.design))
          )
        }),
    },
    {
      // The context's design, kept current by applyContext; drives the type menu.
      name: 'design',
      type: 'select',
      options: Object.keys(DESIGNS),
      admin: { hidden: true },
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
      // When it first went live, whatever publishedAt says; set by markFirstPublication.
      name: 'announcedAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      defaultValue: ({ user }) => user?.id,
      admin: { position: 'sidebar' },
      access: {
        // Members always write as themselves.
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
          'How the author is credited, e.g. "IPaaat, Co-Leader". Defaults to their first profile for this context; manage profiles under Content → Profiles.',
      },
      // Also enforced on save: Payload validates the value against these options.
      filterOptions: async ({ id, data, user, req }) => {
        const scope = await getScope(req)
        const choices: Where = {
          and: [
            { active: { equals: true } },
            bylineChoices(scope, idOf(data?.author), idOf(data?.context), !user),
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
      name: 'pinned',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Pinned articles lead their context’s landing page ("Documents of State" in the Gazette).',
      },
      access: {
        create: canPublishHere,
        update: canPublishHere,
      },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
      filterOptions: { mimeType: { contains: 'image' } },
    },
    {
      // Ties the paper to Azania Maps: the article shows where it happened,
      // and the town, place or event lists the coverage.
      name: 'locations',
      type: 'relationship',
      relationTo: ['towns', 'places', 'events'],
      hasMany: true,
      label: 'On Azania Maps',
      admin: {
        position: 'sidebar',
        description: 'Towns, places or events this article is about. They link back to it on the map.',
      },
    },
  ],
}
