import type { CSSProperties } from 'react'

import type { Design } from '@/contexts/designs'

/**
 * The slots a style can fill: for each design, the few places it already
 * sets an accent, as CSS custom properties its components read
 * (`text-(--accent-ink)`, `bg-(--accent)`, …). The values here are the
 * design's own colours, applied at its shell's root, so an unstyled page
 * looks exactly as the design drew it. A style variant (src/components/styles)
 * gives every slot of a design a colour of its own, and the styled element
 * carries them inline (see `dress`). Beyond colours, a variant may swap the
 * design's faces (DESIGN_FACES) and switch on its box (DESIGN_BOXES).
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

export type Face = 'display' | 'label' | 'body'

/**
 * The faces a style can swap: for each design, the font tokens (globals.css)
 * its components set type in. `display` is behind headlines and names,
 * `label` behind kickers, tags and eyebrows (`font-label`: the body face,
 * until a style says otherwise) and `body` behind running text. A variant
 * that sets a face overrides the token on the styled element, so every
 * component beneath changes face without knowing.
 */
export const DESIGN_FACES = {
  gazette: { display: '--font-display', label: '--font-label', body: '--font-body' },
  times: { display: '--font-news', label: '--font-label', body: '--font-body' },
  international: { display: '--font-record', label: '--font-mono', body: '--font-body' },
} as const satisfies Record<Design, Record<Face, `--font-${string}`>>

/** A font-family value for each face a variant swaps, such as `var(--font-bubbly)`. */
export type Faces = Partial<Record<Face, string>>

/**
 * The box a design offers: a post set in a tinted, bordered panel — on its
 * own page around its header and body, in a listing the whole card. Listed
 * per design are the slots it paints the box with; a variant switches the
 * box on by giving each a colour (`box` in ./types.ts). A design without an
 * entry has no box to switch on.
 */
export const DESIGN_BOXES = {
  /** The panel's ground, and its border. */
  times: ['box-ground', 'box-edge'],
} as const satisfies Partial<Record<Design, readonly string[]>>

export type BoxedDesign = keyof typeof DESIGN_BOXES

/** A colour for every slot of a design's box; `never` where the design has none. */
export type BoxSlots<D extends Design> = D extends BoxedDesign
  ? Record<(typeof DESIGN_BOXES)[D][number], string>
  : never

/** Named slots as inline custom properties, `{ '--accent-ink': … }`. */
const asVars = (slots: object): CSSProperties =>
  Object.fromEntries(
    Object.entries(slots).map(([slot, value]) => [`--${slot}`, value]),
  ) as CSSProperties

/** A design's slots as inline custom properties: its own values, or a variant's. */
export function slotVars<D extends Design>(design: D, values?: Slots<D>): CSSProperties {
  return asVars(values ?? (DESIGN_SLOTS[design] as Slots<D>))
}

/** A variant's box colours as inline custom properties, `{ '--box-ground': … }`; nothing while the box is off. */
export const boxVars = <D extends Design>(box?: BoxSlots<D>): CSSProperties =>
  box ? asVars(box) : {}

/**
 * A variant's faces as inline overrides of the design's font tokens.
 * Headlines and labels read their token through `font-news`, `font-label`
 * and the like, but running text inherits the body's face, so a body swap
 * also restates it on the element.
 */
export function faceVars<D extends Design>(design: D, faces?: Faces): CSSProperties {
  if (!faces) return {}
  const tokens = DESIGN_FACES[design]
  const vars: Record<string, string> = {}
  for (const face of Object.keys(tokens) as Face[]) {
    const value = faces[face]
    if (value) vars[tokens[face]] = value
  }
  if (faces.body) vars.fontFamily = `var(${tokens.body})`
  return vars as CSSProperties
}
