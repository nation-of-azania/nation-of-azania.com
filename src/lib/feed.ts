import { cardImageFor, CARD } from '@/components/og'
import { articleHref, resolveByline, resolveImage, typeLabel } from '@/components/site/format'
import type { Design } from '@/contexts/designs'
import type { StyleId } from '@/contexts/styles'
import type { Article, Context } from '@/payload-types'

import { absoluteUrl, contentHtml, escapeHtml } from './feedHtml'
import { getLatestArticles } from './queries'
import {
  articleStyle,
  contextHref,
  contextStyle,
  designOf,
  emblemOf,
  feedHref,
  feedTitle,
  getSiteTree,
  idsBelow,
  resolveRoute,
  SITE_FEED_HREF,
  SITE_FEED_TITLE,
  type SiteTree,
} from './site'

/**
 * RSS feeds, one per context and one for the whole site, served by
 * src/app/(frontend)/feeds. A context's feed carries its articles and those
 * of everything below it, published only, newest first, the way its page
 * lists them: /gov/feed.xml is the whole Gazette, /gov/girlietown/feed.xml
 * the town's record in it, /feed.xml everything the nation publishes.
 *
 * Each item is the article as a reader elsewhere would want it: title,
 * permalink, first publication date, the byline's name (never an address;
 * accounts have none), its type and context as categories, the excerpt,
 * the full text as HTML (./feedHtml.ts) and the link-preview card from
 * /og as the item's picture, so a Discord RSS bot unfurls it as a paste of
 * the link would. The channel names the paper, carries its emblem, and
 * says which design and style it wears, for the stylesheet that dresses
 * the feed in a browser (public/feed.xsl).
 */

/** How many articles a feed carries. */
export const FEED_LIMIT = 30

/** The extension namespace the feed's own elements live in (design and style, for the stylesheet). */
export const FEED_NAMESPACE = 'urn:azania:feed'

export type FeedScope =
  | { kind: 'site' }
  | { kind: 'context'; context: Context; chain: Context[]; top: Context }

/** What /feeds/<…path> covers: nothing for the site, a context's path for its feed; null for anything else. */
export async function resolveFeed(segments: string[]): Promise<FeedScope | null> {
  if (segments.length === 0) return { kind: 'site' }
  const [top, ...rest] = segments
  const route = await resolveRoute(top, rest)
  if (!route) return null
  if (route.kind === 'home') return { kind: 'context', context: route.top, chain: [route.top], top: route.top }
  if (route.kind === 'section') return { kind: 'context', context: route.context, chain: route.chain, top: route.top }
  return null
}

/** The feed as an XML document. */
export async function buildFeed(scope: FeedScope, origin: string): Promise<string> {
  const tree = await getSiteTree()
  const ids =
    scope.kind === 'site' ? [...tree.byId.keys()] : idsBelow(tree, scope.context)
  const articles = await getLatestArticles(ids, FEED_LIMIT, { includePinned: true })
  const channel = channelOf(scope, tree, origin)
  const items = articles.map((article) => itemOf(article, tree, origin))
  const newest = articles
    .map((article) => Date.parse(article.updatedAt))
    .filter((stamp) => !Number.isNaN(stamp))
  const lastBuild = new Date(newest.length ? Math.max(...newest) : Date.now())

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>',
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:azania="${FEED_NAMESPACE}">`,
    '  <channel>',
    `    <title>${text(channel.title)}</title>`,
    `    <link>${text(channel.link)}</link>`,
    `    <description>${text(channel.description)}</description>`,
    `    <atom:link rel="self" type="application/rss+xml" href="${attr(channel.self)}" />`,
    '    <language>en</language>',
    `    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`,
    '    <generator>Azania CMS</generator>',
    '    <docs>https://www.rssboard.org/rss-specification</docs>',
    '    <image>',
    `      <url>${text(channel.image.url)}</url>`,
    `      <title>${text(channel.title)}</title>`,
    `      <link>${text(channel.link)}</link>`,
    `      <width>${channel.image.width}</width>`,
    `      <height>${channel.image.height}</height>`,
    '    </image>',
    ...(channel.design ? [`    <azania:design>${channel.design}</azania:design>`] : []),
    ...(channel.style ? [`    <azania:style>${channel.style}</azania:style>`] : []),
    ...items.map(itemXml),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

type Channel = {
  title: string
  link: string
  description: string
  self: string
  image: { url: string; width: number; height: number }
  design: Design | null
  style: StyleId | null
}

/** What each design's feeds say about themselves when a context has no tagline. */
const BLURBS: Record<Design, { top: string; below: (name: string, top: string) => string }> = {
  gazette: {
    top: 'The official record of the Nation of Azania: decrees, dispatches and documents of state.',
    below: (name) => `Dispatches and documents from ${name}, an office of the Nation of Azania.`,
  },
  times: {
    top: 'The independent paper of the Azanian coast.',
    below: (name, top) => `Stories from the ${name} desk of ${top}.`,
  },
  international: {
    top: 'Standards, resolutions and reports among nations, hosted by Azania.',
    below: (name) => `Records entered under ${name}.`,
  },
}

function channelOf(scope: FeedScope, tree: SiteTree, origin: string): Channel {
  if (scope.kind === 'site') {
    const papers = tree.roots.filter((root) => root.listed !== false).map((root) => root.name)
    const listed =
      papers.length > 1 ? `${papers.slice(0, -1).join(', ')} and ${papers[papers.length - 1]}` : papers[0]
    return {
      title: SITE_FEED_TITLE,
      link: absoluteUrl('/', origin),
      description: `Everything published by the Nation of Azania on the Rulercraft realm${listed ? `: ${listed}` : ''}.`,
      self: absoluteUrl(SITE_FEED_HREF, origin),
      image: { url: absoluteUrl('/og/azania', origin), ...CARD },
      design: null,
      style: null,
    }
  }

  const { context, chain, top } = scope
  const design = designOf(top)
  const atTop = context.id === top.id
  const blurb = BLURBS[design]
  const emblem = resolveImage(emblemOf(chain), 'thumbnail')
  return {
    title: feedTitle(context, top),
    link: absoluteUrl(contextHref(context), origin),
    description: context.tagline || (atTop ? blurb.top : blurb.below(context.name, top.name)),
    self: absoluteUrl(feedHref(context), origin),
    image: emblem
      ? { url: absoluteUrl(emblem.url, origin), width: emblem.width, height: emblem.height }
      : { url: absoluteUrl(`/og${contextHref(context)}`, origin), ...CARD },
    design,
    style: contextStyle(tree, context),
  }
}

type Item = {
  title: string
  link: string
  pubDate: string
  creator: string | null
  categories: { label: string; domain?: string }[]
  description: string | null
  content: string
  card: { url: string; width: number; height: number }
  thumbnail: string | null
}

function itemOf(article: Article, tree: SiteTree, origin: string): Item {
  const contextId = typeof article.context === 'number' ? article.context : article.context.id
  const chain = tree.ancestors(contextId)
  const top = chain[0]
  const context = chain[chain.length - 1]
  const path = articleHref(article)
  const link = absoluteUrl(path, origin)
  const byline = resolveByline(article)
  const hero = resolveImage(article.featuredImage, 'hero')

  const body = contentHtml(article.content, {
    origin,
    design: tree.designOf(contextId),
    style: articleStyle(tree, article),
    articleUrl: link,
    topSlug: top?.slug ?? '',
  })
  const picture = hero
    ? `<figure><img src="${escapeHtml(absoluteUrl(hero.url, origin))}" alt="${escapeHtml(hero.alt)}" width="${hero.width}" height="${hero.height}" />${hero.alt ? `<figcaption>${escapeHtml(hero.alt)}</figcaption>` : ''}</figure>`
    : ''
  const excerpt = article.excerpt?.trim() || null

  const categories: Item['categories'] = [{ label: typeLabel(article) }]
  if (context) categories.push({ label: context.name, domain: absoluteUrl(contextHref(context), origin) })
  if (top && context && top.id !== context.id) {
    categories.push({ label: top.name, domain: absoluteUrl(contextHref(top), origin) })
  }

  const card = cardImageFor(path, article.updatedAt)
  const thumbnail = resolveImage(article.featuredImage, 'card')
  return {
    title: article.title,
    link,
    pubDate: new Date(article.publishedAt ?? article.createdAt).toUTCString(),
    creator: byline?.name ?? null,
    categories: categories.filter((category) => category.label),
    // Without an excerpt, the opening of the text stands in, so no item reads blank.
    description: excerpt ?? snippet(body),
    content: picture + body,
    card: { ...card, url: absoluteUrl(card.url, origin) },
    thumbnail: thumbnail ? absoluteUrl(thumbnail.url, origin) : null,
  }
}

function itemXml(item: Item): string {
  return [
    '    <item>',
    `      <title>${text(item.title)}</title>`,
    `      <link>${text(item.link)}</link>`,
    `      <guid isPermaLink="true">${text(item.link)}</guid>`,
    `      <pubDate>${item.pubDate}</pubDate>`,
    ...(item.creator ? [`      <dc:creator>${text(item.creator)}</dc:creator>`] : []),
    ...item.categories.map(
      (category) =>
        `      <category${category.domain ? ` domain="${attr(category.domain)}"` : ''}>${text(category.label)}</category>`,
    ),
    ...(item.description ? [`      <description>${text(item.description)}</description>`] : []),
    ...(item.content ? [`      <content:encoded>${text(item.content)}</content:encoded>`] : []),
    `      <media:content url="${attr(item.card.url)}" type="image/png" medium="image" width="${item.card.width}" height="${item.card.height}" />`,
    ...(item.thumbnail ? [`      <media:thumbnail url="${attr(item.thumbnail)}" />`] : []),
    '    </item>',
  ].join('\n')
}

/** The first words of a piece of HTML as plain text, for an item without an excerpt. */
function snippet(html: string, max = 280): string | null {
  const plain = html
    .replace(/<figure[\s\S]*?<\/figure>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return null
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).trimEnd()}…`
}

/** Characters XML 1.0 can't carry, whatever an editor pasted. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

/** Text for an element's content. */
const text = (value: string): string => escapeHtml(value.replace(CONTROL, ''))

/** Text for an attribute value. */
const attr = text
