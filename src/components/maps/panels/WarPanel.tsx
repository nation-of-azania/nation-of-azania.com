'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { homeNationOf, sameNation } from '@/maps/abroad'
import { alliesOf, allySide, nationOfSide, sharedSieges, type Allied } from '@/maps/alliances'
import {
  allegianceOf,
  ASSUMED,
  assessBattle,
  captureEndsAt,
  playersAtSiege,
  reversalMultiplier,
  RULES,
  sideAtSiege,
  SPRINT_BLOCKS_PER_S,
  tickPhaseOf,
  townOfName,
  type AtSiege,
  type Banner,
  type BattleReading,
  type BattleSide,
  type PlayerSide,
  type Captures,
} from '@/maps/battle'
import { spoken } from '@/maps/data'
import type { Point } from '@/maps/geo'
import type { LivePlayer } from '@/maps/players'
import { azaniaSide, bySiegeWeight, progressWords, sideTags, siegeHeadline, type SiegeSide } from '@/maps/sieges'
import { secondsLeftNow, sessionClock } from '@/maps/battle'
import { allyShare, fighterScore } from '@/maps/fighters'
import type { WayBackWords } from '@/maps/marks'
import { outlookOf, type BattleOutlook, type Target } from '@/maps/outlook'
import type { Siege } from '@/maps/world'

import { useAlliances } from '../alliances'
import { useMaps } from '../context'
import { recordOf, useFighters, type FightersState } from '../fighters'
import { useStore } from '../hooks'
import { ENOUGH, FighterCard, OnlineDot, rankExpected, RecordMarks, SCORE_WORDS, ScoreBadge, type Expected } from '../ui/Fighter'
import { AlliesList } from './Allies'
import { OutlookDetails, OutlookSummary, totalOnline, type OnlineCount } from './Outlook'
import { returnFor, useMotion } from '../motion'
import type { Return } from '@/maps/motion'
import { Head } from '../ui/Head'
import { Hint, HintMark } from '../ui/Hint'
import { Icon } from '../ui/icons'
import { CapBalance, Meter, Pips, TrackToBanner } from '../ui/Marks'
import { useCopy } from '../ui/Readouts'
import { SiegeBadge } from '../ui/Siege'
import { LOW_HEALTH, Vitals } from '../ui/Vitals'
import { Wordmark } from '../ui/Wordmark'
import { clockOf, sessionWords, timeOf, useSecond, type SideTown, type WarFocus } from '../warView'

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
 *
 * A side's allies (src/maps/alliances.ts; ../alliances.ts brings them)
 * are counted with it everywhere SiegeWar would count them, and told apart
 * everywhere: a dashed ring, "ally of Sul America" on their row (whose ally,
 * never their own nation, which read as that nation being Azania's ally),
 * and the counts split. The sieges a side shares its fighters with get a
 * section of their own, the heart of it: whether the side can leave the
 * banner here to help there, or the other way about.
 */

const EYEBROW = 'font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-sand-200/75'
const FIGURE = 'font-mono tabular-nums'
const SECOND = 'text-[14px] leading-snug text-sand-200/80'
const CHIP =
  'inline-flex max-w-full items-center gap-1.5 border border-sand-50/20 px-2 py-0.5 text-[14px] font-semibold leading-snug text-sand-50 hover:border-sand-50/45 hover:bg-sand-50/5 focus-visible:outline-saffron-400'

const n = (value: number) => value.toLocaleString('en-GB')
const signed = (value: number) => (value > 0 ? `+${n(value)}` : n(value))

const sideWord = (side: PlayerSide | null) => (side === 'attackers' ? 'Attacker' : side === 'defenders' ? 'Defender' : 'Other')
const sideColour = (side: PlayerSide | null) => (side === 'attackers' ? 'text-(--az-atk)' : side === 'defenders' ? 'text-(--az-def)' : 'text-sand-200/75')

/** Who a side is, by name: the attacker nation, or the defender. */
const sideName = (siege: Siege, side: BattleSide) => spoken(side === 'attackers' ? siege.attacker : siege.defender)

/** An ally's mark for a row: whose ally they fight as (the side's nation: alliances.ts → nationOfSide) and who they are themselves, for the hint. */
const allyMark = (siege: Siege, side: PlayerSide | null, nation: string | null): AllyMark | null => {
  const of = side && side !== 'other' ? nationOfSide(siege, side) : null
  return of ? { of, nation } : null
}

/** The lowest health first: the one in danger leads any roster. */
const byHealth = (a: LivePlayer, b: LivePlayer) => (a.health ?? 99) - (b.health ?? 99) || (a.armor ?? 99) - (b.armor ?? 99)

/** How many of each side are online at all, wherever they stand, residents and allies apart: what the outlook reckons a need against. */
function onlineOf(siege: Siege, players: LivePlayer[], towns: SideTown[], allied: Allied): OnlineCount {
  const count: OnlineCount = { attackers: { residents: 0, allies: 0 }, defenders: { residents: 0, allies: 0 } }
  for (const player of players) {
    const { side, ally } = allegianceOf(townOfName(player.name, towns), siege, allied)
    if (side !== 'other') count[side][ally ? 'allies' : 'residents']++
  }
  return count
}

export type WarPanelProps = {
  focus: WarFocus | null
  /** The siege the view is on (the one last looked at, or the battle): what a nation's or a player's distances are to. */
  siege: string | null
  onFocus: (focus: WarFocus | null) => void
  /** Whether the map follows the player watched. */
  follow: boolean
  onFollow: (on: boolean) => void
  onLeave: () => void
  /** The captures of the view's siege under way, and its holders as seen capturing (battle.ts → stepCaptures). */
  captures?: Captures
  /** When SiegeWar's checks fall for the view's siege (battle.ts → tickPhaseOf); null until its readings say. */
  phase?: number | null
}

export function WarPanel({ focus, siege: siegeId, onFocus, follow, onFollow, onLeave, captures, phase = null }: WarPanelProps) {
  const { data, world, war } = useMaps()
  const home = useMemo(() => homeNationOf(data.towns), [data.towns])
  // The records, and the alliances with them, asked for as the view opens: every side below counts its allies.
  useAlliances(true)
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
    body = entry ? (
      <SiegeView back={back} captures={entry.siege.townId === siegeId ? captures : undefined} entry={entry} onFocus={onFocus} phase={phase} towns={towns} />
    ) : (
      <Gone back={back} what="That siege is over." />
    )
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
        <Hint text="Back to the map as it was.">
          <button
            className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-sand-50/25 px-2.5 text-[13px] font-semibold text-sand-50 hover:border-sand-50/50 hover:bg-sand-50/5 focus-visible:outline-saffron-400"
            onClick={onLeave}
            type="button"
          >
            <Icon className="h-3.5 w-3.5" name="close" />
            Leave
          </button>
        </Hint>
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

/* The overview: the clock, the sieges, who's in them, and who of them is online. */

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
        <p className={EYEBROW}>
          Sieges on the server{sieges.length ? ` · ${sieges.length}` : ''}
          <HintMark
            label="About the sieges"
            text="As SiegeWar rewrites their markers on the Rulercraft map, read every 15 s; the players every 1.5 s. Choose a siege, a nation or a player, here or on the map."
          />
        </p>
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
      <OnlineInTheFight nations={nations} onFocus={onFocus} towns={towns} />
      <TopFighters onFocus={onFocus} />
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
        <HintMark
          label="About the sessions"
          text={`Battle sessions are at ${RULES.sessionHours.map((hour) => `${String(hour).padStart(2, '0')}:00`).join(', ')} server time, ${RULES.sessionMinutes} minutes each. A battle on says its own time left, read from the map.`}
        />
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
          <span className={cn(SECOND, 'mt-0.5 flex items-center gap-x-1.5')}>
            {siege.town ? <span className="min-w-0 truncate">{spoken(siege.town)} ·</span> : null}
            <SessionPips siege={siege} />
            <span className="shrink-0">· {siege.battle ? 'a battle on' : 'quiet'}</span>
          </span>
          {score ? (
            <span className={cn(FIGURE, 'mt-1 flex items-baseline gap-2 text-[17px] font-semibold')}>
              <span className="text-(--az-atk)">{n(score.attacker)}</span>
              <span className="text-[12px] font-normal uppercase tracking-[0.14em] text-sand-200/70">atk · def</span>
              <span className="text-(--az-def)">{n(score.defender)}</span>
            </span>
          ) : null}
          {/* The siege's balance against the cap, with its figure: the one line that says how the siege stands. */}
          {siege.balance !== null ? <CapBalance className="mt-1.5" figure names={[sideName(siege, 'attackers'), sideName(siege, 'defenders')]} now={siege.balance} /> : null}
        </span>
      </button>
    </li>
  )
}

/** The sessions fought as pips, the one on now half-filled: "1 of 3 battle sessions fought", the same wherever a siege is listed. */
function SessionPips({ siege, size }: { siege: Siege; size?: 'row' | 'panel' }) {
  if (!siege.progress) return null
  return <Pips className="shrink-0" current={siege.battle ? siege.progress.done : null} done={siege.progress.done} of={siege.progress.of} size={size} words={progressWords(siege) ?? undefined} />
}

/**
 * Who of the nations in the fight is online just now, nation by nation, the
 * lowest health first, each a row that watches them: Azania first when it's
 * one of them, and not at all when it isn't. The war view is about the
 * sieges on the server, not about home; only with no siege anywhere does it
 * fall back to Azania's own.
 */
function OnlineInTheFight({ nations, towns, onFocus }: { nations: string[]; towns: SideTown[]; onFocus: (focus: WarFocus) => void }) {
  const { data, liveStore } = useMaps()
  const live = useStore(liveStore)
  const home = homeNationOf(data.towns)
  if (live.status === 'off') return null
  const fighting = nations.length > 0
  const shown = fighting
    ? [...nations].sort((a, b) => Number(sameNation(b, home)) - Number(sameNation(a, home)))
    : home
      ? [home]
      : []
  const groups = shown.map((nation) => ({
    nation,
    players: live.players
      .filter((player) => {
        const town = townOfName(player.name, towns)
        return town && sameNation(town.nation, nation)
      })
      .sort(byHealth),
  }))
  const total = groups.reduce((sum, group) => sum + group.players.length, 0)
  return (
    <section className="mt-3 px-4">
      <p className={EYEBROW}>
        {fighting ? 'Online in the fight' : 'Azania online'} · {total}
        {live.status === 'live' ? ` of ${live.online ?? live.players.length} on the server` : live.status === 'down' ? ' · the map isn’t answering' : ''}
      </p>
      {groups.map((group) =>
        group.players.length ? (
          <div className="mt-1.5" key={group.nation}>
            {fighting ? (
              <p className="text-[13px] font-semibold text-sand-100">
                {spoken(group.nation)} <span className="font-normal text-sand-200/75">· {group.players.length}</span>
              </p>
            ) : null}
            <ul className="mt-0.5 divide-y divide-sand-50/10 border-y border-sand-50/10">
              {group.players.map((player) => (
                <FighterRow key={player.name} onOpen={() => onFocus({ kind: 'player', name: player.name })} player={player} side={null} />
              ))}
            </ul>
          </div>
        ) : null,
      )}
      {total === 0 && live.status === 'live' ? (
        <p className="mt-1 text-[15px] text-sand-200/85">{fighting ? 'Nobody of the nations in the fight is on just now.' : 'Nobody of Azania is on just now.'}</p>
      ) : null}
    </section>
  )
}

/** The fighters with the best scores across the last 60 days of battles, those with enough battles to judge by. */
function TopFighters({ onFocus }: { onFocus: (focus: WarFocus) => void }) {
  const fighters = useFighters(true)
  const ranked = useMemo(
    () =>
      fighters.players
        .filter((record) => record.fought >= ENOUGH)
        .map((record) => ({ record, score: fighterScore(record) }))
        .sort((a, b) => b.score - a.score || b.record.fought - a.record.fought || a.record.name.localeCompare(b.record.name))
        .slice(0, 5),
    [fighters.players],
  )
  return (
    <section className="mt-3 px-4">
      <p className={EYEBROW}>
        Fighters’ scores{fighters.status === 'ready' && fighters.battles ? ` · ${fighters.battles} battle${fighters.battles === 1 ? '' : 's'} in 60 days` : ''}
        <HintMark
          label="About the scores"
          text={`${SCORE_WORDS} Those with ${ENOUGH} battles or more, from the last 60 days. Beside each: sessions fought of those they could, tries at the banner held, the side they last fought on.`}
        />
      </p>
      {fighters.status === 'ready' && fighters.battles === 0 ? (
        <p className="mt-1 text-[14px] leading-snug text-sand-200/80">No battles recorded yet: the tracker reads every battle from 1 November.</p>
      ) : fighters.status === 'ready' && ranked.length === 0 ? (
        <p className="mt-1 text-[14px] leading-snug text-sand-200/80">Nobody has fought {ENOUGH} battles yet: too few to judge by.</p>
      ) : fighters.status === 'down' ? (
        <p className="mt-1 text-[14px] text-sand-200/80">The records couldn’t be read just now.</p>
      ) : fighters.status !== 'ready' ? (
        <p className="mt-1 text-[14px] text-sand-200/80">Reading the records…</p>
      ) : (
        <ol className="mt-0.5 divide-y divide-sand-50/10 border-y border-sand-50/10">
          {ranked.map(({ record, score }, index) => (
            <li key={record.name}>
              <button
                className="flex w-full items-center gap-2.5 py-1 pr-1 text-left hover:bg-sand-50/5 focus-visible:outline-saffron-400"
                onClick={() => onFocus({ kind: 'player', name: record.name })}
                type="button"
              >
                <span className={cn(FIGURE, 'w-4 shrink-0 text-[13px] text-sand-200/70')}>{index + 1}</span>
                <Head name={record.name} px={24} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[14px] font-semibold tracking-[0.02em] text-sand-50">{record.name}</span>
                  <RecordMarks className="mt-0.5" record={record} tone="war" />
                </span>
                <span className={cn(FIGURE, 'text-[20px] font-semibold text-sand-50')}>{score}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {fighters.demo ? <p className="mt-1 text-[12px] italic text-sand-300/70">Made up: the war demo’s records.</p> : null}
    </section>
  )
}

/* A siege: the battle, assessed. */

function SiegeView({
  entry,
  towns,
  back,
  onFocus,
  captures,
  phase,
}: {
  entry: { siege: Siege; side: SiegeSide }
  towns: SideTown[]
  back: ReactNode
  onFocus: (focus: WarFocus) => void
  captures?: Captures
  phase: number | null
}) {
  const { siege, side } = entry
  const { war, liveStore } = useMaps()
  const live = useStore(liveStore)
  const now = useSecond()
  const { allied } = useAlliances(false)
  const about = useMemo(() => playersAtSiege(siege, live.players, towns, undefined, allied), [siege, live.players, towns, allied])
  // How many of each side are online at all, wherever they stand, allies counted as SiegeWar counts them and said apart.
  const online = useMemo(() => (live.status === 'live' ? onlineOf(siege, live.players, towns, allied) : null), [live.players, live.status, towns, siege, allied])
  const readings = war.readings[siege.townId] ?? []
  const assessed = siege.battle && now ? assessBattle(siege, readings, now, { attackers: about.atBanner.attackers, defenders: about.atBanner.defenders }) : null
  // The outlook on it, for the sieges sharing its fighters: whether a side could leave the banner here (./Outlook.tsx draws the rest).
  const outlook = assessed && now ? outlookOf(siege, assessed.reading, now, phase, online ? totalOnline(online) : null) : null
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
          <p className={cn(SECOND, 'mt-0.5 flex flex-wrap items-center gap-x-1.5')}>
            <span className={cn('font-semibold', siege.battle ? 'text-coral-400' : null)}>{siege.battle ? 'A battle on' : 'Quiet'}</span>
            {siege.town ? <span>· {spoken(siege.town)}</span> : null}
            {siege.progress ? (
              <>
                <span>·</span>
                <SessionPips siege={siege} />
              </>
            ) : null}
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
        <Scoreboard assessed={assessed} captures={captures} now={now} onFocus={onFocus} online={online} ours={ours} phase={phase} readings={readings} siege={siege} towns={towns} />
      ) : (
        <div className="mx-4 mt-3 border border-sand-50/10 px-3 py-2 text-[15px] leading-snug text-sand-200/85">
          {siege.battle ? 'The battle’s first reading is on its way.' : 'No battle on just now: the score waits for the next session.'}
          {siege.balance !== null ? (
            <span className="mt-2 flex items-start gap-x-3">
              <span className={cn(EYEBROW, 'pt-0.5')}>Balance</span>
              <CapBalance className="min-w-0 flex-1" ends={sideTags(siege)} figure names={[sideName(siege, 'attackers'), sideName(siege, 'defenders')]} now={siege.balance} size="panel" />
            </span>
          ) : null}
          {/* Between sessions the story and the sessions ahead are what there is to read: open. */}
          {now ? <OutlookDetails assessed={null} now={now} online={online} ours={ours} phase={phase} readings={readings} siege={siege} towns={towns} /> : null}
        </div>
      )}

      {now ? (
        <SharedSieges allied={allied} banner={assessed?.reading.banner ?? null} now={now} onFocus={onFocus} ours={ours} outlook={outlook} siege={siege} towns={towns} />
      ) : null}

      <Fighters about={about} onFocus={onFocus} siege={siege} towns={towns} />

      <ExpectedFighters atSiege={about.near.map((entry) => entry.player.name)} onFocus={onFocus} siege={siege} towns={towns} />
    </>
  )
}

/** How the score is run on, and what of the rules is assumed: the hint beside the live line under the scoreboard. */
const SCORE_HINT = `Run on between the map’s readings at the banner’s rate; kills can’t be foreseen.${
  ASSUMED.length ? ' The 18- and 200-block zones are SiegeWar’s defaults; the ±7,000 cap and no bonus for retaking were seen in battles.' : ''
}`

/** How a fighter's time back to the banner is reckoned, and the lock after a death: the hint beside the fighters' rosters. */
function WayBackHint() {
  return (
    <HintMark
      label="About the times back"
      text={
        <>
          The track runs two siege zones out from the banner, the zone hatched. Times back at a sprint ({SPRINT_BLOCKS_PER_S} blocks a second), or at their own pace when seen moving faster.{' '}
          <LockWords />
        </>
      }
    />
  )
}

/** What the score on each row is, said once in a roster's head. */
function ScoreHint() {
  return <HintMark label="About the score" text={SCORE_WORDS} />
}

/** The live score, the banner, the time, the balance now and to come, and the verdict, in the room they need and no more. */
function Scoreboard({
  siege,
  assessed,
  now,
  ours,
  captures,
  phase,
  onFocus,
  online,
  readings,
  towns,
}: {
  siege: Siege
  assessed: NonNullable<ReturnType<typeof assessBattle>>
  now: number
  ours: BattleSide | null
  captures?: Captures
  phase: number | null
  onFocus: (focus: WarFocus) => void
  /** How many of each side are online, residents and allies apart, for the outlook; null while the feed hasn't answered. */
  online: OnlineCount | null
  readings: BattleReading[]
  towns: SideTown[]
}) {
  const { score, reading, multiplier, secondsLeft, projected, paced, reversals } = assessed
  // The holders by name, when those seen capturing since the view opened are as many as the marker counts.
  const holderNames =
    captures && reading.banner.side && captures.holdersSide === reading.banner.side && captures.holders.length === reading.banner.holders
      ? captures.holders.map((holder) => holder.name)
      : null
  const lead = score ? score.attacker - score.defender : 0
  const total = score ? score.attacker + score.defender : 0
  const share = total ? score!.attacker / total : 0.5
  const elapsed = secondsLeft === null ? 0 : 1 - secondsLeft / (RULES.sessionMinutes * 60)
  const holder = reading.banner.side
  const sourceWords = { observed: 'seen in the points', inferred: 'from the hands it changed', assumed: 'assumed' }[multiplier.source]
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
                {reading.banner.holders} holder{reading.banner.holders === 1 ? '' : 's'}
                {/* No reversal bonus on Rulercraft (docs/war-rules.md): a multiplier is worth saying only when the points show one. */}
                {multiplier.value !== 1 ? (
                  <>
                    {' '}
                    · <span className={cn(FIGURE, 'font-semibold text-sand-50')}>×{multiplier.value}</span> {sourceWords}
                  </>
                ) : null}
              </>
            ) : (
              `${RULES.captureMinutes} min in the zone takes it`
            )}
          </p>
          {holderNames ? (
            <ul className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5">
              {holderNames.map((name) => (
                <li key={name}>
                  <button
                    className={cn('font-mono text-[14px] font-semibold tracking-[0.02em] hover:underline focus-visible:outline-saffron-400', sideColour(holder))}
                    onClick={() => onFocus({ kind: 'player', name })}
                    type="button"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="text-right">
          <p className={cn(FIGURE, 'text-[24px] font-semibold leading-none text-sand-50')}>{secondsLeft === null ? '–' : clockOf(secondsLeft)}</p>
          <p className="mt-0.5 text-[12px] uppercase tracking-[0.14em] text-sand-300/60">left</p>
          <span aria-hidden="true" className="mt-1 block h-1 bg-sand-50/10">
            <span className="block h-full bg-sand-50/60" style={{ width: `${Math.max(0, Math.min(1, elapsed)) * 100}%` }} />
          </span>
        </div>
      </div>

      <CapturesNow captures={captures} holder={holder} multiplierNext={reversalMultiplier(reversals + 1)} now={now} onFocus={onFocus} phase={phase} />

      {/* The balance, now and at the session's end: the tug of war against the cap (ui/Marks.tsx → CapBalance), the solid mark where it stands, the hollow where this session would leave it, the figures once. */}
      {projected && siege.balance !== null ? (
        <div className="mt-2.5 border-t border-sand-50/10 pt-2">
          <p className="flex items-baseline justify-between gap-x-3">
            <span className={EYEBROW}>Balance</span>
            <span aria-hidden="true" className={cn(FIGURE, 'flex items-baseline gap-x-1.5 text-[17px] font-semibold leading-none')}>
              <span className={sideColour(siege.balance > 0 ? 'attackers' : siege.balance < 0 ? 'defenders' : null)}>{signed(siege.balance)}</span>
              {projected.balance !== null ? (
                <>
                  <span className="text-[13px] font-normal text-sand-300/60">→</span>
                  <span className={sideColour(projected.balance > 0 ? 'attackers' : projected.balance < 0 ? 'defenders' : null)}>{signed(projected.balance)}</span>
                </>
              ) : null}
            </span>
          </p>
          <CapBalance after={projected.balance} className="mt-1" ends={sideTags(siege)} names={[sideName(siege, 'attackers'), sideName(siege, 'defenders')]} now={siege.balance} size="panel" />
          <p className="mt-1 text-[12px] leading-snug text-sand-300/70">
            {projected.sessionsLeft === null ? '' : projected.sessionsLeft === 0 ? 'The last session · ' : `${projected.sessionsLeft} more session${projected.sessionsLeft === 1 ? '' : 's'} · `}
            after this one if the banner stays as it is
            {paced?.balance != null && paced.balance !== projected.balance ? (
              <>
                ; at this pace of kills <span className={cn(FIGURE, 'font-semibold text-sand-200/85')}>{signed(paced.balance)}</span>
              </>
            ) : null}
            .
          </p>
        </div>
      ) : null}

      {/* The outlook (./Outlook.tsx): the glance, and the fold with the chart, the story and the sessions ahead. */}
      <OutlookSummary assessed={assessed} now={now} online={online} ours={ours} phase={phase} readings={readings} siege={siege} towns={towns} />
      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-sand-300/55">
        {/* The dot flashes as each reading lands: keyed by it, so the flash plays anew each time. */}
        <span aria-hidden="true" className="az-live-dot" key={reading.at} />
        <span>
          Live · read {Math.max(0, Math.round((now - reading.at) / 1000))} s ago
          {phase === null ? ' · the checks’ rhythm not yet read' : ''}
          <HintMark label="About the score" text={SCORE_HINT} />
        </span>
      </p>
      <OutlookDetails assessed={assessed} now={now} online={online} ours={ours} phase={phase} readings={readings} siege={siege} towns={towns} />
    </div>
  )
}

/**
 * The captures under way at the banner, each a countdown to the check
 * that completes it (battle.ts → captureEndsAt), with what completing
 * would mean: taking the banner, taking it back from the enemy with the
 * bonus, or joining the holders. The one nearest completing first; a
 * countdown at zero says "any second", since the server may need one
 * check more. The thing to read before anything else in a fight: whoever
 * is about to capture is whom to kill, or to cover.
 */
function CapturesNow({
  captures,
  holder,
  multiplierNext,
  now,
  phase,
  onFocus,
}: {
  captures?: Captures
  holder: BattleSide | null
  multiplierNext: number
  now: number
  phase: number | null
  onFocus: (focus: WarFocus) => void
}) {
  const under = captures ? [...captures.under].sort((a, b) => a[1].since - b[1].since) : []
  if (!under.length) return null
  const meaning = (side: BattleSide) =>
    holder === null ? 'takes the banner' : holder === side ? `joins the holders · +${RULES.pointsPerHolder} a check` : multiplierNext === 1 ? 'retakes it' : `retakes it · ×${multiplierNext}`
  return (
    <div className="mt-2.5 border-t border-sand-50/10 pt-2">
      {/* Its own eyebrow, not EYEBROW's: two colour utilities on one element and the stylesheet's order would pick. */}
      <p className="flex items-center gap-1.5 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-coral-300">
        <span aria-hidden="true" className="az-capture-dot" />
        Capturing · {under.length}
      </p>
      <ul className="mt-1 space-y-1.5">
        {under.map(([name, capture]) => {
          const ends = captureEndsAt(capture.since, phase)
          const left = (ends - now) / 1000
          const share = Math.max(0, Math.min(1, (now - capture.since) / Math.max(1, ends - capture.since)))
          return (
            <li key={name}>
              <button className="block w-full text-left hover:bg-sand-50/5 focus-visible:outline-saffron-400" onClick={() => onFocus({ kind: 'player', name })} type="button">
                <span className="flex items-center gap-2.5">
                  <span className={cn('az-war-head shrink-0', `az-war-head-${capture.side}`)}>
                    <Head name={name} px={26} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate font-mono text-[15px] font-semibold tracking-[0.02em]', sideColour(capture.side))}>{name}</span>
                    <span className={cn(SECOND, 'block')}>{meaning(capture.side)}</span>
                  </span>
                  <span className={cn(FIGURE, 'shrink-0 text-[22px] font-semibold leading-none', left <= 30 ? 'text-coral-300' : 'text-sand-50')}>
                    {left > 0 ? clockOf(left) : 'any second'}
                  </span>
                </span>
                <span aria-hidden="true" className="mt-1 block h-1.5 bg-sand-50/10">
                  <span
                    className={cn('block h-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none', capture.side === 'attackers' ? 'bg-(--az-atk)' : 'bg-(--az-def)')}
                    style={{ width: `${share * 100}%` }}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** How long a death in battle keeps a player from teleporting, as far as it's known. */
function LockWords() {
  const fighters = useFighters(false)
  if (fighters.status !== 'ready') return null
  return fighters.lock ? (
    <>
      After a death, no teleport for about {clockOf(fighters.lock.quickest)} (the quickest seen of {fighters.lock.seen}).
    </>
  ) : (
    <>After a death, no teleport for up to {clockOf(fighters.lockDefault)}, as far as is known.</>
  )
}

/* The sieges a side shares its fighters with: the heart of the allies' business. */

/**
 * For each side of this siege, the other battles on now in which its
 * nation or an ally of it fights (alliances.ts → sharedSieges), how many
 * of the side's people, residents and allies, stand in that siege's zone,
 * and how that battle goes for them: ahead, or short of holders. The thing
 * to read is the line under a row, when there is one: this side could
 * leave the banner here and still win (the outlook's safeToLeave) while
 * its people over there are short, or the other way about; a fighter
 * swaps sieges on that. Each row is a button to that siege. Nothing when
 * no other battle is on.
 */
function SharedSieges({
  siege,
  towns,
  allied,
  outlook,
  banner,
  ours,
  now,
  onFocus,
}: {
  siege: Siege
  towns: SideTown[]
  allied: Allied
  /** This siege's outlook, while a battle is on: whether a side could leave the banner. */
  outlook: BattleOutlook | null
  /** This siege's banner, as last read: how many a side needs is said as how many more. */
  banner: Banner | null
  ours: BattleSide | null
  now: number
  onFocus: (focus: WarFocus) => void
}) {
  const { war, liveStore } = useMaps()
  const live = useStore(liveStore)
  const sides = (['attackers', 'defenders'] as const)
    .map((side) => ({ side, shared: sharedSieges(siege, side, war.sieges, allied) }))
    .filter((entry) => entry.shared.length)
  if (!sides.length) return null
  const who = (side: BattleSide) => (ours === side ? 'Azania' : sideName(siege, side))
  return (
    <section className="mt-3 px-4">
      <p className={EYEBROW}>
        Sieges sharing fighters
        <HintMark
          label="About the shared sieges"
          text="The other battles on now in which a side’s nation or an ally of it fights. SiegeWar counts a mutual ally’s soldiers for the side, so a side’s people are its residents and its known allies; “there” is who of them stands in that siege’s zone now."
        />
      </p>
      {sides.map(({ side, shared }) => (
        <div className="mt-1.5" key={side}>
          <p className={cn('text-[13px] font-semibold', sideColour(side))}>
            {who(side)} <span className="font-normal text-sand-200/75">· {side === 'attackers' ? 'attacking' : 'defending'} here</span>
          </p>
          <ul className="mt-0.5 divide-y divide-sand-50/10 border-y border-sand-50/10">
            {shared.map((entry) => (
              <SharedSiegeRow
                allied={allied}
                banner={banner}
                entry={entry}
                key={entry.siege.townId}
                onFocus={onFocus}
                ours={ours}
                outlook={outlook}
                players={live.players}
                side={side}
                siege={siege}
                towns={towns}
                who={who}
                now={now}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/** "2 more holders", or "3 holders to take the banner": what a side needs from now, said against the banner as it stands. */
function holdersWords(need: BattleOutlook['needs'][Target][BattleSide], banner: Banner | null, side: BattleSide): string | null {
  if (need.already || need.holders === null) return null
  const holds = banner?.side === side
  const more = holds ? Math.max(1, need.holders - (banner?.holders ?? 0)) : need.holders
  return holds ? `${n(more)} more holder${more === 1 ? '' : 's'}` : `${n(more)} holder${more === 1 ? '' : 's'} to take the banner`
}

function SharedSiegeRow({
  siege,
  side,
  entry,
  towns,
  allied,
  outlook,
  banner,
  ours,
  who,
  now,
  players,
  onFocus,
}: {
  siege: Siege
  side: BattleSide
  entry: ReturnType<typeof sharedSieges>[number]
  towns: SideTown[]
  allied: Allied
  outlook: BattleOutlook | null
  banner: Banner | null
  ours: BattleSide | null
  who: (side: BattleSide) => string
  now: number
  players: LivePlayer[]
  onFocus: (focus: WarFocus) => void
}) {
  const { war, data } = useMaps()
  const other = entry.siege
  // Who of this side stands over there, and how that battle goes for the side they'd fight on.
  const there = sideAtSiege(siege, side, other, players, towns, allied)
  const readings = war.readings[other.townId] ?? []
  const about = playersAtSiege(other, players, towns, undefined, allied)
  const assessed = other.battle ? assessBattle(other, readings, now, { attackers: about.atBanner.attackers, defenders: about.atBanner.defenders }) : null
  const theirs = assessed ? outlookOf(other, assessed.reading, now, tickPhaseOf(readings), totalOnline(onlineOf(other, players, towns, allied))) : null
  const target: Target = theirs?.final ? 'siege' : 'session'
  const need = theirs?.needs[target][entry.side] ?? null
  const needWords = need ? holdersWords(need, assessed?.reading.banner ?? null, entry.side) : null
  const theirBadgeSide = azaniaSide(other, { nation: homeNationOf(data.towns), towns: data.towns })
  // Who fights over there: the side's own nation, or its ally, named.
  const allyName = entry.as === 'ally' ? spoken(nationOfSide(other, entry.side) ?? other.defender) : null
  const verb = entry.side === 'attackers' ? 'attacking' : 'defending'
  const town = other.town ? spoken(other.town) : 'a town'
  const status = !assessed
    ? 'no reading of it yet'
    : !need
      ? 'between sessions'
      : need.already
        ? `ahead there${theirs?.safeToLeave?.side === entry.side && theirs.safeToLeave.safe ? ', could leave that banner' : ''}`
        : need.holders === null
          ? `can’t turn it in the time left there · ${n(need.kills)} kills short`
          : `needs ${needWords} there · or ${n(need.kills)} kill${need.kills === 1 ? '' : 's'}`
  // The hint: leave here to help there, or the other way about.
  const canLeaveHere = outlook?.safeToLeave?.side === side && outlook.safeToLeave.safe
  const canLeaveThere = theirs?.safeToLeave?.side === entry.side && theirs.safeToLeave.safe
  const hereNeed = outlook ? outlook.needs[outlook.final ? 'siege' : 'session'][side] : null
  const hereWords = hereNeed ? holdersWords(hereNeed, banner, side) : null
  let hint: string | null = null
  if (canLeaveHere && needWords) hint = `${who(side)} can leave this banner; at ${town} ${allyName ? `their ally ${allyName} needs` : 'they need'} ${needWords}.`
  else if (canLeaveThere && hereWords)
    hint = `At ${town} ${allyName ? `their ally ${allyName}` : 'they'} could leave the banner${there.names.length ? ` (${n(there.names.length)} of ${who(side)}’s there)` : ''}; here ${who(side)} needs ${hereWords}.`
  return (
    <li>
      <button className="flex w-full items-start gap-2.5 py-1.5 pr-1 text-left hover:bg-sand-50/5 focus-visible:outline-saffron-400" onClick={() => onFocus({ kind: 'siege', townId: other.townId })} type="button">
        <SiegeBadge className="mt-0.5 h-7 w-7" side={theirBadgeSide} siege={other} />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] leading-tight text-sand-50">{town}</span>
          <span className={cn(SECOND, 'block')}>
            {allyName ? `${allyName}, their ally, ${verb}` : `${who(side)} ${verb} there too`} · {status}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={cn(FIGURE, 'block text-[20px] font-semibold leading-none', there.names.length ? 'text-sand-50' : 'text-sand-200/60')}>{there.names.length}</span>
          <span className="block text-[11px] uppercase tracking-[0.12em] text-sand-300/60">
            there{there.allies ? ` · ${there.allies} ${there.allies === 1 ? 'ally' : 'allies'}` : ''}
          </span>
        </span>
      </button>
      {hint ? (
        <p className={cn('mb-1.5 border-l-4 py-0.5 pl-3 text-[15px] font-semibold leading-snug', ours === side ? 'border-lagoon-400 text-lagoon-300' : 'border-sand-300/40 text-sand-50')}>
          {hint}
        </p>
      ) : null}
    </li>
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
  // The allies among those counted in the zone: counted with their side, as SiegeWar counts them, and said apart.
  const allies = {
    attackers: about.near.filter((entry) => entry.inZone && entry.side === 'attackers' && entry.ally).length,
    defenders: about.near.filter((entry) => entry.inZone && entry.side === 'defenders' && entry.ally).length,
  }
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
      {allies.attackers || allies.defenders ? (
        <>
          <span className="text-sand-200/80">of them allies</span>
          <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{allies.attackers}</span>
          <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{allies.defenders}</span>
        </>
      ) : null}
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
        <p className={EYEBROW}>
          Fighters · {about.near.length}
          <WayBackHint />
          <ScoreHint />
        </p>
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
      {groups.map(({ side, entries }) => {
        const allied = entries.filter((entry) => entry.ally).length
        return (
          <div className="px-4" key={side}>
            <p className={cn(EYEBROW, 'mt-2', sideColour(side))}>
              {side === 'other' ? 'Of neither side' : `${sideWord(side)}s · ${sideName(siege, side)}`} · {entries.length}
              {allied ? ` (${allied} ${allied === 1 ? 'ally' : 'allies'})` : ''}
            </p>
            <ul className="mt-0.5 divide-y divide-sand-50/10 border-y border-sand-50/10">
              {entries.map((entry) => (
                <FighterRow
                  ally={entry.ally ? allyMark(siege, entry.side, townOfName(entry.player.name, towns)?.nation ?? null) : null}
                  key={entry.player.name}
                  onOpen={() => onFocus({ kind: 'player', name: entry.player.name })}
                  player={entry.player}
                  side={entry.side}
                  where={<Whereabouts entry={entry} siege={siege} towns={towns} />}
                />
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

/** Whose ally a fighter is, by the side's nation, and their own nation (null when the map doesn't know it), for the hint. */
type AllyMark = { of: string; nation: string | null }

/**
 * One fighter in a roster: their health and armour first, then head, name,
 * and where they are to the banner. An ally of their side's nation wears
 * the dashed ring, and their row says whose ally: "ally of Sul America",
 * the side's nation; their own is in the hint.
 */
function FighterRow({
  player,
  side,
  ally = null,
  where,
  onOpen,
}: {
  player: LivePlayer
  side: PlayerSide | null
  /** Whose ally they fight as, when they fight on `side` by an alliance rather than as a resident. */
  ally?: AllyMark | null
  where?: ReactNode
  onOpen: () => void
}) {
  const low = player.health !== null && player.health <= LOW_HEALTH
  // Their score from the records, when the view has them (it never asks for them here).
  const fighters = useFighters(false)
  const record = fighters.status === 'ready' ? recordOf(fighters, player.name) : null
  return (
    <li className={low ? 'border-l-4 border-coral-500 -ml-4 pl-3' : undefined}>
      <button className="flex w-full items-center gap-2.5 py-1.5 pr-1 text-left hover:bg-sand-50/5 focus-visible:outline-saffron-400" onClick={onOpen} type="button">
        <span className={cn('az-war-head shrink-0', side ? `az-war-head-${side}` : null, ally ? 'az-war-head-ally' : null)}>
          <Head name={player.name} px={30} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate font-mono text-[15px] font-semibold tracking-[0.02em]', low ? 'text-coral-300' : 'text-sand-50')}>{player.name}</span>
            {record?.fought ? <ScoreBadge className="shrink-0 scale-90" hint={false} record={record} tone="war" /> : null}
          </span>
          {where || ally ? (
            <span className={cn(SECOND, 'block')}>
              {ally ? (
                <Hint text={`${ally.nation ? `Of ${spoken(ally.nation)}, allied` : 'Allied'} with ${spoken(ally.of)}: SiegeWar counts them for its side.`}>
                  <span className={cn('font-semibold', sideColour(side))}>ally of {spoken(ally.of)}</span>
                </Hint>
              ) : null}
              {ally && where ? ' · ' : null}
              {where}
            </span>
          ) : null}
        </span>
        <Vitals armor={player.armor} className="shrink-0" health={player.health} />
      </button>
    </li>
  )
}

/** Where a fighter is to the banner: at it, in the zone, or outside with the time back, as a track with one figure. */
function Whereabouts({ entry, siege, towns }: { entry: AtSiege; siege: Siege; towns: SideTown[] }) {
  const back = useWayBack(entry.player, siege, towns)
  return <WhereTrack back={back} distance={entry.distance} side={entry.side === 'other' ? undefined : entry.side} />
}

/** The way back as the track's words say it (src/maps/marks.ts → trackWords): the times as the clock shows them. */
const wayBackWords = (back: Return): WayBackWords => ({
  expected: back.expected !== null ? clockOf(back.expected) : null,
  pessimistic: clockOf(back.pessimistic),
  pace: back.pace,
  via: back.via,
  locked: back.locked ? clockOf(back.locked) : null,
})

/**
 * The track to the banner (ui/Marks.tsx → TrackToBanner) in a roster's
 * row: the mark where they stand, and after it the one figure that
 * matters there, "at the banner" in coral, the blocks in the zone, or
 * the time back from outside (at their pace when seen, else at a sprint;
 * the sprint and the pace are the track's words). The lock after a death
 * follows while it holds.
 */
function WhereTrack({ distance, back, side, className }: { distance: number; back: Return; side?: BattleSide; className?: string }) {
  const atBanner = distance <= RULES.bannerRadius
  const inZone = distance <= RULES.siegeZoneRadius
  const time = back.expected ?? back.pessimistic
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 align-middle', className)}>
      <span className="inline-flex w-36 shrink-0 align-middle">
        <TrackToBanner
          back={inZone ? (back.locked ? wayBackWords(back) : null) : wayBackWords(back)}
          className="w-full"
          distance={distance}
          figure={atBanner ? <span className="text-coral-300">at the banner</span> : inZone ? undefined : clockOf(time)}
          side={side}
        />
      </span>
      {!atBanner && !inZone && back.expected === null ? <span className="text-[12px] text-sand-200/70">at a sprint</span> : null}
      {!atBanner && !inZone && back.via === 'spawn' ? <span className="text-[12px] text-sand-200/70">by /t spawn</span> : null}
      <Locked back={back} />
    </span>
  )
}

/**
 * The way back to the banner for a player (src/maps/motion.ts → returnOf):
 * at a sprint, the pessimistic figure, and at their own pace when they've
 * been seen moving faster, with the lock after a death in the zone. The
 * lock is the quickest the tracker has measured, else its upper bound.
 */
function useWayBack(player: LivePlayer, siege: Siege, towns: SideTown[]): Return {
  const motion = useMotion()
  const fighters = useFighters(false)
  const now = useSecond()
  const home = townOfName(player.name, towns)?.home ?? null
  // The clock is 0 only on the server, which never renders the war view; the store's last reading stands in then.
  return returnFor(motion, player.name, [player.x, player.z], siege.at, home, now || motion.at, fighters.lock?.quickest ?? fighters.lockDefault)
}

/** The lock after a death, while it holds: a padlock and the time until they may teleport. */
function Locked({ back }: { back: Return }) {
  if (!back.locked) return null
  return (
    <Hint text="Dead in the battle a moment ago: the server keeps them from teleporting for a while.">
      <span className="inline-flex items-center gap-1 text-[13px] text-saffron-300" tabIndex={0}>
        <Icon className="h-3 w-3" name="lock" />
        <span className={cn(FIGURE, 'font-semibold')}>{clockOf(back.locked)}</span>
      </span>
    </Hint>
  )
}

/* A nation: who it is, how many, who's online, and who its allies are. */

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
  const { world, war, liveStore, now } = useMaps()
  const live = useStore(liveStore)
  const { alliances, allied, status: alliancesStatus } = useAlliances(false)
  const members = useMemo(() => towns.filter((town) => sameNation(town.nation, name)), [towns, name])
  const people = useMemo(() => members.flatMap((town) => town.people), [members])
  const nation = world?.reading.nations.find((candidate) => sameNation(candidate.name, name)) ?? null
  const residents = nation?.residents ?? people.length
  const onlineNames = new Set(live.players.map((player) => player.name.toLowerCase()))
  const online = live.players.filter((player) => people.some((person) => person.toLowerCase() === player.name.toLowerCase())).sort(byHealth)
  const offline = people.filter((person) => !onlineNames.has(person.toLowerCase()))
  const ours = sameNation(name, home)
  // Its part in the view's siege: a side of it, as a resident or, by an alliance, as its ally.
  const allegiance = siege ? allegianceOf({ name: '', nation: name }, siege, allied) : null
  const part = allegiance?.side ?? null
  // Whose ally it is there, when it fights by an alliance: the side's nation, which its rows and their head name.
  const ally = allegiance?.ally && siege ? allyMark(siege, part, name) : null
  // Its sieges: those it fights itself, and those its allies fight, in which SiegeWar would count its soldiers.
  const theirSieges = war.sieges
    .map((candidate) => {
      const own = sameNation(candidate.attacker, name) || sameNation(candidate.defender, name) || sameNation(candidate.townNation, name)
      const which = own ? allegianceOf({ name: '', nation: name }, candidate).side : (allySide(name, candidate, allied) ?? null)
      return which && which !== 'other' ? { candidate, which, asAlly: !own } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  const allyCount = alliesOf(name, alliances).length
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
            {nation?.capital ? (
              <HintMark
                label="About its reach"
                text={`Its reach, the ring on the map, is ${n(war.radius)} blocks from ${spoken(nation.capital.town)}, its capital: as far as it may besiege.`}
              />
            ) : null}
          </p>
          {theirSieges.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {theirSieges.map(({ candidate, which, asAlly }) => (
                <li key={candidate.townId}>
                  <button className={CHIP} onClick={() => onFocus({ kind: 'siege', townId: candidate.townId })} type="button">
                    <Icon className="h-3.5 w-3.5 text-coral-400" name="war" />
                    <span className="truncate">
                      {which === 'attackers' ? 'Besieging' : 'Defending'} {candidate.town ? spoken(candidate.town) : 'a town'}
                      {asAlly ? ` as an ally of ${spoken(nationOfSide(candidate, which) ?? candidate.defender)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <section className="mt-3 px-4">
        <p className={EYEBROW}>
          Online · {online.length}
          {ally && siege ? (
            <span className="normal-case tracking-normal text-sand-200/75">
              {' '}· allies of {spoken(ally.of)} at {siege.town ? spoken(siege.town) : spoken(siege.defender)}
            </span>
          ) : null}
          {siege ? <WayBackHint /> : null}
          <ScoreHint />
        </p>
        {online.length ? (
          <ul className="mt-0.5 divide-y divide-sand-50/10 border-y border-sand-50/10">
            {online.map((player) => (
              <FighterRow
                ally={ally}
                key={player.name}
                onOpen={() => onFocus({ kind: 'player', name: player.name })}
                player={player}
                side={part}
                where={siege ? <ToBanner player={player} side={part} siege={siege} towns={towns} /> : undefined}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[15px] text-sand-200/85">
            {live.status === 'live' ? `Nobody of ${spoken(name)} is on just now.` : live.status === 'down' ? 'The map isn’t answering, so who is on isn’t known.' : 'Asking who is on…'}
          </p>
        )}
      </section>
      {/* Its allies, and how each is known (./Allies.tsx): whose soldiers SiegeWar would count for it, and for whom it would count its. */}
      <section className="mt-3 px-4">
        <p className={EYEBROW}>Allies{allyCount ? ` · ${allyCount}` : ''}</p>
        <AlliesList
          alliances={alliances}
          className="mt-0.5"
          nation={name}
          now={now}
          onPick={(ally) => onFocus({ kind: 'nation', name: ally })}
          status={alliancesStatus}
          tone="war"
        />
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
    </>
  )
}

/** A player's distance to the view's banner, and the time back: as a nation's roster says it, the same track. */
function ToBanner({ player, siege, towns, side }: { player: LivePlayer; siege: Siege; towns: SideTown[]; side: PlayerSide | null }) {
  const back = useWayBack(player, siege, towns)
  const distance = Math.round(Math.hypot(player.x - siege.at[0], player.z - siege.at[1]))
  return <WhereTrack back={back} distance={distance} side={side === 'other' || !side ? undefined : side} />
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
  const motion = useMotion()
  const fighters = useFighters(false)
  const { allied } = useAlliances(false)
  const lockSeconds = fighters.lock?.quickest ?? fighters.lockDefault
  const now = useSecond()
  const [copied, copy] = useCopy()
  const player = live.players.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase()) ?? null
  const town = townOfName(name, towns)
  const allegiance = siege ? allegianceOf(town, siege, allied) : null
  const side = allegiance?.side ?? null
  // Whose ally they are, when they fight on their side as one: the side's nation.
  const allyOf = allegiance?.ally && siege && side !== 'other' && side ? nationOfSide(siege, side) : null
  const place = player ? `${Math.round(player.x)} ${Math.round(player.y)} ${Math.round(player.z)}` : null
  const distance = player && siege ? Math.round(Math.hypot(player.x - siege.at[0], player.z - siege.at[1])) : null
  const backWay = player && siege ? returnFor(motion, name, [player.x, player.z], siege.at, town?.home ?? null, now || motion.at, lockSeconds) : null
  return (
    <>
      <div className="flex items-start gap-2 px-4 pt-3">
        <span className="mt-1.5">{back}</span>
        <span className={cn('az-war-head mt-0.5 shrink-0', side ? `az-war-head-${side}` : null, allyOf ? 'az-war-head-ally' : null)}>
          <Head name={name} px={44} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-mono text-[20px] font-semibold leading-tight tracking-[0.02em] text-sand-50">{name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] text-sand-200/85">
            <span className={cn('font-semibold', sideColour(side))}>
              {side ? sideWord(side) : 'Player'}
              {allyOf ? ` · ally of ${spoken(allyOf)}` : ''}
            </span>
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
            {siege && distance !== null && backWay ? (
              <div className="text-[16px] leading-snug text-sand-50">
                {/* The track to the banner at the panel size, the one figure large after it; the way back in a line beneath. */}
                <TrackToBanner
                  back={distance > RULES.siegeZoneRadius ? wayBackWords(backWay) : backWay.locked ? wayBackWords(backWay) : null}
                  distance={distance}
                  figure={
                    <span className={cn('text-[20px]', distance <= RULES.bannerRadius ? 'text-coral-300' : null)}>
                      {distance <= RULES.bannerRadius ? 'At the banner' : distance <= RULES.siegeZoneRadius ? `${n(distance)} blocks` : clockOf(backWay.expected ?? backWay.pessimistic)}
                    </span>
                  }
                  side={side === 'other' || !side ? undefined : side}
                  size="panel"
                />
                {distance > RULES.bannerRadius ? (
                  <p className="mt-1 text-[14px] text-sand-200/85">
                    {distance <= RULES.siegeZoneRadius ? (
                      'In the siege zone.'
                    ) : backWay.expected !== null ? (
                      <>
                        Back at their pace, <span className={FIGURE}>{backWay.pace}</span> blocks a second; <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{clockOf(backWay.pessimistic)}</span> at a sprint
                        {backWay.via === 'spawn' ? `; by /t spawn and ${n(backWay.blocks)} blocks.` : '.'}
                      </>
                    ) : (
                      <>Back at a sprint, no pace of their own seen yet{backWay.via === 'spawn' ? `; by /t spawn and ${n(backWay.blocks)} blocks.` : '.'}</>
                    )}
                  </p>
                ) : null}
                {backWay.locked ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-saffron-300">
                    <Icon className="h-4 w-4" name="lock" />
                    Dead in the battle: can’t teleport for <span className={cn(FIGURE, 'font-semibold')}>{clockOf(backWay.locked)}</span>
                  </p>
                ) : null}
              </div>
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
            <Hint text={follow ? 'The map moves with each reading; a drag of the map lets go.' : 'Keeps them in the middle of the map as they move.'}>
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
            </Hint>
          </div>
        </>
      ) : (
        <p className="mt-3 px-4 text-[15px] leading-snug text-sand-200/85">
          {live.status === 'live' ? 'Not on the server just now, or hidden from its map.' : live.status === 'down' ? 'The map isn’t answering, so where they are isn’t known.' : 'Asking the map…'}
        </p>
      )}
      <PlayerRecord name={name} />
    </>
  )
}

/** The player's record in the battles (ui/Fighter.tsx), asked for as the view opens. */
function PlayerRecord({ name }: { name: string }) {
  const fighters = useFighters(true)
  // The clock is 0 only on the server, which never renders the war view.
  const now = useSecond()
  if (!now) return null
  return <FighterCard className="mx-4 mt-4 border-t border-sand-50/10 pt-3" now={now} record={recordOf(fighters, name)} state={fighters} tone="war" />
}

/**
 * Who to expect at the siege the view is on: each side's residents, those
 * on now first (the live feed), then by how likely they are to be fighting
 * at the session's time (their usual hours times their turnout), each
 * with their record as marks and their score; and under them the residents
 * of each of the side's known allies, as likely as their usual hours and
 * turnout say, scaled by the share of their fighting they've done for
 * allies (an alliance alone brings nobody). A read of the danger on the
 * enemy's side and of the turnout on one's own. Those already at the siege
 * are the Fighters roster above, so a group counts them and lists them
 * only when opened out.
 */
function ExpectedFighters({ siege, towns, atSiege, onFocus }: { siege: Siege; towns: SideTown[]; atSiege: string[]; onFocus: (focus: WarFocus) => void }) {
  const { liveStore } = useMaps()
  const live = useStore(liveStore)
  const now = useSecond()
  const fighters = useFighters(true)
  const { alliances } = useAlliances(false)
  const [opened, setOpened] = useState<string | null>(null)
  const online = useMemo(() => new Set(live.players.map((player) => player.name.toLowerCase())), [live.players])
  const here = useMemo(() => new Set(atSiege.map((name) => name.toLowerCase())), [atSiege])
  if (!now) return null
  // At the session on now, or the next; the clock is 0 only on the server, which never renders the war view.
  const clock = sessionClock(now)
  const at = siege.battle || clock.on ? now : clock.start
  const when = siege.battle || clock.on ? 'this session' : `the next session, ${timeOf(clock.start)}`
  const peopleOf = (nation: string | null) => (nation ? towns.filter((town) => sameNation(town.nation, nation)).flatMap((town) => town.people) : [])
  // Each side's residents, then each of its allies' (a town of no nation has no allies: alliances.ts → defendingNation).
  const groups = (['attackers', 'defenders'] as const).flatMap((side) => {
    const nation = side === 'attackers' ? siege.attacker : siege.defender
    const own = { key: side, side, nation, allyOf: null, ranked: rankExpected(peopleOf(nation), fighters, online, at) }
    const allies = alliesOf(nationOfSide(siege, side), alliances).map((ally) => ({
      key: `${side}:${ally}`,
      allyOf: nationOfSide(siege, side),
      side,
      nation: ally,
      ranked: rankExpected(peopleOf(ally), fighters, online, at, allyShare),
    }))
    return [own, ...allies]
  })
  return (
    <section className="mt-4 px-4">
      <p className={EYEBROW}>
        Who to expect · {when}
        <HintMark
          label="About who to expect"
          text={`Each side’s residents and known allies: on now first (the dot), then the likeliest at this hour. Beside each, the sessions fought of those they could. ${SCORE_WORDS}`}
        />
      </p>
      {groups.map((group) => (
        <ExpectedGroup fighters={fighters} group={group} here={here} key={group.key} onFocus={onFocus} onOpen={(open) => setOpened(open ? group.key : null)} open={opened === group.key} towns={towns} />
      ))}
      {fighters.status === 'ready' && fighters.battles === 0 ? (
        <p className="mt-1.5 text-[13px] leading-snug text-sand-200/75">No battles recorded yet: the tracker reads every battle from 1 November, and the likelihoods come with them.</p>
      ) : fighters.status === 'down' ? (
        <p className="mt-1.5 text-[13px] leading-snug text-sand-200/75">The records couldn’t be read just now.</p>
      ) : null}
    </section>
  )
}

/**
 * One side's residents, or one of its allies', ranked: how many are on
 * now of all of them as a meter, then a row each, those at the siege left
 * to the roster above until the group is opened out: the dot for on now
 * or how likely they are, their sessions as pips, their score.
 */
function ExpectedGroup({
  group,
  fighters,
  here,
  open,
  onOpen,
  towns,
  onFocus,
}: {
  /** A side's own residents (`allyOf` null), or an ally's, with the side's nation, whose allies they are. */
  group: { side: BattleSide; nation: string; allyOf: string | null; ranked: Expected[] }
  fighters: FightersState
  /** Who stands at the siege already (lower-cased), listed in the Fighters roster above. */
  here: Set<string>
  open: boolean
  onOpen: (open: boolean) => void
  towns: SideTown[]
  onFocus: (focus: WarFocus) => void
}) {
  const SHOWN = 5
  const { side, nation, allyOf, ranked } = group
  const ally = allyOf !== null
  const onNow = ranked.filter((entry) => entry.online).length
  const atSiege = ranked.filter((entry) => here.has(entry.name.toLowerCase())).length
  // Listed: those on now or with a record, not at the siege already; the rest, with no record yet, are a count until opened out.
  const listed = ranked.filter((entry) => !here.has(entry.name.toLowerCase()) && (entry.online || entry.record))
  const unrecorded = ranked.filter((entry) => !here.has(entry.name.toLowerCase()) && !entry.online && !entry.record).length
  const rest = open ? ranked : listed.slice(0, SHOWN)
  const label = allyOf ? `Allies of ${spoken(allyOf)} · ${spoken(nation)}` : `${sideWord(side)}s · ${spoken(nation)}`
  return (
    <div className="mt-2">
      <p className={cn(EYEBROW, 'flex flex-wrap items-center gap-x-2.5 gap-y-0.5', sideColour(side))}>
        <span className="min-w-0 truncate">{label}</span>
        {ranked.length ? <Meter className="w-28 shrink-0" noun="on now" of={ranked.length} side={side} value={onNow} words={`${onNow} of ${ranked.length} on now${atSiege ? `, ${atSiege} at the siege` : ''}`} /> : null}
        {atSiege && !open ? <span className="normal-case tracking-normal text-sand-200/70">{atSiege} at the siege, above</span> : null}
      </p>
      {ranked.length ? (
        rest.length ? (
          <ul className="mt-0.5 divide-y divide-sand-50/10 border-y border-sand-50/10">
            {rest.map((entry) => (
              <li key={entry.name}>
                <button
                  className="flex w-full items-center gap-2.5 py-1 pr-1 text-left hover:bg-sand-50/5 focus-visible:outline-saffron-400"
                  onClick={() => onFocus({ kind: 'player', name: entry.name })}
                  type="button"
                >
                  <span className={cn('az-war-head shrink-0', `az-war-head-${side}`, ally ? 'az-war-head-ally' : null)}>
                    <Head name={entry.name} px={22} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    <span className={cn('min-w-[7rem] max-w-full truncate font-mono text-[14px] font-semibold tracking-[0.02em]', entry.online ? 'text-sand-50' : 'text-sand-200/80')}>{entry.name}</span>
                    <span className="inline-flex items-center gap-x-2 text-[12px] text-sand-200/70">
                      {entry.online ? (
                        <OnlineDot />
                      ) : entry.expected !== null ? (
                        <span>
                          <span className={cn(FIGURE, 'text-sand-200/85')}>{Math.round(entry.expected * 100)}%</span> likely
                        </span>
                      ) : fighters.status === 'ready' ? (
                        <span className="text-sand-300/60">no record</span>
                      ) : (
                        '…'
                      )}
                      {entry.record?.fought ? <RecordMarks held={false} record={entry.record} tone="war" /> : null}
                    </span>
                  </span>
                  {entry.record ? <ScoreBadge hint={false} record={entry.record} tone="war" /> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null
      ) : (
        <p className="mt-0.5 text-[14px] text-sand-200/80">{towns.length ? 'No residents the map knows.' : 'The world is still on its way.'}</p>
      )}
      {ranked.length > rest.length || open ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[13px] text-sand-200/70">
          <button className="text-sand-200/80 underline decoration-dotted underline-offset-2 hover:text-sand-50 focus-visible:outline-saffron-400" onClick={() => onOpen(!open)} type="button">
            {open ? 'Fewer' : `All ${ranked.length}`}
          </button>
          {!open && unrecorded && fighters.status === 'ready' ? <span>{unrecorded === ranked.length ? 'none with a record yet' : `${unrecorded} with no record yet`}</span> : null}
        </p>
      ) : null}
    </div>
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

/** Where a player stands, for the map to fly to. */
export const playerPoint = (player: LivePlayer): Point => [player.x, player.z]
