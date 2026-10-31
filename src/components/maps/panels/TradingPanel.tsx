import Link from 'next/link'

import { farWords, type AbroadFacts, type TradingAround } from '@/maps/abroad'
import { spoken } from '@/maps/data'
import type { Bounds } from '@/maps/geo'
import type { SpawnRoute, SpawnTown } from '@/maps/spawn'
import { serverAbout, SERVER_WORDS, tradingSetting, type ServerKind } from '@/maps/trading'
import { abroadHref } from '@/maps/url'

import { TradingBadge } from '../layers/TradingMark'
import { Arrival, Survey } from './islands'
import { Facts, PanelHead, PanelSection } from './shared'

/**
 * One of the server's own places abroad (src/maps/trading.ts): a trading
 * outpost, or one of its landmarks. Neither is a town nor a site, so none
 * of their furniture — no nation, ruler or residents, no holder, no siege
 * and no nation reach, since nobody holds it and no siege can take it — but
 * what a player wants of it: what it is, said plainly, where it is and the
 * way there, and the trading outposts nearest it. Drawn the same by the
 * page and by the shell before the page arrives (./Preview.tsx).
 */

/** What it is, in a few words, by what the server's own name says of it. */
function whatItIs(kind: ServerKind, name: string): string {
  if (kind === 'landmark') return 'A landmark of the server’s'
  const setting = tradingSetting(name)
  return setting === 'sea' ? 'A ship at sea' : setting === 'land' ? 'A trading outpost on land' : 'A trading outpost'
}

/** What "fit" fits: the ship, the trading outpost (said in full, since a town's outpost is another thing), the landmark. */
function fitWords(kind: ServerKind, name: string): string {
  if (kind === 'landmark') return 'Fit to the landmark'
  return tradingSetting(name) === 'sea' ? 'Fit to the ship' : 'Fit to the trading outpost'
}

const whereTo = (fit: Bounds | null, home: AbroadFacts['home']) =>
  fit ? { bounds: fit } : home ? { centre: home, zoom: 0 } : null

export function TradingPanel({
  place,
  kind,
  route,
  trading,
}: {
  place: AbroadFacts
  kind: ServerKind
  /** The nearest town's spawn anyone may use, and the walk: it has none of its own. */
  route: SpawnRoute<SpawnTown> | null
  trading: TradingAround | null
}) {
  const words = SERVER_WORDS[kind]
  const about = serverAbout(kind)
  const nearest = trading?.nearest ?? []

  return (
    <article className="pb-6">
      <Arrival target={whereTo(place.fit, place.home)} />
      <PanelHead
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <TradingBadge className="h-5 w-5" kind={kind} />
            {words.label}
            <span aria-hidden="true">·</span>
            <span>the server’s own</span>
          </span>
        }
        title={spoken(place.name)}
      >
        <div className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-ink-700">
          {about.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {place.home ? (
          <>
            <Survey className="mt-3" fit={place.fit} fitLabel={fitWords(kind, place.name)} point={place.home} route={route} y={64} />
            {route ? (
              <p className="mt-1 text-[12px] italic leading-snug text-ink-500">
                No <span className="font-mono not-italic">/t spawn</span> leads here: that is the nearest town’s anyone
                may use, and the walk from it.
              </p>
            ) : null}
          </>
        ) : null}
      </PanelHead>

      <div className="mt-4 px-4">
        <Facts
          items={[
            { label: 'What it is', value: whatItIs(kind, place.name) },
            { label: 'Extent', value: `${place.chunks.toLocaleString('en-GB')} chunk${place.chunks === 1 ? '' : 's'}` },
            ...(kind === 'trading' && trading
              ? [{ label: 'On the server', value: `One of ${trading.count.toLocaleString('en-GB')} trading outposts` }]
              : []),
          ]}
        />
      </div>

      {nearest.length ? (
        <PanelSection flush title={kind === 'trading' ? 'The nearest others' : 'Trading outposts nearby'}>
          <ul className="divide-y divide-sand-300/70">
            {nearest.map((other) => (
              <li key={other.slug}>
                <Link
                  className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-sand-100"
                  href={abroadHref(other.slug)}
                >
                  <TradingBadge className="h-5 w-5 shrink-0" kind="trading" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink-900 group-hover:text-sea-800">
                      {spoken(other.name)}
                    </span>
                    <span className="block truncate text-[13px] text-ink-500">
                      {farWords(other.blocks)}
                      {other.direction ? ` ${other.direction}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}

      <p className="mt-6 px-4 text-[13px] leading-relaxed text-ink-400">
        Its claim from Towny and its name from the server’s own marker, as the Rulercraft map has them, read every
        quarter of an hour.
      </p>
    </article>
  )
}
