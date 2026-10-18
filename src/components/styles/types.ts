import type { ComponentType } from 'react'

import type { Design } from '@/contexts/designs'

import type { Slots } from './slots'

/** A small decorative mark in `currentColor`, sized by its className. */
export type Mark = ComponentType<{ className?: string }>

/**
 * One style on one design: a colour for every slot the design exposes
 * (src/components/styles/slots.ts), and optionally a mark the design shows
 * where it has one of its own — the seal on a Gazette record, the Opinion
 * tag on a Times column, the emblem frame of a section without an emblem.
 */
export type Variant<D extends Design> = {
  colours: Slots<D>
  Mark?: Mark
}
