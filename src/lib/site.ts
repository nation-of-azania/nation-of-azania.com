import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import { isAccent, isDesign, type Accent, type Design } from '@/contexts/designs'
import { styleOfArticle, styleOfChain, type StyleId } from '@/contexts/styles'
import { buildTree, type ContextTree } from '@/contexts/tree'
import type { Article, Context, Media } from '@/payload-types'

/**
 * The site's shape, read from the context tree. Every public URL starts with
 * a top-level context, whose design dresses everything below it:
 *
 *   /<top>                        the context's front page
 *   /<top>/articles               its archive (?type=… filters, ?page=…)
 *   /<top>/articles/<slug>        an article anywhere below <top>
 *   /<top>/<sub>/<sub>/…          a sub-context, as deep as the tree goes
 *   /<context path>/<slug>        a standing page in that context
 *
 * Contexts are few, so the whole tree is loaded once per render (React
 * `cache`) and walked in memory. Database errors give an empty tree, so
 * `next build` succeeds before the database exists.
 */

export type SiteTree = ContextTree<Context>

export const getSiteTree = cache(async (): Promise<SiteTree> => {
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'contexts',
      pagination: false,
      depth: 1,
      joins: false,
      sort: 'order',
    })
    return buildTree(docs)
  } catch {
    return buildTree<Context>([])
  }
})

/** The design a context is dressed in: its top-level context's. */
export const designOf = (context: Pick<Context, 'design'>): Design =>
  isDesign(context.design) ? context.design : 'gazette'

export const contextHref = (context: Pick<Context, 'path'>): string => context.path || '/'

/** The top-level context's archive, optionally filtered by type; page 1 keeps a clean URL. */
export const archiveHref = (
  top: Pick<Context, 'slug'>,
  type?: string | null,
  page = 1,
): string => {
  const query = new URLSearchParams()
  if (type) query.set('type', type)
  if (page > 1) query.set('page', String(page))
  const search = query.toString()
  return `/${top.slug}/articles${search ? `?${search}` : ''}`
}

/** The top-level context above (or at) a context. */
export const topOf = (tree: SiteTree, context: Context): Context =>
  tree.ancestors(context.id)[0] ?? context

/**
 * The accent in force at the end of a chain (top-level context first): the
 * context's own, else the nearest ancestor's; null when none is set anywhere
 * above it, so each design falls back to its own colour.
 */
export function accentOf(chain: Pick<Context, 'accent'>[]): Accent | null {
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const accent = chain[index].accent
    if (isAccent(accent)) return accent
  }
  return null
}

/**
 * The emblem shown at the end of a chain: the context's own upload, else the
 * nearest ancestor's. Only populated images count (the tree is loaded at
 * depth 1, so emblems arrive as Media); media also accepts models and audio.
 */
export function emblemOf(chain: Pick<Context, 'emblem'>[]): Media | null {
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const emblem = chain[index].emblem
    if (emblem && typeof emblem === 'object' && (emblem.mimeType ?? 'image/').startsWith('image/')) {
      return emblem
    }
  }
  return null
}

/** The style a context wears, its own or inherited; null for its design's plain look. */
export const contextStyle = (tree: SiteTree, context: Pick<Context, 'id'>): StyleId | null =>
  styleOfChain(tree.ancestors(context.id), tree.designOf(context.id))

/**
 * The style an article wears, on its own page and wherever it is listed: its
 * context's, unless the article is set to Plain (src/contexts/styles.ts).
 */
export function articleStyle(
  tree: SiteTree,
  article: Pick<Article, 'style' | 'context'>,
): StyleId | null {
  const contextId = typeof article.context === 'number' ? article.context : article.context?.id
  if (contextId == null) return null
  return styleOfArticle(article, tree.ancestors(contextId), tree.designOf(contextId))
}

/** Ids of the context and everything below it: what its listings show. */
export const idsBelow = (tree: SiteTree, context: Context): number[] =>
  tree.descendants(context.id).map((record) => record.id)

export type NavLink = {
  href: string
  label: string
  /** A section's accent, inherited (see accentOf), for a swatch beside its name. */
  accent?: Accent | null
}

/** What a design's chrome needs to link around. */
export type SiteNav = {
  /** The top-level context the visitor is in. */
  top: Context
  /** Its listed sub-contexts, in order. */
  sections: NavLink[]
  /** Its standing pages (About, …). */
  pages: NavLink[]
  /** The other listed top-level contexts, for crossing over. */
  elsewhere: (NavLink & { design: Design })[]
}

/** The listed sub-contexts of a context, as links. */
export const sectionsOf = (tree: SiteTree, context: Context): NavLink[] =>
  tree
    .childrenOf(context.id)
    .filter((child) => child.listed !== false)
    .map((child) => ({
      href: contextHref(child),
      label: child.name,
      accent: accentOf(tree.ancestors(child.id)),
    }))

export const getSiteNav = cache(async (top: Context): Promise<SiteNav> => {
  const tree = await getSiteTree()
  return {
    top,
    sections: sectionsOf(tree, top),
    pages: await getPageLinks(top),
    elsewhere: tree.roots
      .filter((root) => root.id !== top.id && root.listed !== false)
      .map((root) => ({ href: contextHref(root), label: root.name, design: designOf(root) })),
  }
})

/** Published standing pages directly in a context, as links. */
export async function getPageLinks(context: Context): Promise<NavLink[]> {
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'pages',
      where: {
        and: [{ _status: { equals: 'published' } }, { context: { equals: context.id } }],
      },
      select: { title: true, slug: true },
      sort: 'title',
      pagination: false,
      depth: 0,
    })
    return docs.map((page) => ({ href: `${contextHref(context)}/${page.slug}`, label: page.title }))
  } catch {
    return []
  }
}

/** Where `/` leads: the first listed top-level context. */
export async function getHomePath(): Promise<string | null> {
  const tree = await getSiteTree()
  const first = tree.roots.find((root) => root.listed !== false) ?? tree.roots[0]
  return first ? contextHref(first) : null
}

/** What a URL under a top-level context points to, before anything is fetched. */
export type Route =
  | { kind: 'home'; top: Context }
  | { kind: 'archive'; top: Context }
  | { kind: 'article'; top: Context; slug: string }
  | { kind: 'section'; top: Context; context: Context; chain: Context[] }
  /** A standing page — or, directly under the top, an article's old short URL. */
  | { kind: 'page'; top: Context; context: Context; chain: Context[]; slug: string }

/** Resolves /<top>/<…rest> against the context tree; null when nothing can live there. */
export async function resolveRoute(topSlug: string, rest: string[] = []): Promise<Route | null> {
  const tree = await getSiteTree()
  const top = tree.roots.find((root) => root.slug === topSlug)
  if (!top) return null
  if (rest.length === 0) return { kind: 'home', top }
  if (rest[0] === 'articles') {
    if (rest.length === 1) return { kind: 'archive', top }
    if (rest.length === 2) return { kind: 'article', top, slug: rest[1] }
    return null
  }

  let context = top
  for (const [index, segment] of rest.entries()) {
    const child = tree.childrenOf(context.id).find((candidate) => candidate.slug === segment)
    if (child) {
      context = child
      continue
    }
    if (index !== rest.length - 1) return null
    return { kind: 'page', top, context, chain: tree.ancestors(context.id), slug: segment }
  }
  return { kind: 'section', top, context, chain: tree.ancestors(context.id) }
}
