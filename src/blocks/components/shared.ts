import type { Media } from '@/payload-types'

/** Joins class names, skipping falsy entries. */
export function cn(...classes: Array<false | null | string | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Narrows an upload relation to a populated Media doc.
 * Payload returns a bare numeric ID when the relation is not populated
 * (depth 0) — in that case we have nothing to render.
 */
export function resolveMedia(value: Media | null | number | undefined): Media | null {
  return value && typeof value === 'object' ? value : null
}

export type ResolvedImage = {
  alt: string
  height: number
  src: string
  width: number
}

/**
 * Picks the best pre-generated image size for a slot, falling back to the
 * original file. Returns null when there is nothing renderable.
 */
export function resolveImage(
  media: Media | null,
  preferred: 'card' | 'hero' | 'thumbnail' = 'card',
): ResolvedImage | null {
  if (!media) return null

  const size = media.sizes?.[preferred]
  if (size?.url && size.width && size.height) {
    return { alt: media.alt || '', height: size.height, src: size.url, width: size.width }
  }

  if (media.url) {
    return {
      alt: media.alt || '',
      height: media.height || 1000,
      src: media.url,
      width: media.width || 1600,
    }
  }

  return null
}
