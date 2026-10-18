import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'

import { DESIGN_VIEWS } from '@/components/designs'
import { articleHref } from '@/components/site/format'
import { isDesign, typesOf, type ArticleType } from '@/contexts/designs'
import {
  getArticleBySlug,
  getArticlesPage,
  getLatestArticles,
  getPageBySlug,
  getPinnedArticles,
  getPublishedSlugs,
  getTypesInUse,
  getViewer,
} from '@/lib/queries'
import {
  articleStyle,
  contextStyle,
  designOf,
  getPageLinks,
  getSiteTree,
  idsBelow,
  resolveRoute,
  type Route,
} from '@/lib/site'

/**
 * Every public page below a top-level context, at any depth: its front page,
 * its archive, its articles, its sub-contexts and their standing pages (see
 * resolveRoute in src/lib/site.ts). The context's design renders it.
 */

export const revalidate = 120

type Params = { top: string; rest?: string[] }
type Props = {
  // Next 16: params and searchParams are Promises and must be awaited.
  params: Promise<Params>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateStaticParams(): Promise<Params[]> {
  const tree = await getSiteTree()
  const segmentsOf = (id: number) => tree.pathOf(id).split('/').filter(Boolean)
  const params: Params[] = []
  for (const context of tree.byId.values()) {
    const [top, ...rest] = segmentsOf(context.id)
    params.push({ top, rest })
    if (rest.length === 0) params.push({ top, rest: ['articles'] })
  }
  const { articles, pages } = await getPublishedSlugs()
  for (const { context, slug } of articles) {
    const [top] = segmentsOf(context)
    if (top) params.push({ top, rest: ['articles', slug] })
  }
  for (const { context, slug } of pages) {
    const [top, ...rest] = segmentsOf(context)
    if (top) params.push({ top, rest: [...rest, slug] })
  }
  return params
}

/** The route and its document (article or page), shared by the metadata and the page. */
const load = cache(async (top: string, path: string) => {
  const route = await resolveRoute(top, path ? path.split('/') : [])
  if (!route) return null
  const viewer = await getViewer()
  const tree = await getSiteTree()
  if (route.kind === 'article') {
    const article = await getArticleBySlug(idsBelow(tree, route.top), route.slug, viewer)
    return article ? { route, article, viewer } : null
  }
  if (route.kind === 'page') {
    const page = await getPageBySlug(route.context.id, route.slug, viewer)
    if (page) return { route, page, viewer }
    // Articles once lived at /times/<slug>; send old links to their new home.
    if (route.context.id === route.top.id) {
      const article = await getArticleBySlug(idsBelow(tree, route.top), route.slug)
      if (article) permanentRedirect(articleHref(article))
    }
    return null
  }
  return { route, viewer }
})

const pathOf = (rest?: string[]) => (rest ?? []).map(decodeURIComponent).join('/')

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { top, rest } = await params
  const loaded = await load(top, pathOf(rest))
  if (!loaded) return { title: 'Not found' }
  const { route } = loaded
  if ('article' in loaded && loaded.article) {
    return { title: loaded.article.title, description: loaded.article.excerpt ?? undefined }
  }
  if ('page' in loaded && loaded.page) return { title: loaded.page.title }
  return titleOf(route)
}

function titleOf(route: Route): Metadata {
  switch (route.kind) {
    case 'home':
      return { title: { absolute: route.top.name }, description: route.top.tagline ?? undefined }
    case 'archive':
      return { title: `Archive · ${route.top.name}` }
    case 'section':
      return { title: route.context.label ?? route.context.name, description: route.context.tagline ?? undefined }
    default:
      return {}
  }
}

const firstOf = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function ContextRoute({ params, searchParams }: Props) {
  const { top, rest } = await params
  const loaded = await load(top, pathOf(rest))
  if (!loaded) notFound()

  const { route, viewer } = loaded
  const tree = await getSiteTree()
  const design = designOf(route.top)
  const views = DESIGN_VIEWS[design]
  const draft = Boolean(viewer)

  if ('article' in loaded && loaded.article) {
    const context = loaded.article.context
    const chain = tree.ancestors(typeof context === 'number' ? context : context.id)
    return (
      <views.Article
        article={loaded.article}
        chain={chain}
        style={articleStyle(tree, loaded.article)}
        draft={draft}
      />
    )
  }
  if ('page' in loaded && loaded.page && route.kind === 'page') {
    return <views.Page page={loaded.page} chain={route.chain} draft={draft} />
  }

  switch (route.kind) {
    case 'home': {
      const ids = idsBelow(tree, route.top)
      const [pinned, latest, pages] = await Promise.all([
        getPinnedArticles(ids, 4),
        getLatestArticles(ids, 9),
        getPageLinks(route.top),
      ])
      const sections = tree.childrenOf(route.top.id).filter((child) => child.listed !== false)
      return <views.Home top={route.top} sections={sections} pages={pages} pinned={pinned} latest={latest} />
    }
    case 'section': {
      const ids = idsBelow(tree, route.context)
      const [pinned, latest, pages] = await Promise.all([
        getPinnedArticles(ids, 4),
        getLatestArticles(ids, 12),
        getPageLinks(route.context),
      ])
      const subContexts = tree
        .childrenOf(route.context.id)
        .filter((child) => child.listed !== false)
      return (
        <views.Section
          context={route.context}
          chain={route.chain}
          style={contextStyle(tree, route.context)}
          subContexts={subContexts}
          pages={pages}
          pinned={pinned}
          latest={latest}
        />
      )
    }
    case 'archive': {
      const query = await searchParams
      const page = Math.max(1, Number.parseInt(firstOf(query.page) ?? '', 10) || 1)
      const requested = firstOf(query.type)
      const designTypes = isDesign(design) ? typesOf(design) : []
      const type = designTypes.includes(requested as ArticleType) ? (requested as ArticleType) : null
      const ids = idsBelow(tree, route.top)
      const [result, inUse] = await Promise.all([
        getArticlesPage(ids, page, { type }),
        getTypesInUse(ids),
      ])
      const types = designTypes.filter((candidate) => inUse.has(candidate))
      return <views.Archive top={route.top} result={result} page={page} type={type} types={types} />
    }
    default:
      notFound()
  }
}
