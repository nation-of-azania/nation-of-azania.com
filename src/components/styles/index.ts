import type { CSSProperties } from 'react'

import type { Design } from '@/contexts/designs'
import { STYLES, styleSupports, type StyleId } from '@/contexts/styles'

import { blossomGazette } from './blossom/gazette'
import { blossomTimes } from './blossom/times'
import { boxVars, faceVars, slotVars } from './slots'
import type { Mark, Variant } from './types'

/**
 * Every style's variants, one per design it supports (src/contexts/styles.ts
 * says which; TypeScript insists on each). A variant is a few colours, a
 * face or two, an optional mark and — where the design offers one — its
 * box switched on; never a component of its own: the Gazette stays the
 * Gazette and the Times the Times.
 *
 * Adding a style: declare it in src/contexts/styles.ts, add a folder here
 * with a variant per design (`Variant<'gazette'>` lists the slots to fill;
 * put its colours in globals.css as tokens, deep enough for text to pass
 * AA on the design's ground — and in its box, if the variant switches one
 * on), and register it below.
 */
type Variants = {
  [S in StyleId]: { [D in (typeof STYLES)[S]['designs'][number]]: Variant<D> }
}

export const STYLE_VARIANTS: Variants = {
  blossom: { gazette: blossomGazette, times: blossomTimes },
}

/** What a styled element wears. */
export type Dress = {
  /** Spread onto the element: its slots, faces and box as custom properties, and which style it wears. */
  attrs: { style: CSSProperties; 'data-style'?: StyleId }
  /** The style worn, once the design is known to have a variant of it; null when plain. */
  wears: StyleId | null
  /** The style's mark, to show in place of the design's own; null to keep the design's. */
  Mark: Mark | null
  /** The design's box is on: set the element in the panel the design draws in `--box-*` (DESIGN_BOXES). Never for a design without one. */
  boxed: boolean
}

const variantOf = <D extends Design>(design: D, style: StyleId | null): Variant<D> | null =>
  style && styleSupports(style, design)
    ? ((STYLE_VARIANTS[style] as Partial<Record<Design, Variant<D>>>)[design] ?? null)
    : null

/**
 * The dress of an article, card or section in a design: the style's
 * colours, faces and box when it wears one, else the design's own (DESIGN_SLOTS
 * in ./slots.ts), so a plain card inside a styled section stays plain. Resolve the style with
 * `articleStyle` or `contextStyle` from src/lib/site.ts.
 */
export function dress<D extends Design>(design: D, style: StyleId | null): Dress {
  const variant = variantOf(design, style)
  const wears = variant && style ? style : null
  return {
    attrs: {
      style: {
        ...slotVars(design, variant?.colours),
        ...faceVars(design, variant?.fonts),
        ...boxVars(variant?.box),
      },
      ...(wears ? { 'data-style': wears } : {}),
    },
    wears,
    Mark: variant?.Mark ?? null,
    boxed: Boolean(variant?.box),
  }
}
