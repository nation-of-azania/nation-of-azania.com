import Link from 'next/link'

import { BylineAvatar } from '@/components/site/BylineAvatar'
import { formatDate, minecraftHeadUrl } from '@/components/site/format'
import {
  blocksBetween,
  farWords,
  type AbroadFacts,
  type HomeCapital,
  type NationSummary,
  type TradingAround,
} from '@/maps/abroad'
import { spoken, type Relation } from '@/maps/data'
import type { Bounds, Point } from '@/maps/geo'
import { nationInk, NO_NATION } from '@/maps/palette'
import { incomeWords, isSiteKind, resourceWords, siteTitle, type SiteFacts } from '@/maps/sites'
import type { SpawnRoute, SpawnTown } from '@/maps/spawn'
import { isServerKind } from '@/maps/trading'
import { abroadHref, nationHref, townHref } from '@/maps/url'
import { CAPITAL_WAR_RADIUS } from '@/maps/world'

import { SiteBadge } from '../layers/SiteMark'
import { Swatch } from '../ui/Swatch'
import { BeliefsSection } from './BeliefsChart'
import { Arrival, Look, Survey } from './islands'
import { NationPeople, Residents } from './people'
import { EYEBROW, Facts, PanelHead, PanelSection } from './shared'
import { AwayParts, partsWords } from './parts'
import { NationSieges, TownSiege } from './sieges'
import { StanceNote } from './Stance'
import { TradingPanel } from './TradingPanel'

/**
 * The panels of the world abroad: a town of another nation (or of none)
 * and another nation, each light — what Towny says of it, the way there,
 * its people (for Azania's outlaw lists: ./people.tsx), where Azania
 * stands with it (./Stance.tsx, set right there by its diplomats), and
 * its place in the world — since Azania Maps keeps nothing of other
 * nations' towns: no census, no mayors, no places drawn. The server's own
 * places, its trading outposts and landmarks, have a panel of their own
 * (./TradingPanel.tsx), since they are no towns. Server-rendered
 * from the world's reading (src/lib/abroad.ts), so a link unfurls and a
 * search engine reads it; the map is told where to look (Arrival), since
 * the world itself reaches the browser after the page.
 */

const LINK = 'text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900'

/** "Oct 10 2026", as Towny writes it, in the site's own date form. */
function foundedOn(raw: string | null): string | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : (formatDate(date.toISOString()) ?? raw)
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`

const siteOf = (town: AbroadFacts): SiteFacts | null =>
  isSiteKind(town.kind) ? { kind: town.kind, income: town.income, resource: town.resource, note: null } : null

/** A nation by name, linked to its page. */
function NationLink({ nation }: { nation: Pick<NationSummary, 'name' | 'slug' | 'colour'> }) {
  return (
    <Link className={`inline-flex items-center gap-1.5 ${LINK}`} href={nationHref(nation.slug)}>
      <Swatch colour={nation.colour} />
      {spoken(nation.name)}
    </Link>
  )
}

const whereTo = (fit: Bounds | null, home: AbroadFacts['home']) =>
  fit ? { bounds: fit } : home ? { centre: home, zoom: 0 } : null

/** One of Azania's towns, as another nation's reach is measured against them. */
export type OurTown = { name: string; slug: string; home: Point | null }

/** "within" or "beyond" a nation's reach, by the server's rule. */
const reachWord = (blocks: number) => (blocks <= CAPITAL_WAR_RADIUS ? 'within' : 'beyond')

/** Names in a list, as a reader says them: "Oasis, Georgetown and Cape Agulhas". */
const listed = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * A town abroad: its nation, ruler, residents and claims, its spawn when
 * anyone may use it, and a site's pay; or one of the server's own places,
 * in its own panel.
 */
export function AbroadTownPanel({
  town,
  nation,
  relation,
  route,
  capital,
  trading,
}: {
  town: AbroadFacts
  nation: NationSummary | null
  /** Where Azania stands with its nation; null when neutral. */
  relation: Relation | null
  route: SpawnRoute<SpawnTown> | null
  /** Azania's capital, from which its reach is measured. */
  capital: HomeCapital
  /** For one of the server's own places, the trading outposts around it. */
  trading: TradingAround | null
}) {
  if (isServerKind(town.kind)) return <TradingPanel kind={town.kind} place={town} route={route} trading={trading} />
  const fromCapital = capital && town.home ? blocksBetween(capital.home, town.home) : null
  const site = siteOf(town)
  const ring = nation ? nationInk(nation.colour).line : NO_NATION.line
  const pays = site ? incomeWords(site.income) : null
  const produces = site?.kind === 'quarry' ? resourceWords(site.resource) : null
  const holder = nation ? spoken(nation.name) : null
  const eyebrow = site ? (
    <span className="inline-flex items-center gap-2">
      <SiteBadge className="h-5 w-5" facts={site} ring={ring} />
      {siteTitle(site)}
      <span aria-hidden="true">·</span>
      <span>{holder ? `held by ${holder}` : 'held by nobody'}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-2">
      <Swatch colour={nation?.colour} round />
      {town.capital ? 'Capital' : 'Town'}
      <span aria-hidden="true">·</span>
      <span>{holder ?? 'of no nation'}</span>
    </span>
  )

  return (
    <article className="pb-6">
      <Arrival target={whereTo(town.fit, town.home)} />
      <PanelHead eyebrow={eyebrow} title={spoken(town.name)}>
        {site ? (
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
            {pays ? (
              <>
                <span className="font-body text-2xl font-semibold leading-none text-ink-900 tabular-nums">
                  ${site.income!.toLocaleString('en-GB')}
                </span>
                <span className="text-sm text-ink-500">a day to {holder ?? 'whoever takes it'}</span>
              </>
            ) : (
              <span className="text-sm text-ink-500">What it pays isn’t recorded.</span>
            )}
          </p>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <BylineAvatar
              byline={{
                name: town.ruler ?? town.name,
                avatar: town.ruler ? { url: minecraftHeadUrl(town.ruler), alt: '', pixelated: true } : undefined,
              }}
              size={40}
              tone="gazette"
            />
            <div className="min-w-0">
              <p className="font-label text-[10px] uppercase tracking-[0.18em] text-ink-500">Ruler</p>
              <p className="truncate text-sm font-semibold text-ink-900">{town.ruler ?? 'None recorded'}</p>
            </div>
          </div>
        )}
        {town.home ? (
          <>
            <Survey
              className="mt-3"
              fit={town.fit}
              fitLabel={site ? 'Fit to the site' : 'Fit to town'}
              point={town.home}
              route={route}
              town={route?.town.name === town.name ? route.town : undefined}
              y={64}
            />
            {site ? (
              <p className="mt-1 text-[11px] italic leading-snug text-ink-500">
                A site has no spawn of its own: that is the nearest anyone may use, and the walk from it.
              </p>
            ) : town.publicSpawn === false ? (
              <p className="mt-1 text-[11px] italic leading-snug text-ink-500">
                Its own spawn is private, for its residents: that is the nearest anyone may use, and the walk.
              </p>
            ) : null}
          </>
        ) : null}
      </PanelHead>

      <TownSiege townyId={town.id} />

      <div className="mt-4 px-4">
        <Facts
          items={
            site
              ? [
                  { label: 'What it is', value: siteTitle(site) },
                  ...(produces ? [{ label: 'Produces', value: produces.adjective }] : []),
                  { label: 'Held by', value: nation ? <NationLink nation={nation} /> : 'Nobody: the server’s own' },
                  { label: 'Extent', value: `${plural(town.chunks, 'chunk')}${partsWords(town.away)}` },
                ]
              : [
                  { label: 'Nation', value: nation ? <NationLink nation={nation} /> : 'None' },
                  { label: town.residents === 1 ? 'Resident' : 'Residents', value: town.residents.toLocaleString('en-GB') },
                  {
                    label: 'Claimed chunks',
                    value: `${town.chunks.toLocaleString('en-GB')}${partsWords(town.away)}`,
                  },
                  { label: 'Founded', value: foundedOn(town.founded) ?? 'Not recorded' },
                  { label: 'Culture', value: town.culture ? spoken(town.culture) : 'Not chosen' },
                  { label: 'Religion', value: town.religion ? spoken(town.religion) : 'Not chosen' },
                ]
          }
        />
      </div>

      {nation ? <StanceNote className="mx-4 mt-4" nation={nation.name} quietWhenNeutral relation={relation} /> : null}

      <Residents town={town} />

      {site ? (
        <PanelSection title="Terms">
          <p className="text-sm leading-relaxed text-ink-700">
            {/^[aeiou]/i.test(siteTitle(site)) ? 'An' : 'A'} {siteTitle(site).toLowerCase()} the server runs
            {pays ? `, paying ${pays} to the nation that holds it` : ''}. It changes hands by siege, so whoever holds
            it is worth knowing.
          </p>
        </PanelSection>
      ) : null}

      <AwayParts away={town.away} from={town.home} of={site ? 'site' : 'town'} town={town.name} />

      {fromCapital != null && capital ? (
        <PanelSection title="Nation reach">
          <p className="text-sm leading-relaxed text-ink-700">
            {farWords(fromCapital)} from {spoken(capital.town)}, Azania’s capital:{' '}
            <strong className="font-semibold">{reachWord(fromCapital)} Azania’s reach</strong>, which is{' '}
            {CAPITAL_WAR_RADIUS.toLocaleString('en-GB')} blocks from its capital.
          </p>
        </PanelSection>
      ) : null}

      {nation ? (
        <PanelSection title="Its nation">
          <p className="text-sm leading-relaxed text-ink-700">
            <NationLink nation={nation} />: {plural(nation.towns, 'town')}, {plural(nation.residents, 'resident')}.
            {nation.capital && !town.capital ? (
              <>
                {' '}
                Its capital is{' '}
                <Link className={LINK} href={abroadHref(nation.capital.slug)}>
                  {spoken(nation.capital.name)}
                </Link>
                .
              </>
            ) : town.capital ? ' This is its capital.' : null}
          </p>
        </PanelSection>
      ) : null}

      <p className="mt-6 px-4 text-xs leading-relaxed text-ink-400">
        From Towny, as the Rulercraft map has it, read every quarter of an hour. Azania Maps keeps nothing of other
        nations’ towns.
      </p>
    </article>
  )
}

/** Another nation: its totals, its capital, what it holds, and its towns. */
export function NationPanel({
  nation,
  relation,
  fit,
  members,
  capital,
  ours,
}: {
  nation: NationSummary
  /** Where Azania stands with it; null when neutral. */
  relation: Relation | null
  fit: Bounds | null
  members: AbroadFacts[]
  /** Azania's capital, and its towns, against which this nation's reach is measured, and Azania's against it. */
  capital: HomeCapital
  ours: OurTown[]
}) {
  const towns = members.filter((town) => town.kind === 'town')
  const sites = members
    .filter((town) => isSiteKind(town.kind))
    .sort((a, b) => (b.income ?? 0) - (a.income ?? 0) || a.name.localeCompare(b.name))
  const total = sites.reduce((sum, site) => sum + (site.income ?? 0), 0)
  const ring = nationInk(nation.colour).line
  // Each nation's reach: which of Azania's towns this nation may besiege, and which of its own Azania may.
  const theirs = nation.capital
    ? ours.filter((town) => town.home && blocksBetween(nation.capital!.home, town.home) <= CAPITAL_WAR_RADIUS)
    : []
  const reachable = capital
    ? members.filter((town) => town.home && blocksBetween(capital.home, town.home) <= CAPITAL_WAR_RADIUS)
    : []

  return (
    <article className="pb-6">
      <Arrival target={fit ? { bounds: fit } : null} />
      <PanelHead
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Swatch colour={nation.colour} />
            Nation
          </span>
        }
        title={spoken(nation.name)}
      >
        <p className="mt-2 text-sm text-ink-500">
          {plural(towns.length, 'town')}
          {sites.length ? ` and ${plural(sites.length, 'site')}` : ''} · {plural(nation.residents, 'resident')} ·{' '}
          {plural(nation.chunks, 'chunk')}
        </p>
        {fit ? (
          <p className="mt-2 text-[11px]">
            <Look className={LINK} target={{ bounds: fit }}>
              Fit to the nation
            </Look>
          </p>
        ) : null}
      </PanelHead>

      <StanceNote className="mx-4 mt-4" nation={nation.name} relation={relation} />

      <div className="mt-4 px-4">
        <Facts
          items={[
            {
              label: 'Capital',
              value: nation.capital ? (
                <Link className={LINK} href={abroadHref(nation.capital.slug)}>
                  {spoken(nation.capital.name)}
                </Link>
              ) : (
                'None on the map'
              ),
            },
            { label: 'Towns', value: towns.length.toLocaleString('en-GB') },
            { label: 'Residents', value: nation.residents.toLocaleString('en-GB') },
            { label: 'Claimed chunks', value: nation.chunks.toLocaleString('en-GB') },
          ]}
        />
      </div>

      <NationSieges nation={nation.name} />

      <BeliefsSection beliefs={nation.beliefs} towns={towns.length} />

      {nation.capital && capital ? (
        <PanelSection title="Nation reach">
          <div className="space-y-2 text-sm leading-relaxed text-ink-700">
            <p>
              A nation may besiege towns within {CAPITAL_WAR_RADIUS.toLocaleString('en-GB')} blocks of its capital. {spoken(nation.name)}’s,{' '}
              {spoken(nation.capital.name)}, is {farWords(blocksBetween(nation.capital.home, capital.home))} from{' '}
              {spoken(capital.town)}, Azania’s.
            </p>
            <p>
              <strong className="font-semibold">Within its reach:</strong>{' '}
              {theirs.length ? (
                <>
                  {theirs.length === ours.length ? 'all' : `${theirs.length} of ${ours.length}`} of Azania’s towns:{' '}
                  {theirs.map((town, index) => (
                    <span key={town.slug}>
                      {index ? (index === theirs.length - 1 ? ' and ' : ', ') : null}
                      <Link className={LINK} href={townHref(town.slug)}>
                        {spoken(town.name)}
                      </Link>
                    </span>
                  ))}
                  .
                </>
              ) : (
                'none of Azania’s towns.'
              )}
            </p>
            <p>
              <strong className="font-semibold">Within Azania’s:</strong>{' '}
              {reachable.length
                ? `${reachable.length === members.length ? 'all' : `${reachable.length} of ${members.length}`} of its towns${
                    reachable.length <= 4 ? `: ${listed(reachable.map((town) => spoken(town.name)))}` : ''
                  }.`
                : 'none of its towns.'}
            </p>
          </div>
        </PanelSection>
      ) : null}

      {sites.length ? (
        <PanelSection flush title="Holdings">
          <p className="px-4 text-[13px] leading-relaxed text-ink-500">
            Sites the server runs and {spoken(nation.name)} holds, each taken, and lost, by siege.
          </p>
          <ul className="mt-2 divide-y divide-sand-300/70">
            {sites.map((site) => {
              const facts = siteOf(site)!
              return (
                <li key={site.slug}>
                  <Link
                    className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-sand-100"
                    href={abroadHref(site.slug)}
                  >
                    <SiteBadge className="h-5 w-5 shrink-0" facts={facts} ring={ring} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900 group-hover:text-sea-800">
                        {spoken(site.name)}
                      </span>
                      <span className="block truncate text-xs text-ink-500">{siteTitle(facts)}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[12px] tracking-[0.04em] text-ink-700 tabular-nums">
                      {incomeWords(facts.income) ?? 'pays nothing'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {total > 0 && sites.length > 1 ? (
            <p className="mx-4 mt-1 flex items-baseline justify-between gap-3 border-t border-sand-300 pt-2 text-sm">
              <span className="text-ink-500">Together, a day</span>
              <span className="font-mono text-[13px] font-semibold tracking-[0.04em] text-ink-900 tabular-nums">
                ${total.toLocaleString('en-GB')}
              </span>
            </p>
          ) : null}
        </PanelSection>
      ) : null}

      <PanelSection flush title={`Towns · ${towns.length}`}>
        <ul className="divide-y divide-sand-300/70">
          {towns.map((town) => (
            <li key={town.slug}>
              <Link
                className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-sand-100"
                href={abroadHref(town.slug)}
              >
                <Swatch className={town.capital ? 'h-3.5 w-3.5 border-2' : undefined} colour={nation.colour} round />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900 group-hover:text-sea-800">
                    {spoken(town.name)}
                    {town.capital ? <span className={`${EYEBROW} ml-2 align-middle`}>Capital</span> : null}
                  </span>
                  <span className="block truncate text-xs text-ink-500">
                    {plural(town.residents, 'resident')} · {plural(town.chunks, 'chunk')}
                    {town.ruler ? ` · ${town.ruler}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PanelSection>

      <NationPeople members={members} nation={nation} />

      <p className="mt-6 px-4 text-xs leading-relaxed text-ink-400">
        From Towny, as the Rulercraft map has it, read every quarter of an hour. Azania Maps keeps nothing of other
        nations.
      </p>
    </article>
  )
}

/** While the Rulercraft map can't be read and nothing of the world is kept: said plainly, and nothing more. */
export function AbroadOffline({ what }: { what: 'town' | 'nation' }) {
  return (
    <article className="px-4 pb-6 pt-4">
      <p className={EYEBROW}>{what === 'town' ? 'A town abroad' : 'A nation'}</p>
      <h1 className="mt-1 font-display text-2xl leading-tight text-sea-950">Not to be seen just now</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        The rest of the world comes from the Rulercraft map, which isn’t answering, and Azania Maps hasn’t a copy of
        it saved yet. Try again in a few minutes; Azania’s own towns are on the map as ever.
      </p>
    </article>
  )
}
