import { TYPE_LABELS } from '@/contexts/designs'
import type { Article, Context, Media } from '@/payload-types'

/** The article's context, when populated (depth ≥ 1). */
export const contextOf = (article: Pick<Article, 'context'>): Context | null =>
  article.context && typeof article.context === 'object' ? article.context : null

/**
 * Canonical public URL for an article: the archive of its top-level context,
 * /<top>/articles/<slug>, however deep its own context sits. Needs the
 * context populated (depth ≥ 1).
 */
export function articleHref(article: Pick<Article, 'slug' | 'context'>): string {
  const top = contextOf(article)?.path?.split('/')[1]
  if (!top) return '/'
  return article.slug ? `/${top}/articles/${article.slug}` : `/${top}/articles`
}

/** "Decree", "Case study": the article's type, for kickers. */
export const typeLabel = (article: Pick<Article, 'type'>): string =>
  TYPE_LABELS[article.type as keyof typeof TYPE_LABELS] ?? ''

/**
 * The sub-context an article sits in, for kickers ("Public Works"); null for
 * articles filed directly in a top-level context.
 */
export function sectionOf(article: Pick<Article, 'context'>): Context | null {
  const context = contextOf(article)
  return context?.parent ? context : null
}

/**
 * The parts of a kicker, read as "Public Works · Dispatch": the sub-context
 * the article sits in (null at the top level) and its type, plus `parts`,
 * the words in order with a desk named after its type ("Opinion · Opinion")
 * said once. Each design sets them in its own voice.
 */
export function kickerOf(article: Pick<Article, 'context' | 'type'>): {
  section: Context | null
  type: string
  parts: string[]
} {
  const section = sectionOf(article)
  const type = typeLabel(article)
  const sameWord = section?.name.trim().toLowerCase() === type.toLowerCase()
  return { section, type, parts: section && !sameWord ? [section.name, type] : [type] }
}

/**
 * Gazette types that are instruments of state rather than prose — a decree,
 * a statement, a notice — and so get the formal document treatment: the
 * Chancellery's letterhead, and for decrees the signature and seal.
 */
const STATE_DOCUMENTS: ReadonlySet<Article['type']> = new Set(['decree', 'statement', 'notice'])

export const isStateDocument = (article: Pick<Article, 'type'>): boolean =>
  STATE_DOCUMENTS.has(article.type)

/**
 * A document number in a title, e.g. "RS-1" from "Road Standard RS-1:
 * Cross-Section and Drainage" — the reference a standard or resolution is
 * cited by. Null when the title carries none.
 */
export function documentNumber(title: string): string | null {
  return title.match(/\b([A-Z]{1,4}-\d{1,4}[A-Z]?)\b/)?.[1] ?? null
}

/**
 * Small render-side helpers shared by the site components. Relations coming
 * from Payload may be unpopulated (a numeric id) or null — everything here is
 * defensive about that.
 */

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** "12 March 2026" from an ISO date string; null when absent or invalid. */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return dateFormatter.format(date)
}

export type ResolvedImage = {
  url: string
  width: number
  height: number
  alt: string
}

/**
 * Resolve a media relation to a renderable image for `next/image`, preferring
 * the requested size variant and falling back to the original. Returns null
 * when the relation is unpopulated, is not an image (media also accepts
 * `.glb` models), or lacks a URL or intrinsic dimensions.
 */
export function resolveImage(
  media: Media | number | null | undefined,
  size: 'thumbnail' | 'card' | 'hero',
): ResolvedImage | null {
  if (!media || typeof media !== 'object') return null
  if (media.mimeType && !media.mimeType.startsWith('image/')) return null

  const variant = media.sizes?.[size]
  const useVariant = Boolean(variant?.url)
  const url = useVariant ? variant?.url : media.url
  const width = (useVariant ? variant?.width : media.width) ?? media.width
  const height = (useVariant ? variant?.height : media.height) ?? media.height

  if (!url || !width || !height) return null
  return { url, width, height, alt: media.alt ?? '' }
}

/**
 * A player's head (helmet layer included) from the public skin service, used
 * as the default byline avatar. next/image fetches it through Vercel's image
 * proxy (see images.remotePatterns in next.config.ts). Render it with
 * `image-rendering: pixelated` so the 8×8 skin stays crisp.
 */
export function minecraftHeadUrl(minecraftName: string, size = 64): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(minecraftName)}/${size}`
}

/**
 * Whether a string is shaped like a Minecraft username: 3–16 letters, digits
 * or underscores, with an optional leading "." for Bedrock players. The same
 * rule as the `minecraftName` field's validator (src/fields/minecraftName.ts),
 * here for the browser, so a head can be previewed before anything is saved.
 */
export function isMinecraftName(value: string): boolean {
  return /^\.?\w{3,16}$/.test(value.trim())
}

/**
 * The monogram shown in place of a missing avatar: the initials of the first
 * and last significant words, so "Ione Harrow" gives "IH", "The Editors" "E"
 * and a lone Minecraft name its first letter.
 */
export function bylineInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => !/^(the|a|an|of)$/i.test(w))
  const letters = (words.length > 1 ? [words[0], words[words.length - 1]] : words)
    .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0] ?? '')
    .join('')
  return (letters || name.trim().charAt(0) || '·').toLocaleUpperCase()
}

export type ResolvedByline = {
  /** e.g. "IPaaat" */
  name: string
  /** e.g. "Co-Leader"; absent when the article has no byline profile */
  title?: string
  /** an uploaded avatar, or the player's head (pixel art) */
  avatar?: { url: string; alt: string; pixelated: boolean }
}

/**
 * How an article is credited: its byline profile (name, role, avatar — an
 * upload, else the Minecraft head), falling back to the author's display name
 * and head for articles without one. Null when neither is populated.
 */
export function resolveByline(article: Pick<Article, 'author' | 'byline'>): ResolvedByline | null {
  const profile = article.byline && typeof article.byline === 'object' ? article.byline : null
  const author = article.author && typeof article.author === 'object' ? article.author : null
  const name = profile?.name ?? author?.name
  if (!name) return null

  const upload = resolveImage(profile?.avatar, 'thumbnail')
  const minecraftName = profile ? profile.minecraftName : author?.minecraftName
  const avatar = upload
    ? { url: upload.url, alt: upload.alt, pixelated: false }
    : minecraftName
      ? { url: minecraftHeadUrl(minecraftName), alt: '', pixelated: true }
      : undefined

  return { name, title: profile?.title ?? undefined, avatar }
}
