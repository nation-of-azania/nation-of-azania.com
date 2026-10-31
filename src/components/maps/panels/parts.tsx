import { blocksBetween, farWords, type AwayPart } from '@/maps/abroad'
import type { Point } from '@/maps/geo'
import { compassFrom } from '@/maps/spawn'

import { outpostName, PartSample } from '../layers/TownsLayer'
import { Look } from './islands'
import { PanelSection } from './shared'

const count = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`

/** What the claimed chunks' line adds after the count: " · 1 outpost · 2 detached"; nothing for a town in one piece. */
export function partsWords(away: AwayPart[]): string {
  const outposts = away.filter((part) => part.role === 'outpost').length
  const detached = away.filter((part) => part.role === 'detached').length
  return `${outposts ? ` · ${count(outposts, 'outpost')}` : ''}${detached ? ` · ${detached} detached` : ''}`
}

/** "33,000 blocks north-west of the town", from its home; nothing without one. */
function whereWords(from: Point | null | undefined, at: Point, of: string): string | null {
  if (!from) return null
  const way = compassFrom(from, at)
  return `${farWords(blocksBetween(from, at))}${way ? ` ${way}` : ''} of the ${of}`
}

/**
 * A town's outposts, each by its name where the town gave it one, and any
 * claims detached from it, each with its size, how far from the town it
 * lies and the way, and shown on the map on request. Said as the map sees
 * them (src/maps/claims.ts): an outpost is claims with a spawn of their
 * own, detached claims are joined to neither, and why is the town's own
 * affair. The samples are the map's (TownsLayer → PartSample), so the
 * list reads as the legend does.
 */
export function AwayParts({
  away,
  town,
  from,
  of = 'town',
}: {
  away: AwayPart[]
  /** The town's name, which names an outpost the town gave no name. */
  town: string
  /** The town's home block, from which each part's distance is told; none, and only its size is. */
  from?: Point | null
  of?: 'town' | 'site'
}) {
  if (!away.length) return null
  const outposts = away.filter((part) => part.role === 'outpost')
  const detached = away.filter((part) => part.role === 'detached')
  const title = outposts.length ? (detached.length ? 'Outposts and detached claims' : outposts.length > 1 ? 'Outposts' : 'Outpost') : 'Detached claims'
  return (
    <PanelSection title={title}>
      <p className="text-[14px] leading-relaxed text-ink-500">
        {outposts.length
          ? `Claims apart from the ${of} itself, each with a spawn of its own that its residents reach by /t outpost.`
          : null}
        {outposts.length && detached.length ? ' ' : null}
        {detached.length ? `Detached claims are joined to neither the ${of} nor an outpost, as the map reads them.` : null}
      </p>
      <ul className="mt-2 divide-y divide-sand-300/70">
        {away.map((part, index) => {
          const nth = outposts.length > 1 && part.role === 'outpost' ? ` ${outposts.indexOf(part) + 1}` : ''
          const name =
            part.role === 'outpost'
              ? (part.name ? outpostName(town, part.name) : `Outpost${nth}`)
              : part.chunks === 1
                ? 'A detached chunk'
                : 'Detached claims'
          const where = whereWords(from, part.centre, of)
          const facts = [
            part.role === 'outpost' && part.name ? `Outpost${nth}` : null,
            count(part.chunks, 'chunk'),
            where ?? `X ${Math.round(part.centre[0])} Z ${Math.round(part.centre[1])}`,
          ]
          return (
            <li className="flex items-center gap-3 py-2 text-[15px]" key={`${part.role}-${part.centre[0]},${part.centre[1]}-${index}`}>
              <svg aria-hidden="true" className="h-4 w-10 shrink-0" viewBox="0 0 48 20">
                <PartSample role={part.role === 'outpost' ? 'outpost' : 'detached'} />
              </svg>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink-900">{name}</span>
                <span className="block text-[13px] leading-snug text-ink-500">{facts.filter(Boolean).join(' · ')}</span>
              </span>
              <Look
                className="shrink-0 text-[13px] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
                target={{ bounds: part.bounds }}
              >
                Show on map
              </Look>
            </li>
          )
        })}
      </ul>
    </PanelSection>
  )
}
