import type { Variant } from '../types'
import { Blossom } from './Blossom'

/**
 * Cherry Blossom on the Times: a Girlie Opinion column is still the paper's
 * Opinion, in its grotesque over newsprint. Rose takes the cinnabar's
 * places, petal pink the quotation mark's, and the blossom sits in the
 * column's Opinion tag as its own small badge.
 */
export const blossomTimes: Variant<'times'> = {
  colours: {
    'accent-ink': 'var(--color-blossom-600)',
    accent: 'var(--color-blossom-700)',
    'accent-deep': 'var(--color-blossom-900)',
    'accent-tint': 'var(--color-blossom-300)',
    'accent-faint': 'var(--color-blossom-200)',
    'accent-wash': 'var(--color-blossom-100)',
  },
  Mark: Blossom,
}
