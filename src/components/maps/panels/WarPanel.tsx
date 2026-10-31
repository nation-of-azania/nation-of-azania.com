'use client'

import { useMemo, useState, type ReactNode } from 'react'

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
import { secondsLeftNow } from '@/maps/battle'
import type { Siege, WorldTown } from '@/maps/world'

import { useMaps } from '../context'
import { useStore } from '../hooks'
import { Head } from '../ui/Head'
import { Icon } from '../ui/icons'
import { useCopy } from '../ui/Readouts'
import { SiegeBadge } from '../ui/Siege'
import { LOW_HEALTH, Vitals } from '../ui/Vitals'
import { Wordmark } from '../ui/Wordmark'
import { clockOf, sessionWords, useSecond, type WarFocus } from '../warView'

/**
 * The war view's sidebar, in place of the panel while the view is on: a
 * console for the hour of a battle, dark where the panels are sand. The
 * one question about every person on it is how much health and armour
 * they have right now, so that is the loudest thing wherever a player
 * appears: hearts and chestplates as the game draws them, with the
 * figures in bold (ui/Vitals.tsx), the lowest health first in every
 * roster; everything else, names of nations, counts, labels, notes, is
 * set smaller and tighter beneath. The overview is the session clock and
 * the sieges, battles first; a siege is its live score (run on second by
 * second between the map's readings: src/maps/battle.ts), the banner and
 * its bonus, the balance and what it will be when the session ends, what
 * the side behind needs, and the fighters about the banner with the way
 * back for anyone outside; a nation is who it is and who of it is on,
 * each with their distance to the banner; a player is one head watched,
 * the map following them. Every figure ticks where it's shown
 * (../warView.ts → useSecond, the live store), so a poll re-renders a
 * roster and nothing else on the page.
 */

const EYEBROW = 'font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-sand-200/75'
const FIGURE = 'font-mono tabular-nums'
const SECOND = 'text-[14px] leading-snug text-sand-200/80'
const CHIP =
  'inline-flex max-w-full items-center gap-1.5 border border-sand-50/20 px-2 py-0.5 text-[14px] font-semibold leading-snug text-sand-50 hover:border-sand-50/45 hover:bg-sand-50/5 focus-visible:outline-saffron-400'
const FOOT = 'mt-4 px-4 text-[13px] leading-snug text-sand-300/70'

const n = (value: number) => value.toLocaleString('en-GB')
const signed = (value: number) => (value > 0 ? `+${n(value)}` : n(value))

/** A town as the sums want it, from the world's reading or, before it comes, Azania's own. */
type SideTown = Pick<WorldTown, 'name' | 'nation' | 'people' | 'home'>

const sideWord = (side: PlayerSide | null) => (side === 'attackers' ? 'Attacker' : side === 'defenders' ? 'Defender' : 'Other')
const sideColour = (side: PlayerSide | null) => (side === 'attackers' ? 'text-(--az-atk)' : side === 'defenders' ? 'text-(--az-def)' : 'text-sand-200/75')

/** Who a side is, by name: the attacker nation, or the defender. */
const sideName = (siege: Siege, side: BattleSide) => spoken(side === 'attackers' ? siege.attacker : siege.defender)

/** The lowest health first: the one in danger leads any roster. */
const byHealth = (a: LivePlayer, b: LivePlayer) => (a.health ?? 99) - (b.health ?? 99) || (a.armor ?? 99) - (b.armor ?? 99)

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
    <div className="az-war flex min-h-full flex-col bg-sea-950 text-sand-50">
      <header className="flex items-center gap-3 border-b border-sand-50/10 px-4 py-2">
        <Wordmark small tone="dark" />
        <SessionLine />
        <button
          className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-sand-50/25 px-2.5 text-[13px] font-semibold text-sand-50 hover:border-sand-50/50 hover:bg-sand-50/5 focus-visible:outline-saffron-400"
          onClick={onLeave}
          title="Back to the map as it was"
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="close" />
          Leave
        </button>
      </header>
      <div className="flex-1 pb-5">{body}</div>
    </div>
  )
}

/**
 * The clock the view goes by: a battle on says its own time left, read
 * from the map and run on, which outranks the schedule; otherwise the
 * schedule says when the next session begins.
 */
function useBattleClock(): { on: boolean; headline: string; detail: string } | null {
  const { war } = useMaps()
  const now = useSecond()
  if (!now) return null
  for (const siege of war.sieges) {
    if (!siege.battle) continue
    const reading = war.readings[siege.townId]?.at(-1)
    const left = reading ? secondsLeftNow(reading, now) : null
    if (left !== null) return { on: true, headline: clockOf(left), detail: 'left in this battle' }
  }
  const session = sessionWords(now)
  return { on: session.on, headline: session.headline, detail: session.on ? 'left in this battle session' : session.detail }
}

/** The clock in the header, in a line: the time left, or when the next session begins. */
function SessionLine() {
  const clock = useBattleClock()
  return (
    <span className="min-w-0 flex-1 truncate text-[13px] text-sand-200/80">
      <span className="font-label font-semibold uppercase tracking-[0.14em] text-coral-400">War</span>
      {clock ? (
        <>
          {' · '}
          <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{clock.headline}</span> {clock.on ? 'left' : 'next'}
        </>
      ) : null}
    </span>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Back to the overview"
      className="-ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center text-sand-200/80 hover:text-sand-50 focus-visible:outline-saffron-400"
      onClick={onClick}
      type="button"
    >
      <Icon className="h-5 w-5" name="back" />
    </button>
  )
}

function Gone({ back, what }: { back: ReactNode; what: string }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-3">
      {back}
      <p className="text-[15px] text-sand-200/85">{what}</p>
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
      <section className="mt-3 px-4">
        <p className={EYEBROW}>Sieges on the server{sieges.length ? ` · ${sieges.length}` : ''}</p>
        {sieges.length ? (
          <ul className="mt-1 divide-y divide-sand-50/10 border-y border-sand-50/10">
            {sieges.map((entry) => (
              <SiegeRow entry={entry} key={entry.siege.townId} onOpen={() => onFocus({ kind: 'siege', townId: entry.siege.townId })} />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[15px] leading-snug text-sand-200/85">None just now. A siege shows here the moment SiegeWar marks one; the view keeps asking.</p>
        )}
      </section>
      {nations.length ? (
        <section className="mt-3 px-4">
          <p className={EYEBROW}>Nations in the fight</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {nations.map((name) => (
              <li key={name}>
                <button className={CHIP} onClick={() => onFocus({ kind: 'nation', name })} type="button">
                  <Icon className="h-3.5 w-3.5 text-sand-200/70" name="people" />
                  <span className="truncate">{spoken(name)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <OnlineNow onFocus={onFocus} towns={towns} />
      <p className={FOOT}>Choose a siege, a nation or a player, here or on the map. Players every 1.5 s; the war every 30 s in a battle.</p>
    </>
  )
}

/** The clock, large: a fighter reads it across the room. */
function BigClock() {
  const clock = useBattleClock()
  return (
    <div className="border-b border-sand-50/10 px-4 pb-3 pt-3">
      <p className={cn(FIGURE, 'text-[38px] font-semibold leading-none tracking-tight text-sand-50')} aria-live="off">
        {clock ? (clock.on ? clock.headline : clock.headline.replace(/^in /, '')) : '--:--'}
      </p>
      <p className="mt-1 text-[14px] text-sand-200/85">
        {clock ? (clock.on ? clock.detail : `until ${clock.detail}`) : 'Reading the clock…'}
        <span className="text-sand-300/60"> · sessions at {RULES.sessionHours.map((hour) => `${String(hour).padStart(2, '0')}:00`).join(', ')} server time</span>
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
      <button className="flex w-full items-start gap-3 px-1 py-2 text-left hover:bg-sand-50/5 focus-visible:outline-saffron-400" onClick={onOpen} type="button">
        <SiegeBadge className="mt-0.5 h-7 w-7" side={side} siege={siege} />
        <span className="min-w-0 flex-1">
          <span className={cn('block font-display text-[18px] leading-tight', side ? 'text-saffron-300' : 'text-sand-50')}>{siegeHeadline(siege, side)}</span>
          <span className={cn(SECOND, 'mt-0.5 block truncate')}>
            {[siege.town ? spoken(siege.town) : null, siege.progress ? `${siege.progress.done} of ${siege.progress.of} fought` : null, siege.battle ? 'a battle on' : 'quiet']
              .filter(Boolean)
              .join(' · ')}
          </span>
          {score ? (
            <span className={cn(FIGURE, 'mt-1 flex items-baseline gap-2 text-[17px] font-semibold')}>
              <span className="text-(--az-atk)">{n(score.attacker)}</span>
              <span className="text-[12px] font-normal uppercase tracking-[0.14em] text-sand-200/70">atk · def</span>
              <span className="text-(--az-def)">{n(score.defender)}</span>
              {siege.balance !== null ? (
                <span className="ml-auto text-[13px] font-normal text-sand-200/80">
                  balance <span className="font-semibold text-sand-50">{signed(siege.balance)}</span>
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

/** Who of Azania is online just now, the lowest health first, each a row that watches them. */
function OnlineNow({ towns, onFocus }: { towns: SideTown[]; onFocus: (focus: WarFocus) => void }) {
  const { data, liveStore } = useMaps()
  const live = useStore(liveStore)
  const home = homeNationOf(data.towns)
  if (live.status === 'off') return null
  const ours = live.players
    .filter((player) => {
      const town = townOfName(player.name, towns)
      return town && sameNation(town.nation, home)
    })
    .sort(byHealth)
  return (
    <section className="mt-3 px-4">
      <p className={EYEBROW}>
        Azania online · {ours.length}
        {live.status === 'live' ? ` of ${live.online ?? live.players.length} on the server` : live.status === 'down' ? ' · the map isn’t answering' : ''}
      </p>
      {ours.length ? (
        <ul className="mt-1 divide-y divide-sand-50/10 border-y border-sand-50/10">
          {ours.map((player) => (
            <FighterRow key={player.name} onOpen={() => onFocus({ kind: 'player', name: player.name })} player={player} side={null} />
          ))}
        </ul>
      ) : live.status === 'live' ? (
        <p className="mt-1 text-[15px] text-sand-200/85">Nobody of Azania is on just now.</p>
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
      <div className="flex items-start gap-2 px-4 pt-3">
        <span className="mt-0.5">{back}</span>
        <SiegeBadge className="mt-0.5 h-8 w-8" side={side} siege={siege} />
        <div className="min-w-0 flex-1">
          <h2 className={cn('font-display text-[20px] leading-tight', side ? 'text-saffron-300' : 'text-sand-50')}>{siegeHeadline(siege, side)}</h2>
          <p className={cn(SECOND, 'mt-0.5')}>
            <span className={cn('font-semibold', siege.battle ? 'text-coral-400' : null)}>{siege.battle ? 'A battle on' : 'Quiet'}</span>
            {siege.town ? ` · ${spoken(siege.town)}` : ''}
            {siege.progress ? ` · ${siege.progress.done} of ${siege.progress.of} fought` : ''}
          </p>
          {/* The two sides, each a button to its nation. */}
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {nations.map(({ side: which, name }) => (
              <li key={which}>
                <button className={CHIP} onClick={() => onFocus({ kind: 'nation', name })} type="button">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', which === 'attackers' ? 'bg-(--az-atk)' : 'bg-(--az-def)')} />
                  <span className="truncate">{spoken(name)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {assessed ? (
        <Scoreboard assessed={assessed} now={now} ours={ours} siege={siege} />
      ) : (
        <div className="mx-4 mt-3 border border-sand-50/10 px-3 py-2 text-[15px] leading-snug text-sand-200/85">
          {siege.battle ? 'The battle’s first reading is on its way.' : 'No battle on just now: the score waits for the next session.'}
          {siege.balance !== null ? (
            <span className="mt-1 block">
              Balance <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{signed(siege.balance)}</span>
              {siege.balance ? ` for the ${siege.balance > 0 ? 'attackers' : 'defenders'}` : ', even'}.
            </span>
          ) : null}
        </div>
      )}

      <Fighters about={about} onFocus={onFocus} siege={siege} towns={towns} />

      <p className={FOOT}>
        {ASSUMED.length ? 'The zones (16 and 200 blocks), the ×3 for taking the banner back and the ±20,000 cap are SiegeWar’s defaults, which the rules don’t give. ' : ''}
        The score runs on between the map’s readings at the banner’s rate; kills can’t be foreseen. A sprint is {SPRINT_BLOCKS_PER_S} blocks a second.
      </p>
    </>
  )
}

/** The live score, the banner, the time, the balance now and to come, and the verdict, in the room they need and no more. */
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
    <div className="mt-3 border-y border-sand-50/10 bg-sand-50/[0.03] px-4 py-2.5">
      {/* The score, big, each side in its colour; the lead between. */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(EYEBROW, 'text-(--az-atk)')}>Attackers</p>
          <p className={cn(FIGURE, 'text-[34px] font-semibold leading-none tracking-tight', lead >= 0 ? 'text-sand-50' : 'text-sand-200/60')}>
            {score ? n(score.attacker) : '–'}
          </p>
        </div>
        <div className="shrink-0 pb-0.5 text-center">
          <p className={cn(FIGURE, 'text-[15px] font-semibold', lead > 0 ? 'text-(--az-atk)' : lead < 0 ? 'text-(--az-def)' : 'text-sand-200/75')}>
            {lead === 0 ? 'level' : `${signed(Math.abs(lead))} ${lead > 0 ? 'atk' : 'def'}`}
          </p>
          <p className="text-[12px] uppercase tracking-[0.14em] text-sand-300/60">this session</p>
        </div>
        <div className="min-w-0 text-right">
          <p className={cn(EYEBROW, 'text-(--az-def)')}>Defenders</p>
          <p className={cn(FIGURE, 'text-[34px] font-semibold leading-none tracking-tight', lead <= 0 ? 'text-sand-50' : 'text-sand-200/60')}>
            {score ? n(score.defender) : '–'}
          </p>
        </div>
      </div>
      <div aria-hidden="true" className="mt-1.5 flex h-1.5 overflow-hidden bg-sand-50/10">
        <span className="h-full bg-(--az-atk)" style={{ width: `${share * 100}%` }} />
        <span className="h-full bg-(--az-def)" style={{ width: `${(1 - share) * 100}%` }} />
      </div>

      {/* The banner and the clock, side by side. */}
      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="min-w-0">
          <p className={cn('text-[16px] font-semibold leading-tight', holder ? sideColour(holder) : 'text-sand-200/85')}>
            {holder ? `${holder === 'attackers' ? 'Attackers' : 'Defenders'} hold the banner` : 'Nobody holds the banner'}
          </p>
          <p className={cn(SECOND, 'mt-0.5')}>
            {holder ? (
              <>
                {reading.banner.holders} holder{reading.banner.holders === 1 ? '' : 's'} ·{' '}
                <span className={cn(FIGURE, 'font-semibold text-sand-50')}>×{multiplier.value}</span> {sourceWords}
              </>
            ) : (
              `${RULES.captureMinutes} min in the zone takes it`
            )}
          </p>
        </div>
        <div className="text-right">
          <p className={cn(FIGURE, 'text-[24px] font-semibold leading-none text-sand-50')}>{secondsLeft === null ? '–' : clockOf(secondsLeft)}</p>
          <p className="mt-0.5 text-[12px] uppercase tracking-[0.14em] text-sand-300/60">left</p>
          <span aria-hidden="true" className="mt-1 block h-1 bg-sand-50/10">
            <span className="block h-full bg-sand-50/60" style={{ width: `${Math.max(0, Math.min(1, elapsed)) * 100}%` }} />
          </span>
        </div>
      </div>

      {/* The balance, now and at the session's end. */}
      {projected && siege.balance !== null ? (
        <div className="mt-2.5 border-t border-sand-50/10 pt-2">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className={EYEBROW}>Balance</span>
            <span className={cn(FIGURE, 'text-[18px] font-semibold leading-none', siege.balance > 0 ? 'text-(--az-atk)' : siege.balance < 0 ? 'text-(--az-def)' : 'text-sand-50')}>
              {signed(siege.balance)}
            </span>
            <Icon className="h-4 w-4 shrink-0 self-center text-sand-300/60" name="arrow" />
            <span className={cn(FIGURE, 'text-[24px] font-semibold leading-none', ahead === 'attackers' ? 'text-(--az-atk)' : ahead === 'defenders' ? 'text-(--az-def)' : 'text-sand-50')}>
              {projected.balance === null ? '–' : signed(projected.balance)}
            </span>
            <span className={EYEBROW}>after this session</span>
          </p>
          <p className="mt-1 text-[13px] leading-snug text-sand-200/75">
            {projected.sessionsLeft === null ? '' : projected.sessionsLeft === 0 ? 'The last session' : `${projected.sessionsLeft} more session${projected.sessionsLeft === 1 ? '' : 's'}`}
            {projected.sessionsLeft === null ? 'If' : ' · if'} the banner stays as it is
            {paced?.balance != null && paced.balance !== projected.balance ? (
              <>
                ; at this pace of kills <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{signed(paced.balance)}</span>
              </>
            ) : null}
            .
          </p>
        </div>
      ) : null}

      <Verdict ahead={ahead} behind={behind} holder={holder} ours={ours} secondsLeft={secondsLeft} sessionsLeft={projected?.sessionsLeft ?? null} siege={siege} />
      <p className="mt-1.5 text-[12px] text-sand-300/55">Read from the map {Math.max(0, Math.round((now - reading.at) / 1000))} s ago.</p>
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
    <div className={cn('mt-2.5 border-l-4 py-0.5 pl-3', good ? 'border-lagoon-400' : bad ? 'border-coral-500' : 'border-sand-300/40')}>
      <p className={cn('text-[16px] font-semibold leading-snug', good ? 'text-lagoon-300' : bad ? 'text-coral-300' : 'text-sand-50')}>
        {who(ahead)} {sessionsLeft === 0 ? 'wins the siege as it stands' : 'leads into the next session'}
        {good ? ': hold on.' : '.'}
      </p>
      <p className="mt-0.5 text-[15px] leading-snug text-sand-100">
        {who(behind.side)} {bad ? 'must' : 'would'} make up <span className={cn(FIGURE, 'font-semibold')}>{n(behind.deficit)}</span> to come level: {ways.join(', or ')}.
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
  // The lowest health first, as the fight wants it; or the nearest the banner, as the ground does.
  const [order, setOrder] = useState<'health' | 'distance'>('health')
  const counts = (
    <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-0.5 text-[14px]">
      <span />
      <span className={cn(EYEBROW, 'text-(--az-atk)')}>Attackers</span>
      <span className={cn(EYEBROW, 'text-(--az-def)')}>Defenders</span>
      <span className="text-sand-200/80">At the banner</span>
      <span className={cn(FIGURE, 'text-[17px] font-semibold leading-tight text-sand-50')}>{about.atBanner.attackers}</span>
      <span className={cn(FIGURE, 'text-[17px] font-semibold leading-tight text-sand-50')}>{about.atBanner.defenders}</span>
      <span className="text-sand-200/80">In the zone</span>
      <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{about.inZone.attackers}</span>
      <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{about.inZone.defenders}</span>
      {about.inZone.other ? (
        <span className="col-span-3 text-[13px] text-sand-200/70">
          and {about.inZone.other} in the zone of neither side{about.atBanner.other ? `, ${about.atBanner.other} at the banner` : ''}
        </span>
      ) : null}
    </div>
  )
  if (!about.near.length)
    return (
      <section className="mx-4 mt-3 border-y border-sand-50/10 py-2">
        {counts}
        <p className="mt-2 text-[15px] text-sand-200/85">Nobody within {RULES.siegeZoneRadius * 2} blocks of the banner just now.</p>
      </section>
    )
  const sorted = order === 'health' ? [...about.near].sort((a, b) => byHealth(a.player, b.player) || a.distance - b.distance) : about.near
  const groups = SIDE_ORDER.map((side) => ({ side, entries: sorted.filter((entry) => entry.side === side) })).filter((group) => group.entries.length)
  return (
    <section className="mt-3">
      <div className="mx-4 border-y border-sand-50/10 py-2">{counts}</div>
      <div className="mt-2 flex items-center justify-between gap-3 px-4">
        <p className={EYEBROW}>Fighters · {about.near.length}</p>
        <div className="flex text-[13px]" role="group" aria-label="Order">
          {(['health', 'distance'] as const).map((choice) => (
            <button
              aria-pressed={order === choice}
              className={cn(
                'border px-2 py-0.5 font-semibold focus-visible:outline-saffron-400',
                order === choice ? 'border-sand-50/60 bg-sand-50/10 text-sand-50' : 'border-sand-50/15 text-sand-200/75 hover:text-sand-50',
                choice === 'distance' ? '-ml-px' : null,
              )}
              key={choice}
              onClick={() => setOrder(choice)}
              type="button"
            >
              {choice === 'health' ? 'Lowest health' : 'Nearest'}
            </button>
          ))}
        </div>
      </div>
      {groups.map(({ side, entries }) => (
        <div className="px-4" key={side}>
          <p className={cn(EYEBROW, 'mt-2', sideColour(side))}>
            {side === 'other' ? 'Of neither side' : `${sideWord(side)}s · ${sideName(siege, side)}`} · {entries.length}
          </p>
          <ul className="mt-0.5 divide-y divide-sand-50/10 border-y border-sand-50/10">
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

/** One fighter in a roster: their health and armour first, then head, name, and where they are to the banner. */
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
  const low = player.health !== null && player.health <= LOW_HEALTH
  return (
    <li className={low ? 'border-l-4 border-coral-500 -ml-4 pl-3' : undefined}>
      <button className="flex w-full items-center gap-2.5 py-1.5 pr-1 text-left hover:bg-sand-50/5 focus-visible:outline-saffron-400" onClick={onOpen} type="button">
        <span className={cn('az-war-head shrink-0', side ? `az-war-head-${side}` : null)}>
          <Head name={player.name} px={30} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate font-mono text-[15px] font-semibold tracking-[0.02em]', low ? 'text-coral-300' : 'text-sand-50')}>{player.name}</span>
          {where ? <span className={cn(SECOND, 'block')}>{where}</span> : null}
        </span>
        <Vitals armor={player.armor} className="shrink-0" health={player.health} />
      </button>
    </li>
  )
}

/** Where a fighter is to the banner: at it, in the zone, or outside with the time back. */
function Whereabouts({ entry, siege, towns }: { entry: AtSiege; siege: Siege; towns: SideTown[] }) {
  if (entry.atBanner) return <span className="font-semibold text-coral-300">at the banner</span>
  if (entry.inZone) return <>in the zone · {n(entry.distance)} blocks</>
  const back = wayBack(entry.player, siege, towns)
  return (
    <>
      {n(entry.distance)} blocks away · back in <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{clockOf(back.seconds)}</span>
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
  const online = live.players.filter((player) => people.some((person) => person.toLowerCase() === player.name.toLowerCase())).sort(byHealth)
  const offline = people.filter((person) => !onlineNames.has(person.toLowerCase()))
  const ours = sameNation(name, home)
  const part = siege ? sideOf({ name: '', nation: name }, siege) : null
  const theirSieges = war.sieges.filter(
    (candidate) => sameNation(candidate.attacker, name) || sameNation(candidate.defender, name) || sameNation(candidate.townNation, name),
  )
  const colour = nation?.colour ?? null
  return (
    <>
      <div className="flex items-start gap-2 px-4 pt-3">
        <span className="mt-0.5">{back}</span>
        <div className="min-w-0 flex-1">
          <h2 className={cn('font-display text-[22px] leading-tight', ours ? 'text-saffron-300' : 'text-sand-50')}>
            <span aria-hidden="true" className="mr-2 inline-block h-3 w-3 border align-baseline" style={{ background: colour ?? 'transparent', borderColor: colour ?? 'rgba(251,248,241,.4)' }} />
            {spoken(name)}
          </h2>
          <p className="mt-0.5 text-[15px] text-sand-200/90">
            {n(residents)} resident{residents === 1 ? '' : 's'} · <span className={cn('font-semibold', online.length ? 'text-lagoon-300' : 'text-sand-50')}>{online.length} online</span>
            {members.length ? ` · ${members.length} town${members.length === 1 ? '' : 's'}` : ''}
            {ours ? ' · Azania’s own' : ''}
          </p>
          {theirSieges.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {theirSieges.map((candidate) => {
                const which = sideOf({ name: '', nation: name }, candidate)
                return (
                  <li key={candidate.townId}>
                    <button className={CHIP} onClick={() => onFocus({ kind: 'siege', townId: candidate.townId })} type="button">
                      <Icon className="h-3.5 w-3.5 text-coral-400" name="war" />
                      <span className="truncate">
                        {which === 'attackers' ? 'Besieging' : which === 'defenders' ? 'Defending' : 'In the siege of'} {candidate.town ? spoken(candidate.town) : 'a town'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </div>
      <section className="mt-3 px-4">
        <p className={EYEBROW}>Online · {online.length}</p>
        {online.length ? (
          <ul className="mt-0.5 divide-y divide-sand-50/10 border-y border-sand-50/10">
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
          <p className="mt-1 text-[15px] text-sand-200/85">
            {live.status === 'live' ? `Nobody of ${spoken(name)} is on just now.` : live.status === 'down' ? 'The map isn’t answering, so who is on isn’t known.' : 'Asking who is on…'}
          </p>
        )}
      </section>
      {offline.length ? (
        <details className="mt-2 px-4 text-[14px] text-sand-200/80">
          <summary className="cursor-pointer select-none">{offline.length} offline</summary>
          <p className="mt-1 font-mono text-[13px] leading-relaxed tracking-[0.02em] text-sand-200/70">{offline.join(' · ')}</p>
        </details>
      ) : people.length === 0 ? (
        <p className="mt-2 px-4 text-[14px] text-sand-200/75">
          {world ? 'Towny’s list of its names hasn’t been read yet.' : 'The rest of the world is still on its way; its names come with it.'}
        </p>
      ) : null}
      {nation?.capital ? <p className={FOOT}>Its reach is {n(war.radius)} blocks from {spoken(nation.capital.town)}, its capital: the ring on the map.</p> : null}
    </>
  )
}

/** A player's distance to the view's banner, and the time back: as a nation's roster says it. */
function ToBanner({ player, siege, towns }: { player: LivePlayer; siege: Siege; towns: SideTown[] }) {
  const distance = Math.round(Math.hypot(player.x - siege.at[0], player.z - siege.at[1]))
  if (distance <= RULES.bannerRadius) return <span className="font-semibold text-coral-300">at the banner</span>
  if (distance <= RULES.siegeZoneRadius) return <>in the zone · {n(distance)} blocks</>
  const back = wayBack(player, siege, towns)
  return (
    <>
      {n(distance)} blocks away · back in <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{clockOf(back.seconds)}</span>
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
      <div className="flex items-start gap-2 px-4 pt-3">
        <span className="mt-1.5">{back}</span>
        <span className={cn('az-war-head mt-0.5 shrink-0', side ? `az-war-head-${side}` : null)}>
          <Head name={name} px={44} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-mono text-[20px] font-semibold leading-tight tracking-[0.02em] text-sand-50">{name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] text-sand-200/85">
            <span className={cn('font-semibold', sideColour(side))}>{side ? sideWord(side) : 'Player'}</span>
            {player ? null : <span>· offline</span>}
            {town?.nation ? (
              <button className={CHIP} onClick={() => onFocus({ kind: 'nation', name: town.nation! })} type="button">
                {spoken(town.nation)}
              </button>
            ) : (
              <span>· {town ? 'of no nation' : 'of no town the map knows'}</span>
            )}
            {town ? <span>of {spoken(town.name)}</span> : null}
          </p>
        </div>
      </div>

      {player ? (
        <>
          {/* The one player's own vitals, as large as the room allows: what the view is for. */}
          <div className="mx-4 mt-3 border-y border-sand-50/10 py-3">
            <Vitals armor={player.armor} className="w-full" health={player.health} size="large" />
          </div>
          <div className="mt-3 px-4">
            {siege && distance !== null ? (
              <p className="text-[16px] leading-snug text-sand-50">
                {distance <= RULES.bannerRadius ? (
                  <span className="font-semibold text-coral-300">At the banner</span>
                ) : distance <= RULES.siegeZoneRadius ? (
                  <>
                    In the siege zone, <span className={cn(FIGURE, 'font-semibold')}>{n(distance)}</span> blocks from the banner
                  </>
                ) : (
                  <>
                    <span className={cn(FIGURE, 'font-semibold')}>{n(distance)}</span> blocks from the banner, outside the zone
                  </>
                )}
                {backWay ? (
                  <span className="block text-[15px] text-sand-200/85">
                    Back in <span className={cn(FIGURE, 'text-[20px] font-semibold text-sand-50')}>{clockOf(backWay.seconds)}</span>{' '}
                    {backWay.via === 'spawn' ? `by /t spawn and a ${n(backWay.blocks)}-block sprint` : 'sprinting straight there'}
                  </span>
                ) : null}
              </p>
            ) : null}
            <p className={cn(FIGURE, 'mt-2 flex items-baseline gap-3 text-[15px] text-sand-200/90')}>
              <span>
                <span className="text-sand-300/60">X</span> {Math.round(player.x)} <span className="ml-1 text-sand-300/60">Y</span> {Math.round(player.y)}{' '}
                <span className="ml-1 text-sand-300/60">Z</span> {Math.round(player.z)}
              </span>
              <button
                aria-label={`Copy ${place}`}
                className="inline-flex items-center gap-1 text-[13px] text-sand-200/85 underline decoration-dotted underline-offset-2 hover:text-sand-50"
                onClick={() => place && copy(place)}
                type="button"
              >
                <Icon className="h-3.5 w-3.5" name={copied ? 'check' : 'copy'} />
                <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </p>
          </div>
          <div className="mt-3 px-4">
            <button
              aria-pressed={follow}
              className={cn(
                'inline-flex items-center gap-2 border px-3 py-2 text-[15px] font-semibold transition-colors focus-visible:outline-saffron-400',
                follow ? 'border-saffron-400 bg-saffron-400 text-sea-950' : 'border-sand-50/30 text-sand-50 hover:border-sand-50/60 hover:bg-sand-50/5',
              )}
              onClick={() => onFollow(!follow)}
              type="button"
            >
              <Icon className="h-4 w-4" name="crosshair" />
              {follow ? 'Following on the map' : 'Follow on the map'}
            </button>
            <p className="mt-1 text-[13px] text-sand-200/70">
              {follow ? 'The map moves with each reading; a drag of the map lets go.' : 'Keeps them in the middle of the map as they move.'}
            </p>
          </div>
        </>
      ) : (
        <p className="mt-3 px-4 text-[15px] leading-snug text-sand-200/85">
          {live.status === 'live' ? 'Not on the server just now, or hidden from its map.' : live.status === 'down' ? 'The map isn’t answering, so where they are isn’t known.' : 'Asking the map…'}
        </p>
      )}
    </>
  )
}

/** The sheet's folded line on a phone while the view is on: the clock, and the siege that leads. */
export function WarHandle() {
  const { war, data } = useMaps()
  const clock = useBattleClock()
  const home = homeNationOf(data.towns)
  const first = bySiegeWeight(war.sieges.map((siege) => ({ siege, side: azaniaSide(siege, { nation: home, towns: data.towns }) })))[0]
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-coral-400">
        War view{clock ? ` · ${clock.on ? `${clock.headline} left` : `next session ${clock.headline}`}` : ''}
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
