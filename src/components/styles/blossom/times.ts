import type { Variant } from '../types'
import { Blossom } from './Blossom'

/**
 * Cherry Blossom on the Times: the GirlieTea column is still the paper's
 * Opinion — same grid, same tag, same byline — set as GirlieTown would have
 * it: in a pink box, in the bubbly face. The box is the Times' own (it
 * draws one around a post's header and body, and makes every card one);
 * the style gives it the palest blossom for a ground and petal pink for an
 * edge, and sits the avatar panel in a deeper wash so it still shows inside.
 * Rose takes the cinnabar's places and mulberry (800) its fills and rules,
 * dark enough that the role line a card sets over the wash at 80% passes
 * AA. The blossom sits in the Opinion tag as the column's own badge.
 */
export const blossomTimes: Variant<'times'> = {
  colours: {
    'accent-ink': 'var(--color-blossom-600)',
    accent: 'var(--color-blossom-800)',
    'accent-deep': 'var(--color-blossom-900)',
    'accent-tint': 'var(--color-blossom-400)',
    'accent-faint': 'var(--color-blossom-300)',
    'accent-wash': 'var(--color-blossom-200)',
  },
  fonts: { display: 'var(--font-bubbly)', label: 'var(--font-bubbly)' },
  box: {
    'box-ground': 'var(--color-blossom-100)',
    'box-edge': 'var(--color-blossom-300)',
  },
  Mark: Blossom,
}
