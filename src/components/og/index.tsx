import type { ReactElement } from 'react'

import { GazetteCard } from './gazette'
import { GenericCard } from './generic'
import { InternationalCard } from './international'
import type { Card } from './model'
import { TimesCard } from './times'
import { CARD } from './tokens'

/**
 * Link-preview cards: the 1200×630 picture a chat client unfurls beside a
 * pasted link, drawn by src/app/(frontend)/og/[...path]/route.tsx from a
 * Card (./model.ts) in the voice of the page's design — a clipping of that
 * paper, not a screenshot of the site. Written for Satori, which lays out a
 * flexbox subset off the DOM: see ./shared.tsx for the rules.
 */
export function renderCard(card: Card): ReactElement {
  if (card.kind === 'generic') return <GenericCard />
  switch (card.design) {
    case 'times':
      return <TimesCard card={card} />
    case 'international':
      return <InternationalCard card={card} />
    default:
      return <GazetteCard card={card} />
  }
}

/**
 * The card's URL for a page path, versioned by when the page last changed,
 * so the long-cached picture turns over with the page (the route ignores
 * the value). Relative: Next resolves it against `metadataBase`.
 */
export function cardImageFor(path: string, updatedAt?: string | null) {
  const stamp = updatedAt ? Date.parse(updatedAt) : Number.NaN
  const version = Number.isNaN(stamp) ? '' : `?v=${stamp.toString(36)}`
  return { url: `/og${path}${version}`, width: CARD.width, height: CARD.height }
}

export { themeColorOf } from './tokens'
export { CARD }
export type { Card } from './model'
