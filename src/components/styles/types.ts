import type { ComponentType } from 'react'

import type { Design } from '@/contexts/designs'

import type { BoxSlots, Faces, Slots } from './slots'

/** A small decorative mark in `currentColor`, sized by its className. */
export type Mark = ComponentType<{ className?: string }>

/**
 * One style on one design: a colour for every slot the design exposes
 * (src/components/styles/slots.ts); optionally a mark the design shows
 * where it has one of its own — the seal on a Gazette record, the Opinion
 * tag on a Times column, the emblem frame of a section without an emblem —
 * the faces to set its type in, and the design's box switched on.
 */
export type Variant<D extends Design> = {
  colours: Slots<D>
  Mark?: Mark
  /** Faces to swap (DESIGN_FACES): `display` behind headlines and names, `label` behind kickers and tags, `body` behind running text. */
  fonts?: Faces
  /** Switch on the design's box (DESIGN_BOXES) with a colour for each of its slots; only a design that offers one takes it. */
  box?: BoxSlots<D>
}
