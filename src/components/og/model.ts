import type { Design } from '@/contexts/designs'
import type { StyleId } from '@/contexts/styles'
import type { Article } from '@/payload-types'

/**
 * What a link-preview card is drawn from: everything already resolved and
 * every picture already fetched into a data URI, so the card components
 * (./gazette.tsx, ./times.tsx, ./international.tsx) only lay things out.
 * Built by loadCard in src/lib/og.ts.
 */

/** A context, reduced to what a card says about it. */
export type CardContext = {
  name: string
  tagline: string | null
}

export type CardByline = {
  name: string
  /** The office or desk: "Chancellor", "Harbour Correspondent". */
  title: string | null
  /** The head or uploaded avatar as a data URI; null for a monogram. */
  avatar: string | null
  /** The monogram shown without an avatar. */
  initials: string
}

export type ArticleCard = {
  kind: 'article'
  design: Design
  style: StyleId | null
  top: CardContext
  /** The sub-context the article sits in; null at the top level. */
  section: CardContext | null
  /** Names from the top-level context down to the article's own, for breadcrumbs. */
  chain: string[]
  title: string
  type: Article['type']
  /** "Decree", "Case study". */
  typeLabel: string
  /** The kicker's words in order: ["Public Works", "Dispatch"]. */
  kicker: string[]
  /** "12 March 2026", or null. */
  date: string | null
  year: number | null
  byline: CardByline | null
  /** The featured image, cropped for the card, as a data URI. */
  image: string | null
  /** A document number in the title ("RS-1"), for records that carry one. */
  number: string | null
  pinned: boolean
}

export type PlaceKind = 'home' | 'section' | 'archive' | 'page'

export type PlaceCard = {
  kind: 'place'
  design: Design
  style: StyleId | null
  what: PlaceKind
  top: CardContext
  /** The context the place belongs to: the top for its front page and archive. */
  context: CardContext
  /** Names from the top-level context down to `context`. */
  chain: string[]
  /** The listed contexts directly within `context`: the offices, desks or initiatives. */
  sections: string[]
  /** The context's name, or a standing page's title. */
  title: string
  tagline: string | null
  /** The context's emblem (or an ancestor's), fitted for the card, as a data URI. */
  emblem: string | null
}

export type GenericCard = { kind: 'generic' }

export type Card = ArticleCard | PlaceCard | GenericCard
