import type { CSSProperties } from 'react'

import type { Design } from '@/contexts/designs'

/**
 * The slots a style can fill: for each design, the few places it already
 * sets an accent, as CSS custom properties its components read
 * (`text-(--accent-ink)`, `bg-(--accent)`, …). The values here are the
 * design's own colours, applied at its shell's root, so an unstyled page
 * looks exactly as the design drew it. A style variant (src/components/styles)
 * gives every slot of a design a colour of its own, and the styled element
 * carries them inline (see `dress`).
 */
export const DESIGN_SLOTS = {
  gazette: {
    /** Eyebrows and kickers, the office under a byline. */
    'accent-ink': 'var(--color-saffron-600)',
    /** The hairline under the sea bar; borders that light up on hover. */
    accent: 'var(--color-saffron-400)',
    /** The ground of an emblem frame, and of a card without a picture. */
    'accent-wash': 'var(--color-sand-100)',
    /** The seal and the type beside it on a document of state. */
    'seal-ink': 'var(--color-coral-700)',
    /** The seal's fills: a document card's top rule, the pinned dot. */
    seal: 'var(--color-coral-600)',
  },
  times: {
    /** Kickers, links, a desk's name. */
    'accent-ink': 'var(--color-cinnabar-700)',
    /** Rules, the Opinion tag, hover text. */
    accent: 'var(--color-cinnabar-800)',
    /** An opinion's headline on a card. */
    'accent-deep': 'var(--color-cinnabar-900)',
    /** The great quotation mark on an opinion card. */
    'accent-tint': 'var(--color-cinnabar-300)',
    /** The quotation mark behind an opinion's headline. */
    'accent-faint': 'var(--color-cinnabar-200)',
    /** An opinion card's ground, the emblem frame. */
    'accent-wash': 'var(--color-cinnabar-100)',
  },
  // The registry's slate: no style has an International variant yet.
  international: {
    /** A record number's badge, an initiative's level line. */
    'accent-ink': '#4a5566',
    /** Rules, badge borders, an initiative tile's bar. */
    accent: '#4a5566',
    /** The emblem frame. */
    'accent-wash': '#edeef0',
  },
} as const satisfies Record<Design, Record<string, string>>

export type Slots<D extends Design> = Record<keyof (typeof DESIGN_SLOTS)[D], string>

/** A design's slots as inline custom properties, `{ '--accent-ink': … }`: its own values, or a variant's. */
export function slotVars<D extends Design>(design: D, values?: Slots<D>): CSSProperties {
  const slots: Slots<D> = values ?? (DESIGN_SLOTS[design] as Slots<D>)
  return Object.fromEntries(
    Object.entries(slots).map(([slot, value]) => [`--${slot}`, value]),
  ) as CSSProperties
}
