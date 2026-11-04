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
 * the faces to set its type in, the design's box switched on, and a
 * standing tag and note for the design to print on every post in the style.
 */
export type Variant<D extends Design> = {
  colours: Slots<D>
  Mark?: Mark
  /** Faces to swap (DESIGN_FACES): `display` behind headlines and names, `label` behind kickers and tags, `body` behind running text. */
  fonts?: Faces
  /** Switch on the design's box (DESIGN_BOXES) with a colour for each of its slots; only a design that offers one takes it. */
  box?: BoxSlots<D>
  /**
   * A word or two the design prints on every post in the style where it tags
   * its own kinds of post — the Times' solid tag, which reads "Opinion" on a
   * signed view — with the mark beside it, so a reader sees at a glance whose
   * post this is. The design's own word moves into the kicker beside it.
   */
  tag?: string
  /**
   * A standing line the design prints under a byline where it has a place for
   * one (the Times prints the Opinion desk's there, on a signed view), on every
   * post in the style: what a reader should know about who is writing.
   */
  note?: string
}
