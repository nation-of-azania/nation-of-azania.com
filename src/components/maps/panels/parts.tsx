import type { AwayPart } from '@/maps/abroad'

import { Look } from './islands'
import { PanelSection } from './shared'

const count = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`

/** What the claimed chunks' line adds after the count: " · 1 outpost · 2 detached"; nothing for a town in one piece. */
export function partsWords(away: AwayPart[]): string {
  const outposts = away.filter((part) => part.role === 'outpost').length
  const detached = away.filter((part) => part.role === 'detached').length
  return `${outposts ? ` · ${count(outposts, 'outpost')}` : ''}${detached ? ` · ${detached} detached` : ''}`
}

/**
 * A town's outposts, each by its name where the town gave it one, and any
 * claims detached from it, each shown on the map on request. Said as the
 * map sees them, with no guess at why a claim is detached.
 */
export function AwayParts({ away, of = 'town' }: { away: AwayPart[]; of?: 'town' | 'site' }) {
  if (!away.length) return null
  const outposts = away.filter((part) => part.role === 'outpost')
  const detached = away.filter((part) => part.role === 'detached')
  return (
    <PanelSection title={outposts.length ? (detached.length ? 'Outposts and detached claims' : 'Outposts') : 'Detached claims'}>
      <p className="text-[13px] leading-relaxed text-ink-500">
        {outposts.length
          ? `Claims away from the ${of} itself, with a spawn of their own for its residents (/t outpost).`
          : null}
        {outposts.length && detached.length ? ' ' : null}
        {detached.length ? `Detached: claims joined to neither the ${of} nor an outpost.` : null}
      </p>
      <ul className="mt-2 divide-y divide-sand-300/70">
        {away.map((part, index) => (
          <li className="flex items-baseline justify-between gap-3 py-2 text-sm" key={`${part.centre[0]},${part.centre[1]}`}>
            <span className="min-w-0">
              <span className="font-semibold text-ink-900">
                {part.role === 'outpost'
                  ? (part.name ?? (outposts.length > 1 ? `Outpost ${index + 1}` : 'Outpost'))
                  : 'Detached claims'}
              </span>
              <span className="block font-mono text-[11px] tracking-[0.06em] text-ink-500 tabular-nums">
                {count(part.chunks, 'chunk')} · X {Math.round(part.centre[0])} Z {Math.round(part.centre[1])}
              </span>
            </span>
            <Look
              className="shrink-0 text-[12px] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
              target={{ bounds: part.bounds }}
            >
              Show on map
            </Look>
          </li>
        ))}
      </ul>
    </PanelSection>
  )
}
