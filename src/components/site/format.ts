import type { Article, Media } from '@/payload-types'

/**
 * Canonical public URL for an article, routed by its publication:
 *  - Condor Times pieces live at /times/[slug]
 *  - Government Gazette pieces live at /gov/articles/[slug]
 */
export function articleHref(
  article: Pick<Article, 'slug'> & { section?: Article['section'] | null },
): string {
  const slug = article.slug
  if (article.section === 'times') return slug ? `/times/${slug}` : '/times'
  return slug ? `/gov/articles/${slug}` : '/gov/articles'
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
