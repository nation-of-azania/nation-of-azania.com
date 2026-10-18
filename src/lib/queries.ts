import config from '@payload-config'
import { draftMode, headers } from 'next/headers'
import { getPayload, type PaginatedDocs, type Where } from 'payload'

import { canUseAdmin } from '@/access/scope'
import type { ArticleType } from '@/contexts/designs'
import type { Article, Page, User } from '@/payload-types'

/**
 * Read-side data access for the public frontend. Every listing returns only
 * PUBLISHED content and swallows database errors (returning empty results)
 * so that `next build` succeeds before the database has been initialized.
 *
 * Articles are scoped by context: callers pass the ids of a context and
 * everything below it (see idsBelow in ./site.ts), so one context's listing
 * never shows another's articles.
 *
 * The slug lookups take a `viewer` while Next.js draft mode is on (live
 * preview, turned on by /preview): they then return the latest draft, read
 * as that person with access control applied, so a preview shows exactly the
 * drafts its viewer may see in the admin.
 */

const getClient = () => getPayload({ config })

const PUBLISHED: Where = { _status: { equals: 'published' } }

export const ARTICLES_PER_PAGE = 9

const inContexts = (ids: number[]): Where => ({ context: { in: ids.length ? ids : [-1] } })

/** Someone previewing drafts; null outside draft mode. */
export type Viewer = User | null

/** The signed-in person previewing drafts, while draft mode is on. */
export async function getViewer(): Promise<Viewer> {
  if (!(await draftMode()).isEnabled) return null
  try {
    const payload = await getClient()
    const { user } = await payload.auth({ headers: await headers() })
    return user && canUseAdmin(user) ? (user as User) : null
  } catch {
    return null
  }
}

/** Options for reading as the viewer: drafts, with their access applied. */
const asViewer = (viewer: Viewer) =>
  viewer ? { draft: true, overrideAccess: false, user: viewer } : { draft: false }

export async function getPinnedArticles(contextIds: number[], limit = 6): Promise<Article[]> {
  try {
    const payload = await getClient()
    const result = await payload.find({
      collection: 'articles',
      where: { and: [PUBLISHED, inContexts(contextIds), { pinned: { equals: true } }] },
      sort: '-publishedAt',
      limit,
      depth: 2,
    })
    return result.docs
  } catch {
    return []
  }
}

export async function getLatestArticles(
  contextIds: number[],
  limit = 6,
  { includePinned = false }: { includePinned?: boolean } = {},
): Promise<Article[]> {
  try {
    const payload = await getClient()
    const result = await payload.find({
      collection: 'articles',
      where: {
        and: [
          PUBLISHED,
          inContexts(contextIds),
          ...(includePinned ? [] : [{ pinned: { not_equals: true } }]),
        ],
      },
      sort: '-publishedAt',
      limit,
      depth: 2,
    })
    return result.docs
  } catch {
    return []
  }
}

export async function getArticlesPage(
  contextIds: number[],
  page = 1,
  { type }: { type?: ArticleType | null } = {},
): Promise<PaginatedDocs<Article> | null> {
  try {
    const payload = await getClient()
    return await payload.find({
      collection: 'articles',
      where: {
        and: [PUBLISHED, inContexts(contextIds), ...(type ? [{ type: { equals: type } }] : [])],
      },
      sort: '-publishedAt',
      page,
      limit: ARTICLES_PER_PAGE,
      depth: 2,
    })
  } catch {
    return null
  }
}

/** The article types in use among a context's published articles. */
export async function getTypesInUse(contextIds: number[]): Promise<Set<string>> {
  try {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'articles',
      where: { and: [PUBLISHED, inContexts(contextIds)] },
      select: { type: true },
      pagination: false,
      depth: 0,
    })
    return new Set(docs.map((doc) => doc.type))
  } catch {
    return new Set()
  }
}

export async function getArticleBySlug(
  contextIds: number[],
  slug: string,
  viewer: Viewer = null,
): Promise<Article | null> {
  try {
    const payload = await getClient()
    const result = await payload.find({
      collection: 'articles',
      where: {
        and: [...(viewer ? [] : [PUBLISHED]), inContexts(contextIds), { slug: { equals: slug } }],
      },
      limit: 1,
      depth: 2,
      ...asViewer(viewer),
    })
    return result.docs[0] ?? null
  } catch {
    return null
  }
}

export async function getPageBySlug(
  contextId: number,
  slug: string,
  viewer: Viewer = null,
): Promise<Page | null> {
  try {
    const payload = await getClient()
    const result = await payload.find({
      collection: 'pages',
      where: {
        and: [
          ...(viewer ? [] : [PUBLISHED]),
          { context: { equals: contextId } },
          { slug: { equals: slug } },
        ],
      },
      limit: 1,
      depth: 2,
      ...asViewer(viewer),
    })
    return result.docs[0] ?? null
  } catch {
    return null
  }
}

/** Every published article and page, as [context id, slug], for static generation. */
export async function getPublishedSlugs(): Promise<{
  articles: { context: number; slug: string }[]
  pages: { context: number; slug: string }[]
}> {
  const idOf = (value: number | { id: number }) => (typeof value === 'number' ? value : value.id)
  try {
    const payload = await getClient()
    const [articles, pages] = await Promise.all(
      (['articles', 'pages'] as const).map((collection) =>
        payload.find({
          collection,
          where: PUBLISHED,
          select: { slug: true, context: true },
          limit: 500,
          depth: 0,
        }),
      ),
    )
    const pairs = (docs: { slug?: string | null; context: number | { id: number } }[]) =>
      docs.flatMap((doc) => (doc.slug ? [{ context: idOf(doc.context), slug: doc.slug }] : []))
    return { articles: pairs(articles.docs), pages: pairs(pages.docs) }
  } catch {
    return { articles: [], pages: [] }
  }
}
