import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
  type FieldAccess,
  ValidationError,
} from 'payload'

import { can, contextIdsWith, forgetScope, getScope, loadContextTree, NOTHING } from '../access/scope'
import { DESIGNS } from '../contexts/designs'
import { isStyle, STYLES, styleOptions, styleSupports } from '../contexts/styles'
import { parentIdOf } from '../contexts/tree'
import { slugify } from '../fields/slug'

/**
 * Contexts: where an article is published and who speaks. A tree of any
 * depth, e.g. Government › Ministry of Infrastructure, or International ›
 * Transport Catalogue › Road Initiative › Case Studies. Each top-level context
 * picks a design; everything below inherits it, and can carry its own emblem,
 * style, tagline and introduction. Access is granted per context on Users.
 */

/** URL segments a top-level context can't take: routes the site already uses. */
const RESERVED_TOP_SLUGS = new Set(['admin', 'api', 'account', 'login', 'preview', 'og', 'mapclip', 'litematic', 'media', 'next', '_next'])
/** `/<top>/articles/…` is each top-level context's article archive. */
const RESERVED_SECOND_SLUGS = new Set(['articles'])

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

const adminOnly: FieldAccess = ({ req }) => req.user?.role === 'admin'

const fail = (path: string, message: string, req: Parameters<CollectionBeforeChangeHook>[0]['req']) =>
  new ValidationError({ collection: 'contexts', errors: [{ path, message }], req })

/**
 * Validates the context's place in the tree (no cycles, unique slugs among
 * siblings, no reserved URL segments, members only below what they manage)
 * and computes its stored `path` and breadcrumb `label`.
 */
const placeInTree: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  const id = idOf(originalDoc?.id)
  const name = String(data.name ?? originalDoc?.name ?? '')
  const slug = slugify(String(data.slug || name))
  const parentId = idOf(data.parent !== undefined ? data.parent : originalDoc?.parent) ?? null
  data.slug = slug

  const tree = await loadContextTree(req)
  if (parentId != null) {
    if (!tree.byId.has(parentId)) throw fail('parent', 'That parent context no longer exists.', req)
    if (id != null && tree.ancestors(parentId).some((context) => context.id === id)) {
      throw fail('parent', 'A context can’t be placed inside itself or one of its own sub-contexts.', req)
    }
  }

  const siblings = tree.childrenOf(parentId).filter((context) => context.id !== id)
  if (siblings.some((context) => context.slug === slug)) {
    throw fail('slug', `Another context here already uses the URL "${slug}".`, req)
  }
  const level = parentId == null ? 1 : tree.ancestors(parentId).length + 1
  if ((level === 1 && RESERVED_TOP_SLUGS.has(slug)) || (level === 2 && RESERVED_SECOND_SLUGS.has(slug))) {
    throw fail('slug', `"${slug}" is reserved for the site’s own pages; choose another URL.`, req)
  }
  const { totalDocs: clashingPages } = await req.payload.count({
    collection: 'pages',
    where: parentId == null ? { id: { equals: -1 } } : { and: [{ context: { equals: parentId } }, { slug: { equals: slug } }] },
    req,
  })
  if (clashingPages > 0) throw fail('slug', `A page here already uses the URL "${slug}".`, req)

  const scope = await getScope(req)
  // On create Payload passes an empty originalDoc, so ask the operation.
  const placed = operation === 'create' || (idOf(originalDoc?.parent) ?? null) !== parentId
  if (req.user && !scope.admin && placed) {
    // Members with Manage can create and move contexts only below what they were granted.
    if (parentId == null || !can(scope, parentId, 'manage')) {
      throw fail('parent', 'Choose a parent context you manage.', req)
    }
  }

  if (parentId == null) {
    data.design ||= originalDoc?.design || 'gazette'
  } else {
    data.design = null
  }
  const style = data.style !== undefined ? data.style : originalDoc?.style
  const design = parentId == null ? data.design : tree.designOf(parentId)
  if (isStyle(style) && !styleSupports(style, design)) {
    throw fail('style', `${STYLES[style].label} has no ${DESIGNS[design as keyof typeof DESIGNS].label.split(':')[0]} variant, so it can’t be used here.`, req)
  }
  const parentChain = parentId == null ? [] : tree.ancestors(parentId)
  data.path = `/${[...parentChain.map((context) => context.slug), slug].join('/')}`
  data.label = [...parentChain.map((context) => context.name), name].join(' › ')
  return data
}

/** A renamed or moved context passes its new path and label down the tree. */
const cascadeToChildren: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (previousDoc && previousDoc.path === doc.path && previousDoc.label === doc.label) return doc
  const { docs: children } = await req.payload.find({
    collection: 'contexts',
    where: { parent: { equals: doc.id } },
    limit: 0,
    depth: 0,
    req,
  })
  for (const child of children) {
    await req.payload.update({ collection: 'contexts', id: child.id, data: {}, depth: 0, req })
  }
  return doc
}

/**
 * Contexts that still hold anything can't be deleted: move or delete their
 * contents first. Access grants and Discord channels that name the context
 * count too, since they would otherwise point at nothing.
 */
const refuseNonEmpty: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const where = { context: { equals: id } }
  const [children, articles, pages, grants, discord] = await Promise.all([
    req.payload.count({ collection: 'contexts', where: { parent: { equals: id } }, req }),
    req.payload.count({ collection: 'articles', where, req }),
    req.payload.count({ collection: 'pages', where, req }),
    req.payload.count({ collection: 'users', where: { 'contextAccess.context': { equals: id } }, req }),
    req.payload.findGlobal({ slug: 'discord', depth: 0, req }).catch(() => null),
  ])
  if (children.totalDocs + articles.totalDocs + pages.totalDocs > 0) {
    throw new APIError(
      `This context still holds ${children.totalDocs} sub-context(s), ${articles.totalDocs} article(s) and ${pages.totalDocs} page(s). Move or delete them first.`,
      400,
    )
  }
  if (grants.totalDocs > 0) {
    throw new APIError(
      `${grants.totalDocs} account(s) have access granted to this context. Remove those grants under Users first.`,
      400,
    )
  }
  const channelId = (channel: { context?: unknown }) =>
    typeof channel.context === 'object' ? (channel.context as { id?: unknown } | null)?.id : channel.context
  if ((discord?.channels ?? []).some((channel) => String(channelId(channel)) === String(id))) {
    throw new APIError('A Discord channel is set for this context. Remove it under Settings → Discord first.', 400)
  }
}

export const Contexts: CollectionConfig = {
  slug: 'contexts',
  labels: { singular: 'Context', plural: 'Contexts' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'design', 'listed', 'path'],
    group: 'Content',
    description:
      'Where articles are published and who speaks: Government and its ministries, the Times and its desks, international initiatives. Nest them as deep as needed; access is granted per context under Users.',
  },
  access: {
    read: () => true,
    create: async ({ req }) => {
      const scope = await getScope(req)
      return scope.admin || contextIdsWith(scope, 'manage').length > 0
    },
    update: async ({ req }) => {
      const scope = await getScope(req)
      if (scope.admin) return true
      const ids = contextIdsWith(scope, 'manage')
      return ids.length ? { id: { in: ids } } : NOTHING
    },
    delete: async ({ req }) => {
      const scope = await getScope(req)
      if (scope.admin) return true
      // Members may delete what they built below their grant, never the grant itself.
      const ids = contextIdsWith(scope, 'manage').filter((id) => !scope.grantRoots.has(id))
      return ids.length ? { id: { in: ids } } : NOTHING
    },
  },
  hooks: {
    beforeChange: [placeInTree],
    // The tree changed: whatever this request does next must see the new one.
    afterChange: [
      ({ doc, req }) => {
        forgetScope(req)
        return doc
      },
      cascadeToChildren,
    ],
    beforeDelete: [refuseNonEmpty],
    afterDelete: [
      ({ doc, req }) => {
        forgetScope(req)
        return doc
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'The URL segment. Leave empty to generate from the name; unique among siblings.',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'contexts',
      admin: {
        position: 'sidebar',
        description: 'Empty for a top-level context. Sub-contexts inherit the design and, unless set below, the emblem and style.',
      },
      filterOptions: async ({ id, req }) => {
        const scope = await getScope(req)
        const excluded = id ? scope.tree.descendants(Number(id)).map((context) => context.id) : []
        // Members pick among what they manage, plus where the context already
        // sits (a granted context's own parent lies outside the grant).
        const saved = id ? scope.tree.byId.get(Number(id)) : undefined
        const current = saved ? parentIdOf(saved) : null
        const allowed =
          scope.admin || !req.user
            ? null
            : [...contextIdsWith(scope, 'manage'), ...(current != null ? [current] : [])]
        return {
          and: [
            ...(excluded.length ? [{ id: { not_in: excluded } }] : []),
            ...(allowed ? [{ id: { in: allowed.length ? allowed : [-1] } }] : []),
          ],
        }
      },
    },
    {
      name: 'design',
      type: 'select',
      options: Object.entries(DESIGNS).map(([value, design]) => ({ label: design.label, value })),
      access: { create: adminOnly, update: adminOnly },
      admin: {
        position: 'sidebar',
        description: 'The look of this context and everything inside it. Top-level contexts only.',
        condition: (_, siblingData) => !siblingData?.parent,
      },
    },
    {
      name: 'tagline',
      type: 'text',
      admin: { description: 'One line under the name, e.g. "Standards for building roads across member nations".' },
    },
    {
      name: 'intro',
      type: 'richText',
      admin: { description: 'Introduces the context on its landing page.' },
    },
    {
      name: 'emblem',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { mimeType: { contains: 'image' } },
      admin: { description: 'Optional. Sub-contexts without one show the nearest emblem above them.' },
    },
    {
      // Styles are code (src/contexts/styles.ts); which context wears one is an admin's call.
      name: 'style',
      type: 'select',
      options: styleOptions('Plain: don’t inherit a style'),
      access: { create: adminOnly, update: adminOnly },
      admin: {
        position: 'sidebar',
        description:
          'A hand-made look worn by this context, its articles and everything below it, e.g. GirlieTown’s Cherry Blossom. Empty: inherit from above.',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: { position: 'sidebar', description: 'Lower numbers come first among siblings.' },
    },
    {
      name: 'listed',
      type: 'checkbox',
      label: 'Show in navigation',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Unlisted contexts stay reachable by URL but are left out of menus.',
      },
    },
    {
      name: 'subContexts',
      type: 'join',
      collection: 'contexts',
      on: 'parent',
      admin: { defaultColumns: ['name', 'listed'] },
    },
    {
      name: 'articles',
      type: 'join',
      collection: 'articles',
      on: 'context',
      admin: { defaultColumns: ['title', 'type', '_status', 'publishedAt'] },
    },
    // Computed in placeInTree, kept current for every descendant by cascadeToChildren.
    { name: 'path', type: 'text', index: true, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'label', type: 'text', admin: { hidden: true } },
  ],
}
