import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
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
import { Pips, ReachBar } from '../ui/Marks'
import { Swatch } from '../ui/Swatch'
import { NationAllies } from './Allies'
import { BeliefsSection } from './BeliefsChart'
import { Arrival, Look, Survey } from './islands'
import { NationPeople, Residents } from './people'
import { EYEBROW, Facts, money, PanelHead, PanelSection } from './shared'
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

/**
 * A distance against the reach: the bar and its within-or-beyond from the
 * exact distance, so they never disagree at the wall; only the figure
 * beside the bar is rounded, as farWords rounds it.
 */
function Reach({ blocks, words, className }: { blocks: number; words: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-x-2', className)}>
      <ReachBar className="min-w-0 flex-1" distance={blocks} figure={false} limit={CAPITAL_WAR_RADIUS} size="panel" words={words} />
      <span aria-hidden="true" className="shrink-0 font-mono text-[15px] font-semibold text-ink-900 tabular-nums">
        {farWords(blocks).replace(/ blocks$/, '')} <span className="font-normal text-ink-500">of {CAPITAL_WAR_RADIUS.toLocaleString('en-GB')} blocks</span>
      </span>
    </div>
  )
}

/** The rule a nation's reach rests on: the hint on each "Nation reach" section. */
const REACH_HINT = `A nation may besiege towns within ${CAPITAL_WAR_RADIUS.toLocaleString('en-GB')} blocks of its capital: the bar is that distance, the wall its reach.`

/** The small head over a mark in the reach section. */
const REACH_LABEL = 'font-label text-[11px] uppercase tracking-[0.18em] text-ink-500'

/** Names in a list, as a reader says them: "Oasis, Georgetown and Cape Agulhas". */
const listed = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/** Where a page abroad's facts come from, and what the map keeps of them: the head's hint on every page abroad. */
const SOURCE_HINT = 'Towny’s figures from the Rulercraft map, read every quarter of an hour; nothing of them is kept here.'

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
      <PanelHead eyebrow={eyebrow} hint={SOURCE_HINT} title={spoken(town.name)}>
        {site ? (
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
            {pays ? (
              <>
                <span className="font-body text-2xl font-semibold leading-none text-ink-900 tabular-nums">
                  ${site.income!.toLocaleString('en-GB')}
                </span>
                <span className="text-[15px] text-ink-500">a day to {holder ?? 'whoever takes it'}</span>
              </>
            ) : (
              <span className="text-[15px] text-ink-500">What it pays isn’t recorded.</span>
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
              <p className="font-label text-[11px] uppercase tracking-[0.18em] text-ink-500">Ruler</p>
              <p className="truncate text-[15px] font-semibold text-ink-900">{town.ruler ?? 'None recorded'}</p>
              {town.rulerBalance !== null ? (
                <p className="text-[13px] text-ink-500">
                  Purse <span className="font-semibold tabular-nums text-ink-700">{money(town.rulerBalance)}</span>
                </p>
              ) : null}
            </div>
          </div>
        )}
        {town.home ? (
          <Survey
            className="mt-3"
            fit={town.fit}
            fitLabel={site ? 'Fit to the site' : 'Fit to town'}
            hint={
              site
                ? 'A site has no spawn of its own: that is the nearest anyone may use, and the walk from it.'
                : town.publicSpawn === false
                  ? 'Its own spawn is private, for its residents: that is the nearest anyone may use, and the walk.'
                  : undefined
            }
            point={town.home}
            route={route}
            town={route?.town.name === town.name ? route.town : undefined}
            y={64}
          />
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
                  { label: 'Bank', value: town.bank === null ? 'Not shown' : <span className="tabular-nums">{money(town.bank)}</span> },
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
          <p className="text-[15px] leading-relaxed text-ink-700">
            {/^[aeiou]/i.test(siteTitle(site)) ? 'An' : 'A'} {siteTitle(site).toLowerCase()} the server runs. It changes hands by siege, so whoever holds it is
            worth knowing.
          </p>
        </PanelSection>
      ) : null}

      <AwayParts away={town.away} from={town.home} of={site ? 'site' : 'town'} town={town.name} />

      {fromCapital != null && capital ? (
        <PanelSection hint={REACH_HINT} title="Nation reach">
          <p className={REACH_LABEL}>
            From {spoken(capital.town)}, Azania’s capital · <strong className="font-semibold text-ink-700">{reachWord(fromCapital)} its reach</strong>
          </p>
          <Reach
            blocks={fromCapital}
            className="mt-1.5"
            words={`${farWords(fromCapital)} from ${spoken(capital.town)}, Azania’s capital: ${reachWord(fromCapital)} Azania’s reach, which is ${CAPITAL_WAR_RADIUS.toLocaleString('en-GB')} blocks from its capital`}
          />
        </PanelSection>
      ) : null}

      {nation ? (
        <PanelSection title="Its nation">
          <p className="text-[15px] leading-relaxed text-ink-700">
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
  // Its towns' banks together, as far as the map gives them.
  const banked = towns.filter((town) => town.bank !== null)
  const treasury = banked.reduce((sum, town) => sum + (town.bank ?? 0), 0)
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
        hint={SOURCE_HINT}
        title={spoken(nation.name)}
      >
        <p className="mt-2 text-[15px] text-ink-500">
          {plural(towns.length, 'town')}
          {sites.length ? ` and ${plural(sites.length, 'site')}` : ''} · {plural(nation.residents, 'resident')} ·{' '}
          {plural(nation.chunks, 'chunk')}
        </p>
        {fit ? (
          <p className="mt-2 text-[12px]">
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
            ...(banked.length
              ? [
                  {
                    label: 'Town banks',
                    value: (
                      <span className="tabular-nums">
                        {money(treasury)}
                        {banked.length < towns.length ? <span className="text-ink-500"> · {banked.length} of {towns.length} towns</span> : null}
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>

      <NationSieges nation={nation.name} />

      {/* Its allies, as far as they're known (./Allies.tsx): who may turn up for it, or for whom it may. */}
      <NationAllies nation={nation.name} />

      <BeliefsSection beliefs={nation.beliefs} towns={towns.length} />

      {nation.capital && capital ? (
        <PanelSection hint={REACH_HINT} title="Nation reach">
          {/* The capitals' distance against the reach, then each side's towns within the other's, as pips with the names. */}
          {(() => {
            const between = blocksBetween(nation.capital.home, capital.home)
            const theirName = spoken(nation.name)
            const names = (list: { name: string }[]) => listed(list.map((town) => spoken(town.name)))
            return (
              <div className="space-y-3">
                <div>
                  <p className={REACH_LABEL}>
                    {spoken(nation.capital.name)} to {spoken(capital.town)}, capital to capital
                  </p>
                  <Reach
                    blocks={between}
                    className="mt-1.5"
                    words={`${spoken(nation.capital.name)}, ${theirName}’s capital, is ${farWords(between)} from ${spoken(capital.town)}, Azania’s: ${reachWord(between)} the ${CAPITAL_WAR_RADIUS.toLocaleString('en-GB')}-block reach`}
                  />
                </div>
                <div>
                  <p className={cn(REACH_LABEL, 'flex flex-wrap items-center gap-x-3 gap-y-1')}>
                    <span>Within {theirName}’s reach</span>
                    <Pips done={theirs.length} of={ours.length} words={`${theirs.length} of Azania’s ${ours.length} towns within ${theirName}’s reach`} />
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-700">
                    {theirs.length ? (
                      theirs.map((town, index) => (
                        <span key={town.slug}>
                          {index ? (index === theirs.length - 1 ? ' and ' : ', ') : null}
                          <Link className={LINK} href={townHref(town.slug)}>
                            {spoken(town.name)}
                          </Link>
                        </span>
                      ))
                    ) : (
                      <span className="text-ink-500">None of Azania’s towns.</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className={cn(REACH_LABEL, 'flex flex-wrap items-center gap-x-3 gap-y-1')}>
                    <span>Within Azania’s</span>
                    <Pips done={reachable.length} of={members.length} words={`${reachable.length} of ${theirName}’s ${members.length} towns within Azania’s reach`} />
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-700">
                    {reachable.length ? (
                      reachable.length <= 6 ? (
                        `${names(reachable)}.`
                      ) : (
                        `${reachable.length === members.length ? 'All' : `${reachable.length}`} of its towns.`
                      )
                    ) : (
                      <span className="text-ink-500">None of its towns.</span>
                    )}
                  </p>
                </div>
              </div>
            )
          })()}
        </PanelSection>
      ) : null}

      {sites.length ? (
        <PanelSection
          flush
          hint={`Sites the server runs and ${spoken(nation.name)} holds, each paying it daily, and each taken, and lost, by siege.`}
          title="Holdings"
        >
          <ul className="divide-y divide-sand-300/70">
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
                      <span className="block truncate text-[15px] font-semibold text-ink-900 group-hover:text-sea-800">
                        {spoken(site.name)}
                      </span>
                      <span className="block truncate text-[13px] text-ink-500">{siteTitle(facts)}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[13px] tracking-[0.04em] text-ink-700 tabular-nums">
                      {incomeWords(facts.income) ?? 'pays nothing'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {total > 0 && sites.length > 1 ? (
            <p className="mx-4 mt-1 flex items-baseline justify-between gap-3 border-t border-sand-300 pt-2 text-[15px]">
              <span className="text-ink-500">Together, a day</span>
              <span className="font-mono text-[14px] font-semibold tracking-[0.04em] text-ink-900 tabular-nums">
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
                  <span className="block truncate text-[15px] font-semibold text-ink-900 group-hover:text-sea-800">
                    {spoken(town.name)}
                    {town.capital ? <span className={`${EYEBROW} ml-2 align-middle`}>Capital</span> : null}
                  </span>
                  <span className="block truncate text-[13px] text-ink-500">
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
    </article>
  )
}

/** While the Rulercraft map can't be read and nothing of the world is kept: said plainly, and nothing more. */
export function AbroadOffline({ what }: { what: 'town' | 'nation' }) {
  return (
    <article className="px-4 pb-6 pt-4">
      <p className={EYEBROW}>{what === 'town' ? 'A town abroad' : 'A nation'}</p>
      <h1 className="mt-1 font-display text-2xl leading-tight text-sea-950">Not to be seen just now</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
        The rest of the world comes from the Rulercraft map, which isn’t answering, and Azania Maps hasn’t a copy of
        it saved yet. Try again in a few minutes; Azania’s own towns are on the map as ever.
      </p>
    </article>
  )
}
