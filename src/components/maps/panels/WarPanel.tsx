'use client'

import { useMemo, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { homeNationOf, sameNation } from '@/maps/abroad'
import {
  ASSUMED,
  assessBattle,
  playersAtSiege,
  returnEstimate,
  RULES,
  sideOf,
  SPRINT_BLOCKS_PER_S,
  townOfName,
  type AtSiege,
  type BattleSide,
  type PlayerSide,
} from '@/maps/battle'
import { spoken } from '@/maps/data'
import type { Point } from '@/maps/geo'
import type { LivePlayer } from '@/maps/players'
import { azaniaSide, bySiegeWeight, siegeHeadline, type SiegeSide } from '@/maps/sieges'
import type { Siege, WorldTown } from '@/maps/world'

import { useMaps } from '../context'
import { useStore } from '../hooks'
import { Head } from '../ui/Head'
import { Icon } from '../ui/icons'
import { useCopy } from '../ui/Readouts'
import { SiegeBadge } from '../ui/Siege'
import { Vitals } from '../ui/Vitals'
import { Wordmark } from '../ui/Wordmark'
import { clockOf, sessionWords, useSecond, type WarFocus } from '../warView'

/**
 * The war view's sidebar, in place of the panel while the view is on: a
 * console for the hour of a battle, dark where the panels are sand, with
 * big figures and nothing a fighter doesn't need. The overview is the
 * sieges on the server, battles first, under the session clock; a siege
 * is its live score (run on second by second between the map's readings:
 * src/maps/battle.ts), who holds the banner and at what bonus, the
 * balance and what it will be when the session ends, what the side
 * behind needs to turn it round, and the fighters about the banner, each
 * with their health and armour and the way back for anyone outside; a
 * nation is who it is, how many, and who of it is online, with their
 * distance to the banner; a player is one head watched, the map
 * following them. Every figure ticks where it's shown (../warView.ts →
 * useSecond, the live store), so a poll re-renders the roster and
 * nothing else on the page. What the rules don't give is assumed, and the
 * foot says what.
 */

const EYEBROW = 'font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-sand-300/70'
const FIGURE = 'font-mono tabular-nums'
const CHIP =
  'inline-flex max-w-full items-center gap-1.5 border border-sand-50/15 px-2 py-0.5 text-[12px] font-semibold leading-snug text-sand-100 hover:border-sand-50/40 hover:bg-sand-50/5 focus-visible:outline-saffron-400'
const FOOT = 'mt-5 px-4 text-[11px] leading-snug text-sand-300/55'

const n = (value: number) => value.toLocaleString('en-GB')
const signed = (value: number) => (value > 0 ? `+${n(value)}` : n(value))

/** A town as the sums want it, from the world's reading or, before it comes, Azania's own. */
type SideTown = Pick<WorldTown, 'name' | 'nation' | 'people' | 'home'>

const sideWord = (side: PlayerSide | null) => (side === 'attackers' ? 'Attacker' : side === 'defenders' ? 'Defender' : 'Other')
const sideColour = (side: PlayerSide | null) => (side === 'attackers' ? 'text-(--az-atk)' : side === 'defenders' ? 'text-(--az-def)' : 'text-sand-300/70')

/** Who a side is, by name: the attacker nation, or the defender. */
const sideName = (siege: Siege, side: BattleSide) => spoken(side === 'attackers' ? siege.attacker : siege.defender)

export type WarPanelProps = {
  focus: WarFocus | null
  /** The siege the view is on (the one last looked at, or the battle): what a nation's or a player's distances are to. */
  siege: string | null
  onFocus: (focus: WarFocus | null) => void
  /** Whether the map follows the player watched. */
  follow: boolean
  onFollow: (on: boolean) => void
  onLeave: () => void
}

export function WarPanel({ focus, siege: siegeId, onFocus, follow, onFollow, onLeave }: WarPanelProps) {
  const { data, world, war } = useMaps()
  const home = useMemo(() => homeNationOf(data.towns), [data.towns])
  // The towns the sides are read from: the world's reading, Azania's own among them; until it comes, Azania's alone.
  const towns = useMemo<SideTown[]>(
    () => world?.reading.towns ?? data.towns.map((town) => ({ name: town.name, nation: town.nation, people: town.names, home: town.home })),
    [world, data.towns],
  )
  const sieges = useMemo(() => {
    const ours = { nation: home, towns: data.towns }
    return bySiegeWeight(war.sieges.map((siege) => ({ siege, side: azaniaSide(siege, ours) })))
  }, [war.sieges, home, data.towns])
  const current = sieges.find((entry) => entry.siege.townId === siegeId) ?? null

  let body: ReactNode
  const back = <BackButton onClick={() => onFocus(null)} />
  if (focus?.kind === 'siege') {
    const entry = sieges.find((candidate) => candidate.siege.townId === focus.townId)
    body = entry ? <SiegeView back={back} entry={entry} onFocus={onFocus} towns={towns} /> : <Gone back={back} what="That siege is over." />
  } else if (focus?.kind === 'nation') {
    body = <NationView back={back} home={home} name={focus.name} onFocus={onFocus} siege={current?.siege ?? null} towns={towns} />
  } else if (focus?.kind === 'player') {
    body = <PlayerView back={back} follow={follow} name={focus.name} onFocus={onFocus} onFollow={onFollow} siege={current?.siege ?? null} towns={towns} />
  } else {
    body = <Overview onFocus={onFocus} sieges={sieges} towns={towns} />
  }

  return (
    <div className="az-war flex min-h-full flex-col bg-sea-950 text-sand-100">
      <header className="flex items-center gap-3 border-b border-sand-50/10 px-4 py-3">
        <Wordmark small tone="dark" />
        <span className="min-w-0 flex-1">
          <span className={cn(EYEBROW, 'block text-coral-500')}>War view</span>
          <SessionLine />
        </span>
        <button
          className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-sand-50/20 px-2.5 text-[12px] font-semibold text-sand-100 hover:border-sand-50/50 hover:bg-sand-50/5 focus-visible:outline-saffron-400"
          onClick={onLeave}
          title="Back to the map as it was"
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="close" />
          Leave
        </button>
      </header>
      <div className="flex-1 pb-6">{body}</div>
    </div>
  )
}

/** The session's clock in the header, in a few words: the time left, or when the next begins. */
function SessionLine() {
  const now = useSecond()
  if (!now) return <span className="block text-[12px] text-sand-300/70">…</span>
  const session = sessionWords(now)
  return (
    <span className="block truncate text-[12px] text-sand-300/80">
      {session.on ? (
        <>
          <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{session.headline}</span> left in the session
        </>
      ) : (
        <>
          Next session <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{session.headline}</span>
        </>
      )}
    </span>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Back to the overview"
      className="-ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-sand-300/80 hover:text-sand-50 focus-visible:outline-saffron-400"
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" name="back" />
    </button>
  )
}

function Gone({ back, what }: { back: ReactNode; what: string }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-4">
      {back}
      <p className="text-sm text-sand-300/80">{what}</p>
    </div>
  )
}

/* The overview: the clock, the sieges, who's in them, and who's online. */

function Overview({
  sieges,
  towns,
  onFocus,
}: {
  sieges: { siege: Siege; side: SiegeSide }[]
  towns: SideTown[]
  onFocus: (focus: WarFocus) => void
}) {
  const nations = useMemo(() => {
    const seen: string[] = []
    for (const { siege } of sieges)
      for (const name of [siege.attacker, siege.defender, siege.townNation])
        if (name && !seen.some((other) => sameNation(other, name))) seen.push(name)
    return seen
  }, [sieges])
  return (
    <>
      <BigClock />
      <section className="mt-5 px-4">
        <p className={EYEBROW}>Sieges on the server{sieges.length ? ` · ${sieges.length}` : ''}</p>
        {sieges.length ? (
          <ul className="mt-2 divide-y divide-sand-50/10 border-y border-sand-50/10">
            {sieges.map((entry) => (
              <SiegeRow entry={entry} key={entry.siege.townId} onOpen={() => onFocus({ kind: 'siege', townId: entry.siege.townId })} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-sand-300/80">
            None just now. A siege shows here the moment SiegeWar marks one on the map; the view keeps asking.
          </p>
        )}
      </section>
      {nations.length ? (
        <section className="mt-5 px-4">
          <p className={EYEBROW}>Nations in the fight</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {nations.map((name) => (
              <li key={name}>
                <button className={CHIP} onClick={() => onFocus({ kind: 'nation', name })} type="button">
                  <Icon className="h-3 w-3 text-sand-300/70" name="people" />
                  <span className="truncate">{spoken(name)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <OnlineNow onFocus={onFocus} towns={towns} />
      <p className={FOOT}>
        Choose a siege, a nation or a player: on the map or here. The players every 1.5 s, the war every 30 s while a
        battle is on.
      </p>
    </>
  )
}

/** The session's clock, large: a fighter reads it across the room. */
function BigClock() {
  const now = useSecond()
  const session = now ? sessionWords(now) : null
  return (
    <div className="border-b border-sand-50/10 px-4 pb-4 pt-4">
      <p className={cn(FIGURE, 'text-[44px] font-semibold leading-none tracking-tight text-sand-50')} aria-live="off">
        {session ? (session.on ? session.headline : session.headline.replace(/^in /, '')) : '--:--'}
      </p>
      <p className="mt-1.5 text-[13px] text-sand-300/80">
        {session ? (session.on ? session.detail : `until ${session.detail}`) : 'Reading the clock…'}
      </p>
      <p className="mt-0.5 text-[11px] text-sand-300/50">
        Sessions at {RULES.sessionHours.map((hour) => `${String(hour).padStart(2, '0')}:00`).join(', ')} server time, an hour each.
      </p>
    </div>
  )
}

/** A siege in the overview's list: its badge, the headline, and its score if a battle is on. */
function SiegeRow({ entry, onOpen }: { entry: { siege: Siege; side: SiegeSide }; onOpen: () => void }) {
  const { siege, side } = entry
  const { war } = useMaps()
  const now = useSecond()
  const readings = war.readings[siege.townId] ?? []
  const assessed = siege.battle && now ? assessBattle(siege, readings, now, { attackers: 0, defenders: 0 }) : null
  const score = assessed?.score ?? null
  return (
    <li>
      <button className="flex w-full items-start gap-3 px-1 py-2.5 text-left hover:bg-sand-50/5 focus-visible:outline-saffron-400" onClick={onOpen} type="button">
        <SiegeBadge className="mt-0.5 h-7 w-7" side={side} siege={siege} />
        <span className="min-w-0 flex-1">
          <span className={cn('block font-display text-[17px] leading-tight', side ? 'text-saffron-300' : 'text-sand-50')}>{siegeHeadline(siege, side)}</span>
          <span className="mt-0.5 block truncate text-[12px] text-sand-300/70">
            {[siege.town ? spoken(siege.town) : null, siege.progress ? `${siege.progress.done} of ${siege.progress.of} fought` : null, siege.battle ? 'a battle on' : 'quiet']
              .filter(Boolean)
              .join(' · ')}
          </span>
          {score ? (
            <span className={cn(FIGURE, 'mt-1 flex items-baseline gap-2 text-[15px] font-semibold')}>
              <span className="text-(--az-atk)">{n(score.attacker)}</span>
              <span className="text-[10px] font-normal uppercase tracking-[0.16em] text-sand-300/60">atk · def</span>
              <span className="text-(--az-def)">{n(score.defender)}</span>
              {siege.balance !== null ? (
                <span className="ml-auto text-[12px] font-normal text-sand-300/70">
                  balance <span className="font-semibold text-sand-100">{signed(siege.balance)}</span>
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

/** Who is online just now, Azania's own counted, each a row that watches them. */
function OnlineNow({ towns, onFocus }: { towns: SideTown[]; onFocus: (focus: WarFocus) => void }) {
  const { data, liveStore } = useMaps()
  const live = useStore(liveStore)
  const home = homeNationOf(data.towns)
  if (live.status === 'off') return null
  const ours = live.players.filter((player) => {
    const town = townOfName(player.name, towns)
    return town && sameNation(town.nation, home)
  })
  return (
    <section className="mt-5 px-4">
      <p className={EYEBROW}>
        Online now{live.status === 'live' ? ` · ${live.online ?? live.players.length}` : live.status === 'down' ? ' · the map isn’t answering' : ''}
        {ours.length ? ` · ${ours.length} of Azania` : ''}
      </p>
      {ours.length ? (
        <ul className="mt-2 divide-y divide-sand-50/10 border-y border-sand-50/10">
          {ours.map((player) => (
            <FighterRow key={player.name} onOpen={() => onFocus({ kind: 'player', name: player.name })} player={player} side={null} />
          ))}
        </ul>
      ) : live.status === 'live' ? (
        <p className="mt-2 text-sm text-sand-300/70">Nobody of Azania is on just now.</p>
      ) : null}
    </section>
  )
}

/* A siege: the battle, assessed. */

function SiegeView({
  entry,
  towns,
  back,
  onFocus,
}: {
  entry: { siege: Siege; side: SiegeSide }
  towns: SideTown[]
  back: ReactNode
  onFocus: (focus: WarFocus) => void
}) {
  const { siege, side } = entry
  const { war, liveStore } = useMaps()
  const live = useStore(liveStore)
  const now = useSecond()
  const about = useMemo(() => playersAtSiege(siege, live.players, towns), [siege, live.players, towns])
  const readings = war.readings[siege.townId] ?? []
  const assessed = siege.battle && now ? assessBattle(siege, readings, now, { attackers: about.atBanner.attackers, defenders: about.atBanner.defenders }) : null
  // Azania's side as the sums name it, for the verdict: which side the reader is on.
  const ours: BattleSide | null = side === 'attacking' ? 'attackers' : side === 'defending' ? 'defenders' : null
  const nations = [
    { side: 'attackers' as const, name: siege.attacker },
    { side: 'defenders' as const, name: siege.defender },
  ]
  return (
    <>
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="mt-1">{back}</span>
        <SiegeBadge className="mt-0.5 h-8 w-8" side={side} siege={siege} />
        <div className="min-w-0 flex-1">
          <p className={cn(EYEBROW, siege.battle ? 'text-coral-500' : null)}>{siege.battle ? 'Siege · a battle on' : 'Siege · quiet'}</p>
          <h2 className={cn('font-display text-xl leading-tight', side ? 'text-saffron-300' : 'text-sand-50')}>{siegeHeadline(siege, side)}</h2>
          <p className="mt-0.5 text-[12px] text-sand-300/70">
            {siege.town ? `${spoken(siege.town)} · ` : ''}
            {siege.progress ? `${siege.progress.done} of ${siege.progress.of} sessions fought` : siege.status ?? ''}
          </p>
        </div>
      </div>

      {/* The two sides, each a button to its nation. */}
      <ul className="mt-3 flex flex-wrap gap-1.5 px-4">
        {nations.map(({ side: which, name }) => (
          <li key={which}>
            <button className={CHIP} onClick={() => onFocus({ kind: 'nation', name })} type="button">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', which === 'attackers' ? 'bg-(--az-atk)' : 'bg-(--az-def)')} />
              <span className={cn('text-[10px] uppercase tracking-[0.14em]', sideColour(which))}>{which === 'attackers' ? 'atk' : 'def'}</span>
              <span className="truncate">{spoken(name)}</span>
            </button>
          </li>
        ))}
      </ul>

      {assessed ? (
        <Scoreboard assessed={assessed} now={now} ours={ours} siege={siege} />
      ) : (
        <div className="mx-4 mt-4 border border-sand-50/10 px-3 py-3 text-sm leading-relaxed text-sand-300/80">
          {siege.battle ? 'The battle’s first reading is on its way.' : 'No battle on just now: the score waits for the next session.'}
          {siege.balance !== null ? (
            <span className="mt-1 block">
              Balance <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{signed(siege.balance)}</span>
              {siege.balance ? ` for the ${siege.balance > 0 ? 'attackers' : 'defenders'}` : ', even'}.
            </span>
          ) : null}
        </div>
      )}

      {/* Each side at the banner and in the zone. */}
      <div className="mx-4 mt-4 grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1 border-y border-sand-50/10 py-2 text-[13px]">
        <span />
        <span className={cn(EYEBROW, 'text-(--az-atk)')}>Attackers</span>
        <span className={cn(EYEBROW, 'text-(--az-def)')}>Defenders</span>
        <span className="text-sand-300/70">At the banner</span>
        <span className={cn(FIGURE, 'text-lg font-semibold leading-tight text-sand-50')}>{about.atBanner.attackers}</span>
        <span className={cn(FIGURE, 'text-lg font-semibold leading-tight text-sand-50')}>{about.atBanner.defenders}</span>
        <span className="text-sand-300/70">In the zone</span>
        <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{about.inZone.attackers}</span>
        <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{about.inZone.defenders}</span>
        {about.inZone.other ? (
          <span className="col-span-3 text-[11px] text-sand-300/60">
            and {about.inZone.other} in the zone of neither side{about.atBanner.other ? `, ${about.atBanner.other} at the banner` : ''}
          </span>
        ) : null}
      </div>

      <Fighters about={about} onFocus={onFocus} siege={siege} towns={towns} />

      <p className={FOOT}>
        {ASSUMED.length ? 'The zones (16 and 200 blocks), the ×3 for taking the banner back and the ±20,000 cap are SiegeWar’s defaults, which the rules don’t give. ' : ''}
        The score runs on between the map’s readings at the banner’s rate; kills can’t be foreseen. A sprint is{' '}
        {SPRINT_BLOCKS_PER_S} blocks a second.
      </p>
    </>
  )
}

/** The live score, the banner, the time, the balance now and to come, and the verdict: the heart of the view. */
function Scoreboard({
  siege,
  assessed,
  now,
  ours,
}: {
  siege: Siege
  assessed: NonNullable<ReturnType<typeof assessBattle>>
  now: number
  ours: BattleSide | null
}) {
  const { score, reading, multiplier, secondsLeft, projected, paced, behind } = assessed
  const lead = score ? score.attacker - score.defender : 0
  const total = score ? score.attacker + score.defender : 0
  const share = total ? score!.attacker / total : 0.5
  const elapsed = secondsLeft === null ? 0 : 1 - secondsLeft / (RULES.sessionMinutes * 60)
  const holder = reading.banner.side
  const sourceWords = { observed: 'seen in the points', inferred: 'from the hands it changed', assumed: 'assumed' }[multiplier.source]
  const ahead: BattleSide | null = projected?.balance ? (projected.balance > 0 ? 'attackers' : 'defenders') : null
  return (
    <div className="mt-4 border-y border-sand-50/10 bg-sand-50/[0.03] px-4 py-3">
      {/* The score, big, each side in its colour; the lead between. */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(EYEBROW, 'text-(--az-atk)')}>Attackers</p>
          <p className={cn(FIGURE, 'text-[40px] font-semibold leading-none tracking-tight', lead >= 0 ? 'text-sand-50' : 'text-sand-300/70')}>
            {score ? n(score.attacker) : '–'}
          </p>
        </div>
        <div className="shrink-0 pb-1 text-center">
          <p className={cn(FIGURE, 'text-[13px] font-semibold', lead > 0 ? 'text-(--az-atk)' : lead < 0 ? 'text-(--az-def)' : 'text-sand-300/70')}>
            {lead === 0 ? 'level' : `${signed(Math.abs(lead))} ${lead > 0 ? 'atk' : 'def'}`}
          </p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-sand-300/50">this session</p>
        </div>
        <div className="min-w-0 text-right">
          <p className={cn(EYEBROW, 'text-(--az-def)')}>Defenders</p>
          <p className={cn(FIGURE, 'text-[40px] font-semibold leading-none tracking-tight', lead <= 0 ? 'text-sand-50' : 'text-sand-300/70')}>
            {score ? n(score.defender) : '–'}
          </p>
        </div>
      </div>
      <div aria-hidden="true" className="mt-2 flex h-1.5 overflow-hidden bg-sand-50/10">
        <span className="h-full bg-(--az-atk)" style={{ width: `${share * 100}%` }} />
        <span className="h-full bg-(--az-def)" style={{ width: `${(1 - share) * 100}%` }} />
      </div>

      {/* The banner and the clock, side by side. */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className={EYEBROW}>Banner</p>
          <p className={cn('mt-0.5 text-[15px] font-semibold leading-tight', holder ? sideColour(holder) : 'text-sand-300/70')}>
            {holder ? `${holder === 'attackers' ? 'Attackers' : 'Defenders'} hold it` : 'Nobody holds it'}
          </p>
          <p className="mt-0.5 text-[12px] text-sand-300/70">
            {holder ? (
              <>
                {reading.banner.holders} holder{reading.banner.holders === 1 ? '' : 's'} ·{' '}
                <span className={cn(FIGURE, 'font-semibold text-sand-100')}>×{multiplier.value}</span> {sourceWords}
              </>
            ) : (
              `${RULES.captureMinutes} min in the zone takes it`
            )}
          </p>
        </div>
        <div className="text-right">
          <p className={EYEBROW}>Time left</p>
          <p className={cn(FIGURE, 'mt-0.5 text-[22px] font-semibold leading-none text-sand-50')}>{secondsLeft === null ? '–' : clockOf(secondsLeft)}</p>
          <span aria-hidden="true" className="mt-1.5 block h-1 bg-sand-50/10">
            <span className="block h-full bg-sand-50/60" style={{ width: `${Math.max(0, Math.min(1, elapsed)) * 100}%` }} />
          </span>
        </div>
      </div>

      {/* The balance, now and at the session's end. */}
      {projected && siege.balance !== null ? (
        <div className="mt-3 border-t border-sand-50/10 pt-3">
          <div className="flex items-end gap-3">
            <div>
              <p className={EYEBROW}>Balance</p>
              <p className={cn(FIGURE, 'text-[20px] font-semibold leading-none', siege.balance > 0 ? 'text-(--az-atk)' : siege.balance < 0 ? 'text-(--az-def)' : 'text-sand-50')}>
                {signed(siege.balance)}
              </p>
            </div>
            <Icon className="mb-1 h-4 w-4 shrink-0 text-sand-300/50" name="arrow" />
            <div>
              <p className={EYEBROW}>After this session</p>
              <p className={cn(FIGURE, 'text-[28px] font-semibold leading-none', ahead === 'attackers' ? 'text-(--az-atk)' : ahead === 'defenders' ? 'text-(--az-def)' : 'text-sand-50')}>
                {projected.balance === null ? '–' : signed(projected.balance)}
              </p>
            </div>
            <div className="ml-auto text-right text-[11px] leading-snug text-sand-300/60">
              {projected.sessionsLeft === null ? null : projected.sessionsLeft === 0 ? 'the last session' : `${projected.sessionsLeft} more session${projected.sessionsLeft === 1 ? '' : 's'}`}
              <span className="block">if the banner stays as it is</span>
            </div>
          </div>
          {paced?.balance != null && paced.balance !== projected.balance ? (
            <p className="mt-1.5 text-[12px] text-sand-300/70">
              At this battle’s pace of kills: <span className={cn(FIGURE, 'font-semibold text-sand-100')}>{signed(paced.balance)}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <Verdict ahead={ahead} behind={behind} holder={holder} ours={ours} secondsLeft={secondsLeft} sessionsLeft={projected?.sessionsLeft ?? null} siege={siege} />
      <p className="mt-2 text-[10px] text-sand-300/40">
        Read from the map {Math.max(0, Math.round((now - reading.at) / 1000))} s ago.
      </p>
    </div>
  )
}

/** Whether to stay or go, in one look: who the session's end favours, and what the side behind needs. */
function Verdict({
  siege,
  ahead,
  behind,
  holder,
  ours,
  secondsLeft,
  sessionsLeft,
}: {
  siege: Siege
  ahead: BattleSide | null
  behind: NonNullable<ReturnType<typeof assessBattle>>['behind']
  holder: BattleSide | null
  ours: BattleSide | null
  secondsLeft: number | null
  sessionsLeft: number | null
}) {
  if (!ahead || !behind) return null
  const who = (side: BattleSide) => (ours === side ? 'Azania' : sideName(siege, side))
  const good = ours === ahead
  const bad = ours === behind.side
  const minutesLeft = secondsLeft === null ? 0 : secondsLeft / 60
  const ways: string[] = [`${behind.kills} kill${behind.kills === 1 ? '' : 's'}`]
  const many = (count: number) => `${count} at the banner`
  if (behind.minutesRetaken === null) {
    // They hold it, or nobody does: more of them at it, for what's left.
    if (behind.holdersNeeded !== null) ways.push(`${many(behind.holdersNeeded)} for the rest of the session${holder === behind.side ? '' : ', once taken'}`)
  } else {
    // The enemy holds it: taking it back brings the bonus; said for those there now, and, when that won't do in time, for how many would.
    const minutes = Math.ceil(behind.minutesRetaken)
    const fits = behind.minutesRetaken <= minutesLeft
    ways.push(
      `take the banner back and hold it ${minutes} min with the ${behind.holders} there now${
        fits ? '' : behind.holdersNeeded !== null ? `, more than is left; ${many(behind.holdersNeeded)} would do it in time` : ', more than is left'
      }`,
    )
  }
  return (
    <div
      className={cn(
        'mt-3 border-l-4 py-1 pl-3',
        good ? 'border-lagoon-400' : bad ? 'border-coral-500' : 'border-sand-300/40',
      )}
    >
      <p className={cn('text-[15px] font-semibold leading-snug', good ? 'text-lagoon-300' : bad ? 'text-coral-300' : 'text-sand-50')}>
        {who(ahead)} {sessionsLeft === 0 ? 'wins the siege as it stands' : 'leads into the next session'}
        {good ? ': hold on.' : bad ? '.' : '.'}
      </p>
      <p className="mt-0.5 text-[13px] leading-snug text-sand-200/90">
        {who(behind.side)} {bad ? 'must' : 'would'} make up <span className={cn(FIGURE, 'font-semibold')}>{n(behind.deficit)}</span> to come level:{' '}
        {ways.join(', or ')}.
      </p>
    </div>
  )
}

/* The fighters about a banner, by side, each a row that watches them. */

const SIDE_ORDER: PlayerSide[] = ['attackers', 'defenders', 'other']

function Fighters({
  about,
  siege,
  towns,
  onFocus,
}: {
  about: ReturnType<typeof playersAtSiege>
  siege: Siege
  towns: SideTown[]
  onFocus: (focus: WarFocus) => void
}) {
  if (!about.near.length)
    return <p className="mt-4 px-4 text-sm text-sand-300/70">Nobody within {RULES.siegeZoneRadius * 2} blocks of the banner just now.</p>
  const groups = SIDE_ORDER.map((side) => ({ side, entries: about.near.filter((entry) => entry.side === side) })).filter((group) => group.entries.length)
  return (
    <section className="mt-4">
      {groups.map(({ side, entries }) => (
        <div className="px-4" key={side}>
          <p className={cn(EYEBROW, 'mt-3', sideColour(side))}>
            {side === 'other' ? 'Of neither side' : `${sideWord(side)}s · ${sideName(siege, side)}`} · {entries.length}
          </p>
          <ul className="mt-1 divide-y divide-sand-50/10 border-y border-sand-50/10">
            {entries.map((entry) => (
              <FighterRow
                key={entry.player.name}
                onOpen={() => onFocus({ kind: 'player', name: entry.player.name })}
                player={entry.player}
                side={entry.side}
                where={<Whereabouts entry={entry} siege={siege} towns={towns} />}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/** One fighter in a roster: head, name, health and armour, and where they are to the banner. */
function FighterRow({
  player,
  side,
  where,
  onOpen,
}: {
  player: LivePlayer
  side: PlayerSide | null
  where?: ReactNode
  onOpen: () => void
}) {
  return (
    <li>
      <button className="flex w-full items-center gap-2.5 py-1.5 pl-1 pr-1 text-left hover:bg-sand-50/5 focus-visible:outline-saffron-400" onClick={onOpen} type="button">
        <span className={cn('az-war-head shrink-0', side ? `az-war-head-${side}` : null)}>
          <Head name={player.name} px={26} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[13px] font-semibold tracking-[0.02em] text-sand-50">{player.name}</span>
          {where ? <span className="block truncate text-[11px] leading-tight text-sand-300/70">{where}</span> : null}
        </span>
        <Vitals armor={player.armor} className="shrink-0" health={player.health} />
      </button>
    </li>
  )
}

/** Where a fighter is to the banner: at it, in the zone, or outside with the time back. */
function Whereabouts({ entry, siege, towns }: { entry: AtSiege; siege: Siege; towns: SideTown[] }) {
  if (entry.atBanner) return <span className="text-coral-300">at the banner</span>
  if (entry.inZone) return <>in the zone · {n(entry.distance)} blocks</>
  const back = wayBack(entry.player, siege, towns)
  return (
    <>
      {n(entry.distance)} blocks away · back in <span className={cn(FIGURE, 'text-sand-100')}>{clockOf(back.seconds)}</span>
      {back.via === 'spawn' ? ' by /t spawn' : ''}
    </>
  )
}

/** The way back to the banner for a player: sprinting, or by their own town's spawn when that's nearer. */
function wayBack(player: LivePlayer, siege: Siege, towns: SideTown[]) {
  const home = townOfName(player.name, towns)?.home ?? null
  return returnEstimate([player.x, player.z], siege.at, home)
}

/* A nation: who it is, how many, who's online. */

function NationView({
  name,
  siege,
  towns,
  home,
  back,
  onFocus,
}: {
  name: string
  siege: Siege | null
  towns: SideTown[]
  home: string | null
  back: ReactNode
  onFocus: (focus: WarFocus) => void
}) {
  const { world, war, liveStore } = useMaps()
  const live = useStore(liveStore)
  const members = useMemo(() => towns.filter((town) => sameNation(town.nation, name)), [towns, name])
  const people = useMemo(() => members.flatMap((town) => town.people), [members])
  const nation = world?.reading.nations.find((candidate) => sameNation(candidate.name, name)) ?? null
  const residents = nation?.residents ?? people.length
  const onlineNames = new Set(live.players.map((player) => player.name.toLowerCase()))
  const online = live.players.filter((player) => people.some((person) => person.toLowerCase() === player.name.toLowerCase()))
  const offline = people.filter((person) => !onlineNames.has(person.toLowerCase()))
  const ours = sameNation(name, home)
  const part = siege ? sideOf({ name: '', nation: name }, siege) : null
  const theirSieges = war.sieges.filter(
    (candidate) => sameNation(candidate.attacker, name) || sameNation(candidate.defender, name) || sameNation(candidate.townNation, name),
  )
  const colour = nation?.colour ?? null
  return (
    <>
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="mt-1">{back}</span>
        <div className="min-w-0 flex-1">
          <p className={cn(EYEBROW, ours ? 'text-saffron-300' : null)}>
            <span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-2.5 border align-middle" style={{ background: colour ?? 'transparent', borderColor: colour ?? 'rgba(251,248,241,.4)' }} />
            {ours ? 'Nation · Azania’s own' : 'Nation'}
          </p>
          <h2 className="font-display text-2xl leading-tight text-sand-50">{spoken(name)}</h2>
          <p className={cn(FIGURE, 'mt-1 text-[13px] text-sand-300/80')}>
            <span className="text-[20px] font-semibold text-sand-50">{n(residents)}</span> resident{residents === 1 ? '' : 's'} ·{' '}
            <span className={cn('text-[20px] font-semibold', online.length ? 'text-lagoon-300' : 'text-sand-50')}>{online.length}</span> online
            {members.length ? ` · ${members.length} town${members.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
      </div>
      {theirSieges.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5 px-4">
          {theirSieges.map((candidate) => {
            const which = sideOf({ name: '', nation: name }, candidate)
            return (
              <li key={candidate.townId}>
                <button className={CHIP} onClick={() => onFocus({ kind: 'siege', townId: candidate.townId })} type="button">
                  <Icon className="h-3 w-3 text-coral-400" name="war" />
                  <span className="truncate">
                    {which === 'attackers' ? 'Besieging' : which === 'defenders' ? 'Defending' : 'In the siege of'}{' '}
                    {candidate.town ? spoken(candidate.town) : 'a town'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      <section className="mt-4 px-4">
        <p className={EYEBROW}>Online · {online.length}</p>
        {online.length ? (
          <ul className="mt-1 divide-y divide-sand-50/10 border-y border-sand-50/10">
            {online.map((player) => (
              <FighterRow
                key={player.name}
                onOpen={() => onFocus({ kind: 'player', name: player.name })}
                player={player}
                side={part}
                where={siege ? <ToBanner player={player} siege={siege} towns={towns} /> : undefined}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-sand-300/70">
            {live.status === 'live' ? `Nobody of ${spoken(name)} is on just now.` : live.status === 'down' ? 'The map isn’t answering, so who is on isn’t known.' : 'Asking who is on…'}
          </p>
        )}
      </section>
      {offline.length ? (
        <details className="mt-3 px-4 text-[12px] text-sand-300/70">
          <summary className="cursor-pointer select-none">
            {offline.length} offline
          </summary>
          <p className="mt-1 font-mono text-[11px] leading-relaxed tracking-[0.02em] text-sand-300/60">{offline.join(' · ')}</p>
        </details>
      ) : people.length === 0 ? (
        <p className="mt-3 px-4 text-[12px] text-sand-300/60">
          {world ? 'Towny’s list of its names hasn’t been read yet.' : 'The rest of the world is still on its way; its names come with it.'}
        </p>
      ) : null}
      {nation?.capital ? (
        <p className={FOOT}>
          Its reach is {n(war.radius)} blocks from {spoken(nation.capital.town)}, its capital: the ring on the map.
        </p>
      ) : null}
    </>
  )
}

/** A player's distance to the view's banner, and the time back: as a nation's roster says it. */
function ToBanner({ player, siege, towns }: { player: LivePlayer; siege: Siege; towns: SideTown[] }) {
  const distance = Math.round(Math.hypot(player.x - siege.at[0], player.z - siege.at[1]))
  if (distance <= RULES.bannerRadius) return <span className="text-coral-300">at the banner</span>
  if (distance <= RULES.siegeZoneRadius) return <>in the siege zone · {n(distance)} blocks</>
  const back = wayBack(player, siege, towns)
  return (
    <>
      {n(distance)} blocks from the banner · <span className={cn(FIGURE, 'text-sand-100')}>{clockOf(back.seconds)}</span> back
      {back.via === 'spawn' ? ' by /t spawn' : ''}
    </>
  )
}

/* One player, watched. */

function PlayerView({
  name,
  siege,
  towns,
  follow,
  back,
  onFocus,
  onFollow,
}: {
  name: string
  siege: Siege | null
  towns: SideTown[]
  follow: boolean
  back: ReactNode
  onFocus: (focus: WarFocus) => void
  onFollow: (on: boolean) => void
}) {
  const { liveStore } = useMaps()
  const live = useStore(liveStore)
  const [copied, copy] = useCopy()
  const player = live.players.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase()) ?? null
  const town = townOfName(name, towns)
  const side = siege ? sideOf(town, siege) : null
  const place = player ? `${Math.round(player.x)} ${Math.round(player.y)} ${Math.round(player.z)}` : null
  const distance = player && siege ? Math.round(Math.hypot(player.x - siege.at[0], player.z - siege.at[1])) : null
  const backWay = player && siege && distance !== null && distance > RULES.siegeZoneRadius ? wayBack(player, siege, towns) : null
  return (
    <>
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="mt-2">{back}</span>
        <span className={cn('az-war-head mt-0.5 shrink-0', side ? `az-war-head-${side}` : null)}>
          <Head name={name} px={48} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn(EYEBROW, sideColour(side))}>{side ? sideWord(side) : 'Player'}{player ? '' : ' · offline'}</p>
          <h2 className="truncate font-mono text-xl font-semibold leading-tight tracking-[0.02em] text-sand-50">{name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-sand-300/80">
            {town?.nation ? (
              <button className={CHIP} onClick={() => onFocus({ kind: 'nation', name: town.nation! })} type="button">
                {spoken(town.nation)}
              </button>
            ) : (
              <span>{town ? 'of no nation' : 'of no town the map knows'}</span>
            )}
            {town ? <span>of {spoken(town.name)}</span> : null}
          </p>
        </div>
      </div>

      {player ? (
        <>
          <div className="mx-4 mt-4 border-y border-sand-50/10 py-3">
            <Vitals armor={player.armor} health={player.health} large />
          </div>
          <div className="mt-3 px-4">
            <p className={EYEBROW}>Where</p>
            <p className={cn(FIGURE, 'mt-0.5 flex items-baseline gap-3 text-[15px] text-sand-50')}>
              <span>
                <span className="text-sand-300/50">X</span> {Math.round(player.x)} <span className="ml-1 text-sand-300/50">Y</span> {Math.round(player.y)}{' '}
                <span className="ml-1 text-sand-300/50">Z</span> {Math.round(player.z)}
              </span>
              <button
                aria-label={`Copy ${place}`}
                className="inline-flex items-center gap-1 text-[11px] text-sand-300/80 underline decoration-dotted underline-offset-2 hover:text-sand-50"
                onClick={() => place && copy(place)}
                type="button"
              >
                <Icon className="h-3 w-3" name={copied ? 'check' : 'copy'} />
                <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </p>
            {siege && distance !== null ? (
              <div className="mt-3">
                <p className={EYEBROW}>To the banner{siege.town ? ` at ${spoken(siege.town)}` : ''}</p>
                <p className="mt-0.5 text-[15px] leading-snug text-sand-50">
                  {distance <= RULES.bannerRadius ? (
                    <span className="font-semibold text-coral-300">At the banner</span>
                  ) : distance <= RULES.siegeZoneRadius ? (
                    <>
                      In the siege zone, <span className={cn(FIGURE, 'font-semibold')}>{n(distance)}</span> blocks from the banner
                    </>
                  ) : (
                    <>
                      <span className={cn(FIGURE, 'font-semibold')}>{n(distance)}</span> blocks away, outside the zone
                    </>
                  )}
                </p>
                {backWay ? (
                  <p className="mt-1 text-[13px] text-sand-300/80">
                    Back in <span className={cn(FIGURE, 'text-[18px] font-semibold text-sand-50')}>{clockOf(backWay.seconds)}</span>{' '}
                    {backWay.via === 'spawn' ? `by /t spawn and a ${n(backWay.blocks)}-block sprint` : 'sprinting straight there'}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-4 px-4">
            <button
              aria-pressed={follow}
              className={cn(
                'inline-flex items-center gap-2 border px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-saffron-400',
                follow ? 'border-saffron-400 bg-saffron-400 text-sea-950' : 'border-sand-50/25 text-sand-100 hover:border-sand-50/50 hover:bg-sand-50/5',
              )}
              onClick={() => onFollow(!follow)}
              type="button"
            >
              <Icon className="h-4 w-4" name="crosshair" />
              {follow ? 'Following on the map' : 'Follow on the map'}
            </button>
            <p className="mt-1.5 text-[11px] text-sand-300/60">
              {follow ? 'The map moves with each reading; a drag of the map lets go.' : 'Keeps them in the middle of the map as they move.'}
            </p>
          </div>
        </>
      ) : (
        <p className="mt-4 px-4 text-sm leading-relaxed text-sand-300/80">
          {live.status === 'live' ? 'Not on the server just now, or hidden from its map.' : live.status === 'down' ? 'The map isn’t answering, so where they are isn’t known.' : 'Asking the map…'}
        </p>
      )}
    </>
  )
}

/** The sheet's folded line on a phone while the view is on: the clock, and the siege that leads. */
export function WarHandle() {
  const { war, data } = useMaps()
  const now = useSecond()
  const session = now ? sessionWords(now) : null
  const home = homeNationOf(data.towns)
  const first = bySiegeWeight(war.sieges.map((siege) => ({ siege, side: azaniaSide(siege, { nation: home, towns: data.towns }) })))[0]
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-coral-400">
        War view{session ? ` · ${session.on ? `${session.headline} left` : `next session ${session.headline}`}` : ''}
      </span>
      <span className="block truncate font-display text-lg leading-tight text-sand-50">
        {first ? siegeHeadline(first.siege, first.side) : 'No siege on the server'}
      </span>
    </span>
  )
}

/** A player's side, for the heads on the map: by their town's and nation's part in the view's siege. */
export function sidesFor(siege: Siege | null, towns: SideTown[]): (name: string) => PlayerSide | null {
  if (!siege) return () => null
  return (name) => sideOf(townOfName(name, towns), siege)
}

/** Where a player stands, for the map to fly to. */
export const playerPoint = (player: LivePlayer): Point => [player.x, player.z]
