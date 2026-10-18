import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

import { recordRef } from '@/components/intl/IntlRecord'
import type { ArticleCard, Card, CardByline, CardContext, PlaceCard, PlaceKind } from '@/components/og/model'
import { HEAD_PX, PICTURE } from '@/components/og/tokens'
import {
  bylineInitials,
  formatDate,
  isStateDocument,
  kickerOf,
  resolveByline,
  resolveImage,
  typeLabel,
  type ResolvedByline,
} from '@/components/site/format'
import type { Design } from '@/contexts/designs'
import type { Context, Media } from '@/payload-types'

import { getArticleBySlug, getPageBySlug } from './queries'
import {
  articleStyle,
  contextStyle,
  designOf,
  emblemOf,
  getSiteTree,
  idsBelow,
  resolveRoute,
  type SiteTree,
} from './site'

/**
 * Builds the link-preview card for a public path (src/components/og): the
 * same route resolution and queries as the page, reduced to what the card
 * shows, with every picture fetched here — the player's head from the skin
 * service, the featured image and emblem from Blob (or the local upload
 * folder) — and cropped to the size it is drawn at, as data URIs. Each
 * fetch has a short timeout and a quiet fallback, so a slow image never
 * costs a card; `complete` says whether any fell back, so the route can
 * cache such a card for less long.
 */
export type Loaded = { card: Card; complete: boolean }

const GENERIC: Loaded = { card: { kind: 'generic' }, complete: true }

const FETCH_TIMEOUT_MS = 2500

/** Where local uploads live (src/collections/Media.ts): read straight from disk in development. */
const MEDIA_DIR = path.resolve(process.cwd(), 'media')

export async function loadCard(segments: string[], origin: string): Promise<Loaded> {
  const [top, ...rest] = segments
  if (!top) return GENERIC
  const route = await resolveRoute(top, rest)
  if (!route) return GENERIC
  const tree = await getSiteTree()
  const design = designOf(route.top)
  const pictures = new Pictures(origin)

  if (route.kind === 'article') {
    const article = await getArticleBySlug(idsBelow(tree, route.top), route.slug)
    if (!article) return GENERIC
    const contextId = typeof article.context === 'number' ? article.context : article.context.id
    const chain = tree.ancestors(contextId)
    const { section, type, parts } = kickerOf(article)
    const dateTime = article.publishedAt ?? article.createdAt
    const year = new Date(dateTime).getFullYear()
    // A document of state is set as an instrument, without its picture.
    const illustrated = !(design === 'gazette' && isStateDocument(article))
    const [byline, image] = await Promise.all([
      pictures.byline(resolveByline(article)),
      illustrated ? pictures.featured(article.featuredImage, PICTURE[design]) : null,
    ])
    const card: ArticleCard = {
      kind: 'article',
      design,
      style: articleStyle(tree, article),
      top: contextOf(route.top),
      section: section ? contextOf(section) : null,
      chain: chain.map((context) => context.name),
      title: article.title,
      type: article.type,
      typeLabel: type || typeLabel(article),
      kicker: parts,
      date: formatDate(dateTime),
      year: Number.isNaN(year) ? null : year,
      byline,
      image,
      number: design === 'international' ? recordRef(article).number : null,
      pinned: Boolean(article.pinned),
    }
    return { card, complete: pictures.complete }
  }

  let what: PlaceKind
  let context: Context
  let chain: Context[]
  let title: string
  switch (route.kind) {
    case 'home':
    case 'archive':
      what = route.kind
      context = route.top
      chain = [route.top]
      title = route.top.name
      break
    case 'section':
      what = 'section'
      context = route.context
      chain = route.chain
      title = route.context.name
      break
    case 'page': {
      const page = await getPageBySlug(route.context.id, route.slug)
      if (!page) return GENERIC
      what = 'page'
      context = route.context
      chain = route.chain
      title = page.title
      break
    }
  }
  const card: PlaceCard = {
    kind: 'place',
    design,
    style: contextStyle(tree, context),
    what,
    top: contextOf(route.top),
    context: contextOf(context),
    chain: chain.map((record) => record.name),
    sections: listedBelow(tree, context),
    title,
    tagline: context.tagline ?? null,
    emblem: await pictures.emblem(emblemOf(chain)),
  }
  return { card, complete: pictures.complete }
}

const contextOf = (context: Context): CardContext => ({
  name: context.name,
  tagline: context.tagline ?? null,
})

const listedBelow = (tree: SiteTree, context: Context): string[] =>
  tree
    .childrenOf(context.id)
    .filter((child) => child.listed !== false)
    .map((child) => child.name)

/**
 * Fetches and fits the pictures on a card. Every method resolves to a data
 * URI or null, never throws, and notes a failure in `complete`.
 */
class Pictures {
  complete = true

  constructor(private readonly origin: string) {}

  /** The byline with its head or avatar fetched at the size drawn, or the monogram without. */
  async byline(resolved: ResolvedByline | null): Promise<CardByline | null> {
    if (!resolved) return null
    const avatar = resolved.avatar
      ? await this.attempt(() =>
          resolved.avatar!.pixelated
            ? this.fetchAs(resolved.avatar!.url, (bytes) => sharpPng(bytes, HEAD_PX, HEAD_PX, 'cover', true))
            : this.fetchAs(resolved.avatar!.url, (bytes) => sharpPng(bytes, HEAD_PX, HEAD_PX, 'cover', false)),
        )
      : null
    return {
      name: resolved.name,
      title: resolved.title ?? null,
      avatar,
      initials: bylineInitials(resolved.name),
    }
  }

  /** The featured image cropped, around its focal point, to the panel a design draws it in. */
  async featured(
    media: Media | number | null | undefined,
    size: { width: number; height: number },
  ): Promise<string | null> {
    const image = resolveImage(media, 'card')
    if (!image || typeof media !== 'object' || !media) return null
    const focal = { x: media.focalX ?? 50, y: media.focalY ?? 50 }
    return this.attempt(() => this.fetchAs(image.url, (bytes) => sharpJpeg(bytes, size, focal)))
  }

  /** A context's emblem, fitted inside the card's frame. */
  async emblem(media: Media | null): Promise<string | null> {
    const image = resolveImage(media, 'thumbnail')
    if (!image) return null
    return this.attempt(() => this.fetchAs(image.url, (bytes) => sharpPng(bytes, 150, 150, 'inside', false)))
  }

  private async attempt(work: () => Promise<string | null>): Promise<string | null> {
    try {
      const result = await work()
      if (result === null) this.complete = false
      return result
    } catch {
      this.complete = false
      return null
    }
  }

  private async fetchAs(url: string, fit: (bytes: Buffer) => Promise<Buffer | null>): Promise<string | null> {
    const bytes = await this.read(url)
    if (!bytes) return null
    const fitted = await fit(bytes)
    return fitted ? `data:image/${fitted[0] === 0xff ? 'jpeg' : 'png'};base64,${fitted.toString('base64')}` : null
  }

  /** Bytes from a URL: a local upload straight from disk, anything else over HTTP with a short timeout. */
  private async read(url: string): Promise<Buffer | null> {
    const local = url.match(/^\/api\/media\/file\/([^/?#]+)/)
    if (local) {
      try {
        return await readFile(path.join(MEDIA_DIR, path.basename(decodeURIComponent(local[1]))))
      } catch {
        // Not on disk (another origin serves it): fetch it below.
      }
    }
    const absolute = /^https?:\/\//.test(url) ? url : new URL(url, this.origin).href
    const response = await fetch(absolute, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'image/*' },
    })
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  }
}

/**
 * A square PNG of the given size: a head kept exactly as served when it
 * already is that size (nothing resampled, so the skin pixels stay crisp),
 * anything else cropped or fitted with sharp.
 */
async function sharpPng(
  bytes: Buffer,
  width: number,
  height: number,
  fit: 'cover' | 'inside',
  pixelArt: boolean,
): Promise<Buffer | null> {
  const image = sharp(bytes)
  const meta = await image.metadata()
  if (pixelArt && meta.format === 'png' && meta.width === width && meta.height === height) return bytes
  return image
    .resize({ width, height, fit, kernel: pixelArt ? 'nearest' : 'lanczos3', withoutEnlargement: fit === 'inside' })
    .png()
    .toBuffer()
}

/** A JPEG cropped to `size` around a focal point given in percent, then scaled to it. */
async function sharpJpeg(
  bytes: Buffer,
  size: { width: number; height: number },
  focal: { x: number; y: number },
): Promise<Buffer | null> {
  const image = sharp(bytes)
  const { width: sw, height: sh } = await image.metadata()
  if (!sw || !sh) return null
  const scale = Math.max(size.width / sw, size.height / sh)
  const cw = Math.min(sw, Math.round(size.width / scale))
  const ch = Math.min(sh, Math.round(size.height / scale))
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value))
  const left = clamp(Math.round((sw * focal.x) / 100 - cw / 2), sw - cw)
  const top = clamp(Math.round((sh * focal.y) / 100 - ch / 2), sh - ch)
  return image
    .extract({ left, top, width: cw, height: ch })
    .resize(size.width, size.height)
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer()
}

/** The panel sizes featured images are cropped to, by design: what the cards draw them in. */
export type PanelSizes = Record<Design, { width: number; height: number }>
