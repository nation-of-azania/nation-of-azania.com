import type { StyleId } from '@/contexts/styles'
import type { Media } from '@/payload-types'

/**
 * The paper a block is set in — the prose tone RichText renders in — and the
 * style the record wears, for blocks that dress to match: a figure in the
 * Gazette is mounted like a print, in the Times printed flat, in the
 * registry filed with a card. Colours come from the style's slot variables
 * (`--accent`, `--accent-ink`; src/components/styles/slots.ts); `style` is
 * for the one thing a variable can't reach, a colour drawn into an image.
 */
export type Tone = 'gazette' | 'times' | 'international'

export type Voice = { tone: Tone; style: StyleId | null }

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
