import { getPayload, type PaginatedDocs } from 'payload'
import config from '@payload-config'

import type { Article, Page } from '@/payload-types'

/**
 * Read-side data access for the public frontend. Every helper returns only
 * PUBLISHED content and swallows database errors (returning empty results) so
 * that `next build` succeeds even before the database has been initialized.
 *
 * Articles belong to one of two publications, selected by `section`:
 *  - 'government' — the state Gazette, served under /gov
 *  - 'times'      — the independent Condor Times, served under /times
 * Every article query is scoped to a section so the two sites never bleed
 * into each other.
 */

const getClient = () => getPayload({ config })

const PUBLISHED = { _status: { equals: 'published' as const } }

export const ARTICLES_PER_PAGE = 9

export type Section = 'government' | 'times'

const inSection = (section: Section) => ({ section: { equals: section } })

export async function getPinnedArticles(section: Section, limit = 6): Promise<Article[]> {
  try {
    const payload = await getClient()
    const result = await payload.find({
      collection: 'articles',
      where: { and: [PUBLISHED, inSection(section), { pinned: { equals: true } }] },
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
  section: Section,
  limit = 6,
  { includePinned = false }: { includePinned?: boolean } = {},
): Promise<Article[]> {
  try {
    const payload = await getClient()
    const where = includePinned
      ? { and: [PUBLISHED, inSection(section)] }
      : { and: [PUBLISHED, inSection(section), { pinned: { not_equals: true } }] }
    const result = await payload.find({
      collection: 'articles',
      where,
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
  section: Section,
  page = 1,
): Promise<PaginatedDocs<Article> | null> {
  try {
    const payload = await getClient()
    return await payload.find({
      collection: 'articles',
      where: { and: [PUBLISHED, inSection(section)] },
      sort: '-publishedAt',
      page,
      limit: ARTICLES_PER_PAGE,
      depth: 2,
    })
  } catch {
    return null
  }
}

export async function getArticleBySlug(section: Section, slug: string): Promise<Article | null> {
  try {
    const payload = await getClient()
    const result = await payload.find({
      collection: 'articles',
      where: { and: [PUBLISHED, inSection(section), { slug: { equals: slug } }] },
      limit: 1,
      depth: 2,
    })
    return result.docs[0] ?? null
  } catch {
    return null
  }
}

export async function getAllArticleSlugs(section: Section): Promise<string[]> {
  try {
    const payload = await getClient()
    const result = await payload.find({
      collection: 'articles',
      where: { and: [PUBLISHED, inSection(section)] },
      limit: 200,
      select: { slug: true },
    })
    return result.docs.map((doc) => doc.slug).filter((slug): slug is string => Boolean(slug))
  } catch {
    return []
  }
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  try {
    const payload = await getClient()
    const result = await payload.find({
      collection: 'pages',
      where: { and: [PUBLISHED, { slug: { equals: slug } }] },
      limit: 1,
      depth: 2,
    })
    return result.docs[0] ?? null
  } catch {
    return null
  }
}

export async function getAllPageSlugs(): Promise<string[]> {
  try {
    const payload = await getClient()
    const result = await payload.find({
      collection: 'pages',
      where: PUBLISHED,
      limit: 200,
      select: { slug: true },
    })
    return result.docs.map((doc) => doc.slug).filter((slug): slug is string => Boolean(slug))
  } catch {
    return []
  }
}
