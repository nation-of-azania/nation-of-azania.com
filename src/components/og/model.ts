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
  /** The standfirst: the article's summary, set under a short headline to fill the card. */
  excerpt: string | null
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

/**
 * A page of Azania Maps (src/app/(frontend)/maps): a clipping of the map
 * with the thing drawn on it, beside a panel of its particulars, as the
 * map itself shows them. The picture is drawn by renderClip (src/lib/dynmap.ts)
 * at the size the card sets it, with claims, roads and pins already on it;
 * only names go over it here. Built by loadMapCard in src/lib/ogMaps.ts.
 */
export type MapPicture = {
  /** The clipping as a data URI; null when the Rulercraft map isn't answering. */
  src: string | null
  /** The towns' names to set over the picture, at the pixel their home block sits at; the card's own town picked out. A held site's name goes without the lozenge, since its mark is already in the picture. */
  labels: { x: number; y: number; text: string; selected?: boolean; site?: boolean }[]
}

export type MapFact = { label: string; value: string }

/** The particulars of what the card shows, laid out one way for every kind. */
export type MapSubject =
  | {
      what: 'nation'
      /** "11 towns · 53 residents". */
      figures: string
    }
  | {
      what: 'town'
      name: string
      nation: string | null
      ruler: CardByline | null
      /** "/t spawn GirlieTown", with whether anyone may use it. */
      spawn: { command: string; open: boolean | null } | null
    }
  | {
      /** A site the server runs and the nation holds: a quarry, a wasteland, a treasure ship. */
      what: 'site'
      name: string
      /** "Diamond quarry". */
      kind: string
      /** "Azania". */
      holder: string
      /** "$333 a day", or null when the map didn't say. */
      pays: string | null
      /** The terms, said kindly, as one run of text. */
      terms: string
      /** The nearest town's spawn and the walk from it, since a site is nobody's `/t spawn`. */
      spawn: { command: string; then: string | null } | null
      /** The kind's glyph on the 24 grid in its ink: filled for a quarry's gem. */
      mark: { d: string; fill: boolean; ink: string }
    }
  | {
      what: 'place'
      name: string
      /** The category's label, and its glyph on the 24 grid in its group's colour. */
      category: { label: string; d: string; fill: boolean; colour: string }
      town: string | null
      description: string | null
    }
  | {
      what: 'road'
      name: string
      kind: string
      town: string | null
      /** "A path or trail in GirlieTown, 77 blocks along its curve, running north-east." */
      description: string
    }
  | {
      what: 'event'
      title: string
      /** The day as a calendar leaf. */
      leaf: { day: string; month: string; weekday: string }
      /** "18:00–20:00 UTC". */
      time: string
      /** Where it's held: the place, or the town, or the coordinates. */
      where: string
      town: string | null
      description: string | null
    }

export type MapCard = {
  kind: 'map'
  subject: MapSubject
  picture: MapPicture
  /** A couple of facts for the foot of the panel: residents, chunks, length. */
  facts: MapFact[]
  /** "X 4296 · Z 4952": the survey reference, in mono. */
  survey: string | null
}

export type Card = ArticleCard | PlaceCard | GenericCard | MapCard
