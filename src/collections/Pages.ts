import {
  type AccessResult,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  ValidationError,
} from 'payload'
import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'

import { can, contextIdsWith, getScope } from '../access/scope'
import { contentBlocks } from '../blocks/config'
import { slugField } from '../fields/slug'
import { livePreview, pagePath, previewButton } from '../lib/preview'

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

/**
 * A page lives at `<context path>/<slug>`, so its slug must be unique among
 * the context's pages and sub-contexts, and the author must be able to
 * publish in the context.
 */
const placeInContext: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const contextId = idOf(data.context ?? originalDoc?.context)
  const slug = data.slug ?? originalDoc?.slug
  const fail = (path: string, message: string) =>
    new ValidationError({ collection: 'pages', errors: [{ path, message }], req })
  const scope = await getScope(req)
  if (req.user && !can(scope, contextId, 'publish')) {
    throw fail('context', 'You need publishing access in that context to keep pages there.')
  }
  if (!contextId || !slug) return data
  if (scope.tree.childrenOf(contextId).some((context) => context.slug === slug)) {
    throw fail('slug', `A sub-context here already uses the URL "${slug}".`)
  }
  if (scope.tree.ancestors(contextId).length === 1 && slug === 'articles') {
    throw fail('slug', '"articles" is reserved for the context’s article archive.')
  }
  const { totalDocs } = await req.payload.count({
    collection: 'pages',
    where: {
      and: [
        { context: { equals: contextId } },
        { slug: { equals: slug } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    req,
  })
  if (totalDocs > 0) throw fail('slug', `Another page here already uses the URL "${slug}".`)
  return data
}

const anyOf = (ids: number[]) => (ids.length ? ids : [-1])

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'context', 'slug', '_status'],
    group: 'Content',
    description: 'Standing pages (About, …), each in a context and served at <context path>/<slug>.',
    livePreview: livePreview(pagePath),
    preview: previewButton(pagePath),
  },
  access: {
    read: async ({ req }): Promise<AccessResult> => {
      if (!req.user) return { _status: { equals: 'published' } }
      const scope = await getScope(req)
      return (
        scope.staff || {
          or: [
            { _status: { equals: 'published' } },
            { context: { in: anyOf(contextIdsWith(scope, 'publish')) } },
          ],
        }
      )
    },
    create: async ({ req }) => contextIdsWith(await getScope(req), 'publish').length > 0,
    update: async ({ req }): Promise<AccessResult> => {
      const scope = await getScope(req)
      return scope.staff || { context: { in: anyOf(contextIdsWith(scope, 'publish')) } }
    },
    delete: async ({ req }): Promise<AccessResult> => {
      const scope = await getScope(req)
      return scope.staff || { context: { in: anyOf(contextIdsWith(scope, 'publish')) } }
    },
  },
  hooks: {
    beforeChange: [placeInContext],
  },
  versions: {
    drafts: {
      autosave: { interval: 1500 },
    },
    maxPerDoc: 30,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
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
    slugField('title', { unique: false }),
    {
      name: 'context',
      type: 'relationship',
      relationTo: 'contexts',
      required: true,
      admin: { position: 'sidebar', description: 'The page appears under this context’s URL.' },
      filterOptions: async ({ req }) => {
        const scope = await getScope(req)
        return scope.staff || !req.user ? true : { id: { in: anyOf(contextIdsWith(scope, 'publish')) } }
      },
    },
  ],
}
