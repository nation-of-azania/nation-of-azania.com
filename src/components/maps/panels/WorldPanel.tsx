'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { homeNationOf } from '@/maps/abroad'
import type { ContinentId } from '@/maps/continents'
import { spoken } from '@/maps/data'
import { abroadHref, nationHref, townHref } from '@/maps/url'
import type { ContinentStats, NationRow, TownRow, WorldStats } from '@/maps/worldStats'

import { useMaps } from '../context'
import { useAppearance, useStore } from '../hooks'
import { Notice } from '../ui/chrome'
import { Icon } from '../ui/icons'
import { Swatch } from '../ui/Swatch'
import { BeliefsSection } from './BeliefsChart'
import { ComingText, ComingWords } from './coming'
import { FoundedChart } from './FoundedChart'
import { StatTile } from './GrowthChart'
import { Look } from './islands'
import { EYEBROW, Facts, money, PanelHead, PanelSection } from './shared'
import { WorldMap, type WorldLazy } from './WorldMap'

/**
 * The world view, /maps/world: the whole Rulercraft server in numbers.
 * Where the people are, continent by continent, on a little map of the
 * world and in a key beneath it; where Azania stands among the nations;
 * the nations ranked; the towns that stand out; when the towns standing
 * today were founded; and what the world believes. Everything is worked
 * out in the browser from the world the map has already fetched
 * (/maps/world.json, shared at the CDN), by src/maps/worldStats.ts; the
 * figures and the continent grids behind them come as a chunk of their own
 * (./worldLazy.ts), fetched the first time the view is opened. The page
 * itself sends nothing but this panel, so the server does no work for it.
 */

const LINK = 'text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900'
const ROW = 'group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-sand-100'

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`
const people = (count: number) => (count === 1 ? '1 person' : `${count.toLocaleString('en-GB')} people`)
const percent = (share: number) => (share <= 0 ? '0%' : share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`)
const ordinal = (n: number) => {
  const rest = n % 100
  const suffix = rest >= 11 && rest <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}
/** "3 Nov 2026", from a day as Towny's dates are read (YYYY-MM-DD). */
const dayWords = (day: string | null) =>
  day ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`)) : 'a day not recorded'
const timeWords = (at: number) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(at)

/** The lazily fetched module, once for the page: a view opened again has it at once. */
let loading: Promise<WorldLazy> | null = null
let loaded: WorldLazy | null = null
function useWorldLazy(): { lazy: WorldLazy | null; failed: boolean; retry: () => void } {
  const [lazy, setLazy] = useState<WorldLazy | null>(loaded)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (lazy) return
    let cancelled = false
    loading ??= import('./worldLazy').then((module) => (loaded = module))
    loading.then(
      (module) => !cancelled && setLazy(module),
      () => {
        loading = null
        if (!cancelled) setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [lazy, attempt])
  const retry = () => {
    setFailed(false)
    setAttempt((count) => count + 1)
  }
  return { lazy, failed, retry }
}

type Measure = 'residents' | 'towns' | 'chunks'
const MEASURES: { key: Measure; label: string }[] = [
  { key: 'residents', label: 'People' },
  { key: 'towns', label: 'Towns' },
  { key: 'chunks', label: 'Chunks' },
]
const measureWords = (row: { residents: number; towns: number; chunks: number }, measure: Measure) =>
  measure === 'residents' ? people(row.residents) : measure === 'towns' ? plural(row.towns, 'town') : plural(row.chunks, 'chunk')

type Standout = keyof WorldStats['towns']
const STANDOUTS: { key: Standout; label: string; note: string }[] = [
  { key: 'largest', label: 'Largest', note: 'the most people' },
  { key: 'widest', label: 'Widest', note: 'the most chunks claimed' },
  { key: 'newest', label: 'Newest', note: 'founded last' },
  { key: 'oldest', label: 'Oldest', note: 'standing longest' },
  { key: 'richest', label: 'Richest', note: 'the fullest town bank, where the map shows it' },
]

/** A choice among a few, as the layers menu offers the appearance: one pressed. */
function Segmented<T extends string>({ label, choices, value, onChange }: { label: string; choices: { key: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div aria-label={label} className="flex" role="group">
      {choices.map((choice, index) => (
        <button
          aria-pressed={value === choice.key}
          className={cn(
            'flex-1 border px-1 py-1 text-[13px] font-semibold transition-colors focus-visible:outline-saffron-500',
            value === choice.key ? 'border-sea-800 bg-sea-800 text-sand-50' : 'border-sand-300 bg-sand-50 text-sea-900 hover:bg-sand-100',
            index ? '-ml-px' : null,
          )}
          key={choice.key}
          onClick={() => onChange(choice.key)}
          type="button"
        >
          {choice.label}
        </button>
      ))}
    </div>
  )
}

export function WorldPanel() {
  const { world, worldStatus, data, look, liveStore } = useMaps()
  const home = useMemo(() => homeNationOf(data.towns), [data.towns])
  const [appearance] = useAppearance()
  const { lazy, failed, retry } = useWorldLazy()
  const reading = world?.reading ?? null
  const stats = useMemo(() => (lazy && reading ? lazy.statsOf(reading, home) : null), [lazy, reading, home])
  const frames = useMemo(() => (lazy && reading ? lazy.continentFrames(reading) : null), [lazy, reading])
  // Where a town's page is: Azania's own have their own, the rest are abroad under the slug the world gives them.
  const hrefOf = useMemo(() => {
    const own = new Map(data.towns.flatMap((town) => (town.townyId ? [[town.townyId, townHref(town.slug)]] : [])))
    const abroad = new Map(world?.towns.flatMap((town) => (town.id ? [[town.id, abroadHref(town.slug)]] : [])) ?? [])
    return (row: TownRow) => (row.id ? (own.get(row.id) ?? abroad.get(row.id)) : null) ?? abroadHref(row.slug)
  }, [data.towns, world])
  const continentName = useMemo(() => new Map(stats?.continents.map((continent) => [continent.id, continent.name]) ?? []), [stats])

  return (
    <article className="pb-6">
      <PanelHead eyebrow="Rulercraft · the whole server" title="The world in numbers">
        {stats ? (
          <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
            {plural(stats.totals.towns, 'town')}, {people(stats.totals.residents)} and {plural(stats.totals.nations, 'nation')}, as the Rulercraft map had
            them at {timeWords(stats.at)}.{worldStatus === 'saved' ? ' The map isn’t answering just now: this is the world as last saved.' : ''}
          </p>
        ) : (
          <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
            Where the server’s people are, who the big nations are, and where Azania stands, worked out in your browser from the map’s own reading
            of the world.
          </p>
        )}
        {lazy ? (
          <p className="mt-2 text-[12px]">
            <Look className={LINK} target={{ bounds: lazy.WORLD_BOUNDS }}>
              Fit the whole world
            </Look>
          </p>
        ) : null}
      </PanelHead>

      {stats && lazy ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 px-4">
            <StatTile label="Towns" measure={null} points={undefined} value={stats.totals.towns} />
            <StatTile label="People" measure={null} points={undefined} value={stats.totals.residents} />
            <StatTile label="Nations" measure={null} points={undefined} value={stats.totals.nations} />
          </div>
          <div className="mt-4 px-4">
            <Facts
              items={[
                { label: 'Claimed chunks', value: stats.totals.chunks.toLocaleString('en-GB') },
                {
                  label: 'People to a town',
                  value: `${stats.totals.perTown.mean.toLocaleString('en-GB', { maximumFractionDigits: 1 })} on average · a median of ${stats.totals.perTown.median.toLocaleString('en-GB', { maximumFractionDigits: 1 })}`,
                },
                { label: 'Founded in 30 days', value: plural(stats.totals.recent, 'town') },
                { label: 'Standing empty', value: plural(stats.totals.empty, 'town') },
                { label: 'Of no nation', value: `${plural(stats.totals.nationless.towns, 'town')} · ${people(stats.totals.nationless.residents)}` },
                {
                  label: 'The server’s own',
                  value: `${plural(stats.totals.trading, 'trading outpost')} · ${plural(stats.totals.resources, 'resource site')} · ${plural(stats.totals.landmarks, 'landmark')}`,
                },
              ]}
            />
            <p className="mt-2 text-[12px] leading-snug text-ink-400">
              People are the residents of players’ towns: the bots at the server’s sites aren’t counted. A chunk is 16 × 16 blocks, the unit a town
              claims in.
            </p>
          </div>

          <Standing stats={stats} />

          <Continents
            appearance={appearance}
            frames={frames ?? {}}
            hrefOf={hrefOf}
            lazy={lazy}
            look={look}
            liveStore={liveStore}
            ours={world!.ours}
            stats={stats}
            world={reading!}
          />

          <Nations continentName={continentName} stats={stats} />

          <Standouts continentName={continentName} hrefOf={hrefOf} stats={stats} />

          <PanelSection title="Founded, month by month">
            <p className="text-[14px] leading-relaxed text-ink-500">
              The towns standing today, by the month they were founded. Towns that have since fallen aren’t in it, so it says when today’s towns
              came, not how the server grew.
            </p>
            <FoundedChart className="mt-3" months={stats.founded} />
          </PanelSection>

          <BeliefsSection beliefs={stats.beliefs} towns={stats.totals.towns} />
        </>
      ) : worldStatus === 'down' || failed ? (
        <div className="mt-4 px-4">
          {failed ? (
            <Notice className="flex items-center gap-3" tone="warning">
              <span className="min-w-0 flex-1">The figures couldn’t be loaded.</span>
              <button className="shrink-0 font-semibold underline underline-offset-2" onClick={retry} type="button">
                Try again
              </button>
            </Notice>
          ) : (
            <p className="text-[15px] leading-relaxed text-ink-500">
              The world comes from the Rulercraft map, which isn’t answering, and Azania Maps hasn’t a copy of it saved yet. Try again in a few
              minutes.
            </p>
          )}
        </div>
      ) : (
        <ComingWorld />
      )}

      <p className="mt-6 px-4 text-[13px] leading-relaxed text-ink-400">
        From Towny, as the Rulercraft map has it, read every quarter of an hour and worked out here in your browser; nothing of it is kept. The
        continents follow Natural Earth’s lines, the sea going to the nearest, and a town is counted where its home block stands.
      </p>
    </article>
  )
}

/** The view's shape while the world, or the figures' code, is on its way (./coming.tsx). */
function ComingWorld() {
  return (
    <div aria-hidden="true">
      <div className="mt-4 grid grid-cols-3 gap-2 px-4">
        {['Towns', 'People', 'Nations'].map((label) => (
          <div className="border border-sand-300 bg-sand-50 px-3 py-2.5" key={label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">{label}</p>
            <p className="mt-1 font-body text-2xl font-semibold leading-none">
              <ComingWords width="2.5rem" />
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 px-4">
        {['5rem', '7rem', '4rem', '4.5rem'].map((width) => (
          <div key={width}>
            <p className="font-label text-[11px]">
              <ComingWords width="5rem" />
            </p>
            <p className="mt-0.5 text-[15px]">
              <ComingWords width={width} />
            </p>
          </div>
        ))}
      </div>
      <section className="mt-5 border-t border-sand-300 px-4 pt-3">
        <ComingText className="font-display text-lg" lines={1} last="40%" />
        <div className="az-coming mt-3 w-full" style={{ aspectRatio: '2 / 1' }} />
        <ComingText className="mt-3 text-[15px] leading-relaxed" lines={4} />
      </section>
    </div>
  )
}

/** Azania's standing among the nations, under the totals: for the diplomats first of all. */
function Standing({ stats }: { stats: WorldStats }) {
  const { home } = stats
  if (!home) return null
  const { nation, of, share } = home
  const capitalContinent = nation.capital ? stats.continents.find((continent) => continent.id === nation.capital!.continent) : null
  const leader = capitalContinent?.nations[0]
  const elsewhere = nation.continents.filter((where) => where.id !== nation.capital?.continent)
  return (
    <section className="mx-4 mt-4 border border-l-4 border-sand-300 border-l-saffron-400 bg-sand-100/60 px-3 py-3">
      <p className={EYEBROW}>Where Azania stands</p>
      <p className="mt-1 font-display text-xl leading-tight text-sea-950">
        {ordinal(nation.rank.residents)} of {of} nations by people
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-700">
        {ordinal(nation.rank.towns)} by towns, {ordinal(nation.rank.chunks)} by chunks claimed. {people(nation.residents)} in {plural(nation.towns, 'town')}:{' '}
        {percent(share.residents)} of the world’s people and {percent(share.towns)} of its towns.
        {capitalContinent
          ? leader?.name === nation.name
            ? ` Its capital is in ${capitalContinent.name}, where it is the largest nation of ${capitalContinent.nations.length}.`
            : ` Its capital is in ${capitalContinent.name}, where ${spoken(leader?.name ?? '')} is the largest nation and Azania ${ordinal(
                capitalContinent.nations.findIndex((one) => one.name === nation.name) + 1,
              )} of ${capitalContinent.nations.length}.`
          : ''}
        {elsewhere.length
          ? ` It has towns in ${elsewhere.map((where) => `${stats.continents.find((c) => c.id === where.id)?.name ?? where.id} (${where.towns})`).join(' and ')} as well.`
          : ''}
      </p>
    </section>
  )
}

/** The continents: the little map, the key beneath it, and the one chosen opened in place. */
function Continents({
  stats,
  world,
  ours,
  lazy,
  frames,
  look,
  liveStore,
  appearance,
  hrefOf,
}: {
  stats: WorldStats
  world: NonNullable<ReturnType<typeof useMaps>['world']>['reading']
  ours: Set<string>
  lazy: WorldLazy
  frames: Partial<Record<ContinentId, { minX: number; maxX: number; minZ: number; maxZ: number }>>
  look: ReturnType<typeof useMaps>['look']
  liveStore: ReturnType<typeof useMaps>['liveStore']
  appearance: ReturnType<typeof useAppearance>[0]
  hrefOf: (row: TownRow) => string
}) {
  const [selected, setSelected] = useState<ContinentId | null>(null)
  const [hover, setHover] = useState<ContinentId | null>(null)
  const live = useStore(liveStore)
  // Who's online, by continent: from the heads the map already polls, while their layer is on; nothing is asked for here.
  const online = useMemo(
    () => (live.status === 'live' ? lazy.countByContinent(live.players.map((player) => [player.x, player.z])) : null),
    [live, lazy],
  )
  const most = Math.max(1, ...stats.continents.map((continent) => continent.residents))
  const choose = (id: ContinentId) => {
    const next = selected === id ? null : id
    setSelected(next)
    const frame = next ? frames[next] : null
    if (frame) look({ bounds: frame })
  }

  return (
    <PanelSection flush title="The continents">
      <p className="px-4 text-[14px] leading-relaxed text-ink-500">
        Where the server’s people are: each continent washed darker the more live there, every town a dot, Azania’s in saffron. Pick one to see it
        on the map and in numbers.
      </p>
      <div className="mt-3 px-4">
        <WorldMap
          appearance={appearance}
          continents={stats.continents}
          hover={hover}
          lazy={lazy}
          onHover={setHover}
          onSelect={choose}
          ours={ours}
          selected={selected}
          world={world}
        />
      </div>
      <ul className="mt-2">
        {stats.continents.map((continent) => {
          const open = selected === continent.id
          const here = online?.[continent.id] ?? 0
          return (
            <li className={cn(open && 'bg-sand-100/70')} key={continent.id}>
              <button
                aria-expanded={open}
                className={cn(
                  'flex w-full items-center gap-3 border-l-4 px-4 py-2 text-left transition-colors hover:bg-sand-100 focus-visible:outline-saffron-500',
                  open ? 'border-saffron-400' : hover === continent.id ? 'border-saffron-400/40' : 'border-transparent',
                )}
                onClick={() => choose(continent.id)}
                onPointerEnter={(event) => event.pointerType === 'mouse' && setHover(continent.id)}
                onPointerLeave={(event) => event.pointerType === 'mouse' && setHover(null)}
                type="button"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-semibold text-ink-900">{continent.name}</span>
                    <span className="shrink-0 text-[15px] text-ink-900 tabular-nums">
                      {people(continent.residents)}
                      <span className="ml-1.5 text-[13px] text-ink-500">{percent(continent.share.residents)}</span>
                    </span>
                  </span>
                  <span aria-hidden="true" className="mt-1 block h-1.5 w-full bg-sand-200">
                    <span className="block h-full bg-sea-700" style={{ width: `${Math.max(1, (continent.residents / most) * 100)}%` }} />
                  </span>
                  <span className="mt-1 block truncate text-[13px] text-ink-500">
                    {plural(continent.towns, 'town')} · {plural(continent.nations.length, 'nation')}
                    {continent.nations[0] ? `, ${spoken(continent.nations[0].name)} the largest` : ''}
                    {here ? (
                      <>
                        {' · '}
                        <span className="az-live-dot align-middle" /> {here} online
                      </>
                    ) : null}
                  </span>
                </span>
                <Icon className={cn('h-3.5 w-3.5 shrink-0 text-ink-500 transition-transform', open && 'rotate-180')} name="chevron" />
              </button>
              {open ? (
                <ContinentDetail
                  continent={continent}
                  frame={frames[continent.id] ?? null}
                  hrefOf={hrefOf}
                  onClose={() => setSelected(null)}
                  online={here}
                  stats={stats}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </PanelSection>
  )
}

/** One continent, opened under its row: its figures, its nations, the towns that stand out there, and the server's places. */
function ContinentDetail({
  continent,
  stats,
  frame,
  online,
  hrefOf,
  onClose,
}: {
  continent: ContinentStats
  stats: WorldStats
  frame: { minX: number; maxX: number; minZ: number; maxZ: number } | null
  online: number
  hrefOf: (row: TownRow) => string
  onClose: () => void
}) {
  const shownNations = continent.nations.slice(0, 5)
  const moreNations = continent.nations.slice(5)
  const towns: { label: string; row: TownRow | null; note?: string }[] = [
    { label: 'Largest', row: continent.largest, note: continent.largest ? people(continent.largest.residents) : undefined },
    { label: 'Newest', row: continent.newest, note: continent.newest ? `founded ${dayWords(continent.newest.founded)}` : undefined },
    { label: 'Oldest', row: continent.oldest, note: continent.oldest ? `since ${dayWords(continent.oldest.founded)}` : undefined },
  ]
  const sameTown = continent.largest && continent.newest && continent.largest.id === continent.newest.id
  return (
    <div className="border-l-4 border-saffron-400 px-4 pb-4 pt-1">
      {continent.towns === 0 ? (
        <p className="text-[15px] italic text-ink-500">Nobody has settled {continent.name} yet.</p>
      ) : (
        <>
          <Facts
            items={[
              { label: 'People', value: `${continent.residents.toLocaleString('en-GB')} · ${percent(continent.share.residents)} of the world’s` },
              { label: 'Towns', value: `${continent.towns.toLocaleString('en-GB')} · ${percent(continent.share.towns)}` },
              { label: 'Chunks claimed', value: `${continent.chunks.toLocaleString('en-GB')} · ${percent(continent.land.claimed)} of its land` },
              { label: 'Capitals here', value: plural(continent.capitals, 'nation', 'nations') },
              { label: 'Of no nation', value: continent.nationless.towns ? `${plural(continent.nationless.towns, 'town')} · ${people(continent.nationless.residents)}` : 'None' },
              { label: 'Founded in 30 days', value: plural(continent.recent, 'town') },
              { label: 'Culture', value: continent.culture?.name ? `${spoken(continent.culture.name)} · ${people(continent.culture.residents)}` : 'None chosen' },
              { label: 'Religion', value: continent.religion?.name ? `${spoken(continent.religion.name)} · ${people(continent.religion.residents)}` : 'None chosen' },
              ...(online ? [{ label: 'Online now', value: people(online) }] : []),
            ]}
          />
          <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500">Nations here · {continent.nations.length}</h3>
          <ul className="mt-1 text-[14px]">
            {shownNations.map((nation) => (
              <li className="flex items-center gap-2 py-1" key={nation.slug}>
                <Swatch colour={nation.colour} />
                <Link className={cn('min-w-0 flex-1 truncate font-semibold', LINK)} href={nationHref(nation.slug)}>
                  {spoken(nation.name)}
                </Link>
                {nation.capital ? <span className={cn(EYEBROW, 'shrink-0 text-[10px]')}>Capital</span> : null}
                <span className="shrink-0 whitespace-nowrap text-[13px] text-ink-500">
                  {people(nation.residents)} · {plural(nation.towns, 'town')}
                </span>
              </li>
            ))}
            {moreNations.length ? (
              <li>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-1 py-1 font-semibold text-ink-700 focus-visible:outline-saffron-500 [&::-webkit-details-marker]:hidden">
                    {moreNations.length} more
                    <Icon className="h-3 w-3 text-ink-500 transition-transform group-open:rotate-180" name="chevron" />
                  </summary>
                  <ul className="mb-1 ml-[5px] border-l border-sand-300 pl-4 text-[13px] text-ink-700">
                    {moreNations.map((nation) => (
                      <li className="flex items-center gap-2 py-0.5" key={nation.slug}>
                        <Link className={cn('min-w-0 flex-1 truncate', LINK)} href={nationHref(nation.slug)}>
                          {spoken(nation.name)}
                        </Link>
                        <span className="shrink-0 whitespace-nowrap text-ink-500">
                          {people(nation.residents)} · {plural(nation.towns, 'town')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ) : null}
          </ul>
          <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500">Its towns</h3>
          <ul className="mt-1 text-[14px]">
            {towns
              .filter(({ row }) => row)
              .map(({ label, row, note }) => (
                <li className="flex items-baseline gap-2 py-1" key={label}>
                  <span className="w-14 shrink-0 text-[12px] uppercase tracking-[0.12em] text-ink-500">{label}</span>
                  <Link className={cn('min-w-0 truncate font-semibold', LINK)} href={hrefOf(row!)}>
                    {spoken(row!.name)}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-500">
                    {row!.nation ? spoken(row!.nation) : 'no nation'} · {note}
                  </span>
                </li>
              ))}
            {sameTown ? <li className="text-[12px] italic text-ink-500">Its largest town is also its newest.</li> : null}
          </ul>
          {continent.server.trading || continent.server.resources.length || continent.server.landmarks ? (
            <>
              <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500">The server’s places</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-700">
                {[
                  continent.server.trading ? plural(continent.server.trading, 'trading outpost') : null,
                  continent.server.landmarks ? plural(continent.server.landmarks, 'landmark') : null,
                ]
                  .filter(Boolean)
                  .join(' and ')}
                {continent.server.resources.length ? (
                  <>
                    {continent.server.trading || continent.server.landmarks ? '; ' : ''}
                    {plural(continent.server.resources.length, 'resource site')}:{' '}
                    {continent.server.resources.map((site, index) => (
                      <span key={site.slug}>
                        {index ? ', ' : ''}
                        <Link className={LINK} href={abroadHref(site.slug)}>
                          {spoken(site.name)}
                        </Link>
                        <span className="text-ink-500">
                          {site.resource ? ` (${site.resource.toLowerCase()}, ` : ' ('}
                          {site.holder ? `held by ${spoken(site.holder)})` : 'held by nobody)'}
                        </span>
                      </span>
                    ))}
                  </>
                ) : null}
                .
              </p>
            </>
          ) : null}
        </>
      )}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {frame ? (
          <Look className={LINK} target={{ bounds: frame }}>
            Show on the map
          </Look>
        ) : null}
        <button className={LINK} onClick={onClose} type="button">
          Close
        </button>
      </p>
      <p className="sr-only">
        {stats.continents.length} continents in all; the others are in the list.
      </p>
    </div>
  )
}

/** Every nation, ranked by people, towns or chunks; Azania picked out; the first ten, then all. */
function Nations({ stats, continentName }: { stats: WorldStats; continentName: Map<ContinentId, string> }) {
  const [measure, setMeasure] = useState<Measure>('residents')
  const [all, setAll] = useState(false)
  const ranked = useMemo(
    () => [...stats.nations].sort((a, b) => a.rank[measure] - b.rank[measure] || a.name.localeCompare(b.name)),
    [stats.nations, measure],
  )
  const shown = all ? ranked : ranked.slice(0, 10)
  const homeHidden = !all && stats.home && !shown.some((nation) => nation.home) ? stats.home.nation : null
  const row = (nation: NationRow) => (
    <li className={cn(nation.home && 'bg-saffron-100/60')} key={nation.slug}>
      <Link className={ROW} href={nationHref(nation.slug)}>
        <span className="w-7 shrink-0 font-mono text-[12px] tracking-[0.04em] text-ink-400 tabular-nums">{nation.rank[measure]}</span>
        <Swatch colour={nation.colour} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink-900 group-hover:text-sea-800">
            {spoken(nation.name)}
            {nation.home ? <span className={cn(EYEBROW, 'ml-2 align-middle')}>Home</span> : null}
          </span>
          <span className="block truncate text-[13px] text-ink-500">
            {MEASURES.filter((one) => one.key !== measure)
              .map((one) => measureWords(nation, one.key))
              .join(' · ')}
            {' · '}
            {nation.continents.map((where) => continentName.get(where.id) ?? where.id).join(', ')}
          </span>
        </span>
        <span className="shrink-0 text-[15px] text-ink-900 tabular-nums">{measureWords(nation, measure)}</span>
      </Link>
    </li>
  )
  return (
    <PanelSection flush title={`The nations · ${stats.nations.length}`}>
      <div className="px-4">
        <Segmented choices={MEASURES} label="Rank the nations by" onChange={setMeasure} value={measure} />
      </div>
      <ul className="mt-2 divide-y divide-sand-300/70">
        {shown.map(row)}
        {homeHidden ? (
          <>
            <li className="px-4 py-1 text-center text-[12px] text-ink-400">⋯</li>
            {row(homeHidden)}
          </>
        ) : null}
      </ul>
      {ranked.length > 10 ? (
        <p className="mt-2 px-4 text-[13px]">
          <button className={LINK} onClick={() => setAll((value) => !value)} type="button">
            {all ? 'Only the first ten' : `All ${ranked.length} nations`}
          </button>
        </p>
      ) : null}
    </PanelSection>
  )
}

/** The towns that stand out, five ways, ten of each: each a link to its page. */
function Standouts({ stats, hrefOf, continentName }: { stats: WorldStats; hrefOf: (row: TownRow) => string; continentName: Map<ContinentId, string> }) {
  const [kind, setKind] = useState<Standout>('largest')
  const rows = stats.towns[kind]
  const chosen = STANDOUTS.find((one) => one.key === kind)!
  const figure = (row: TownRow): ReactNode =>
    kind === 'widest'
      ? plural(row.chunks, 'chunk')
      : kind === 'richest'
        ? money(row.bank ?? 0)
        : kind === 'newest' || kind === 'oldest'
          ? dayWords(row.founded)
          : people(row.residents)
  return (
    <PanelSection flush title="Towns that stand out">
      <div className="px-4">
        <Segmented choices={STANDOUTS} label="Which towns" onChange={setKind} value={kind} />
        <p className="mt-2 text-[13px] text-ink-500">
          The {chosen.label.toLowerCase()} towns on the server: {chosen.note}.
        </p>
      </div>
      {rows.length ? (
        <ol className="mt-2 divide-y divide-sand-300/70">
          {rows.map((row, index) => (
            <li key={`${kind}-${row.id ?? row.slug}`}>
              <Link className={ROW} href={hrefOf(row)}>
                <span className="w-7 shrink-0 font-mono text-[12px] tracking-[0.04em] text-ink-400 tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink-900 group-hover:text-sea-800">{spoken(row.name)}</span>
                  <span className="block truncate text-[13px] text-ink-500">
                    {row.nation ? spoken(row.nation) : 'No nation'} · {continentName.get(row.continent) ?? row.continent}
                    {kind !== 'largest' ? ` · ${people(row.residents)}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-[14px] text-ink-900 tabular-nums">{figure(row)}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 px-4 text-[15px] italic text-ink-500">The map doesn’t say.</p>
      )}
    </PanelSection>
  )
}
