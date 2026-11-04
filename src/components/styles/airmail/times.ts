import type { Variant } from '../types'
import { Plane } from './Plane'

/**
 * Airmail on the Times: the guest column is a letter from abroad that the
 * paper opens on its own pages. The post keeps the Times' grid, headline
 * face and byline, and sits in the Times' box dressed as an envelope: a
 * cream ground a shade warmer than the newsprint, and an edge of airmail
 * chevrons — the writer's cobalt beside the paper's own cinnabar, the two
 * taking turns round the panel, so the box says at a glance that this is
 * a guest's post the Times hosts. Cobalt takes the cinnabar's places in
 * kickers, links, rules and the tag (800 for fills, dark enough that a
 * role line set over the wash at 80% passes AA), the pale sky of the
 * onionskin inside for the wash and the quotation mark, and the kickers
 * and tag are typed in a typewriter face, like a postmark. The tag reads
 * "From abroad" on every post, with the paper plane beside it, and the
 * byline carries the column's standing note.
 */
export const airmailTimes: Variant<'times'> = {
  colours: {
    'accent-ink': 'var(--color-airmail-700)',
    accent: 'var(--color-airmail-800)',
    'accent-deep': 'var(--color-airmail-900)',
    'accent-tint': 'var(--color-airmail-400)',
    'accent-faint': 'var(--color-airmail-300)',
    'accent-wash': 'var(--color-airmail-200)',
  },
  fonts: { label: 'var(--font-typewriter)' },
  box: {
    'box-ground': 'var(--color-airmail-cream)',
    'box-edge':
      'repeating-linear-gradient(-45deg, var(--color-airmail-700) 0 9px, var(--color-airmail-cream) 9px 18px, var(--color-cinnabar-500) 18px 27px, var(--color-airmail-cream) 27px 36px)',
  },
  Mark: Plane,
  tag: 'From abroad',
  note: 'A guest column: the writer’s views are their own, not the Times’.',
}
