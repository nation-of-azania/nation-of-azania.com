'use client'

import { useMemo } from 'react'

import { cn } from '@/blocks/components/shared'
import { sameNation } from '@/maps/abroad'
import { alliesOf, defendingNation } from '@/maps/alliances'
import { assessBattle, RULES, sessionClock, type BattleReading, type BattleSide } from '@/maps/battle'
import { clusterKills, killsAlong, type CoursePoint } from '@/maps/course'
import { spoken } from '@/maps/data'
import { allyShare } from '@/maps/fighters'
import { headSlotsWords, n, signed } from '@/maps/marks'
import { forecastSiege, outlookOf, POINTS_PER_EXTRA_FIGHTER, sessionsAfter, type BattleOutlook, type Need, type SessionForecast, type SiegeForecast, type Target } from '@/maps/outlook'
import type { Siege, WorldTown } from '@/maps/world'

import { useAlliances } from '../alliances'
import { resultOf, sessionsOf, splitSessions, useBattles, type TrackedBattle } from '../battles'
import { useFighters } from '../fighters'
import { Hint, HintMark } from '../ui/Hint'
import { Icon } from '../ui/icons'
import { HeadSlots } from '../ui/Marks'
import { timeOf } from '../warView'

/**
 * The outlook on a battle and its siege, in the war view's siege
 * (src/maps/outlook.ts, pure; this draws it): the one line that says
 * whether to stay or go, and under it, on demand, what each side needs
 * from now, whether the leader can leave the banner, the cap's dead
 * points, the session's points as they went and will go (a chart), the
 * siege's story across its sessions (/maps/battles), and the sessions
 * still to come, forecast by who usually turns up at their hours. The
 * score, the banner, the captures and the vitals keep the room; this is
 * a glance and a fold. A side's allies count in all of it, as SiegeWar
 * counts them (src/maps/alliances.ts), and are said apart wherever a side
 * is counted: "3 online + 2 allies".
 */

const EYEBROW = 'font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-sand-200/75'
const FIGURE = 'font-mono tabular-nums'
const other = (side: BattleSide): BattleSide => (side === 'attackers' ? 'defenders' : 'attackers')
const colour = (side: BattleSide | null) => (side === 'attackers' ? 'text-(--az-atk)' : side === 'defenders' ? 'text-(--az-def)' : 'text-sand-50')

type SideTown = Pick<WorldTown, 'name' | 'nation' | 'people' | 'home'>

/** What a side is called: Azania when it's ours, else the nation. */
const namer = (siege: Siege, ours: BattleSide | null) => (side: BattleSide) =>
  ours === side ? 'Azania' : spoken(side === 'attackers' ? siege.attacker : siege.defender)

const dayOf = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short' })

/** How many of a side are online: its residents, and its allies (whom SiegeWar counts for it too). */
export type OnlineCount = Record<BattleSide, { residents: number; allies: number }>

/** The counts as the outlook reckons with them: residents and allies together. */
export const totalOnline = (online: OnlineCount): Record<BattleSide, number> => ({
  attackers: online.attackers.residents + online.attackers.allies,
  defenders: online.defenders.residents + online.defenders.allies,
})

export type OutlookProps = {
  siege: Siege
  /** The battle assessed (battle.ts), while one is on. */
  assessed: NonNullable<ReturnType<typeof assessBattle>> | null
  readings: BattleReading[]
  now: number
  phase: number | null
  /** Which side is Azania's, for the words. */
  ours: BattleSide | null
  /** How many of each side are online, from the live feed, residents and allies apart. */
  online: OnlineCount | null
  towns: SideTown[]
}

/** The outlook itself, worked out once per tick. */
function useOutlook({ siege, assessed, now, phase, online }: OutlookProps): BattleOutlook | null {
  return useMemo(() => (assessed ? outlookOf(siege, assessed.reading, now, phase, online ? totalOnline(online) : null) : null), [siege, assessed, now, phase, online])
}

/**
 * The glance, read mid-battle: one headline saying who has it as it
 * stands; for the side behind, the holders it would take from now set
 * against those it has online (ui/Marks.tsx → HeadSlots); a padlock, shut
 * or open, for whether the leader can leave the banner; and the cap when
 * it's reached. The balance itself is the bar above (the Scoreboard's
 * CapBalance), said once. One rule of colour, as the verdict had: lagoon
 * when Azania holds, coral when it must act. The whys are in the hints and
 * the fold beneath.
 */
export function OutlookSummary(props: OutlookProps) {
  const { siege, assessed, ours, online } = props
  const outlook = useOutlook(props)
  if (!outlook || !assessed?.projected) return null
  const who = namer(siege, ours)
  const target: Target = outlook.final ? 'siege' : 'session'
  const ahead = (['attackers', 'defenders'] as const).find((side) => outlook.needs[target][side].already) ?? null
  const behind = ahead ? other(ahead) : null
  const need = behind ? outlook.needs[target][behind] : null
  const good = ours !== null && ours === ahead
  const bad = ours !== null && ours === behind
  const what = outlook.final ? 'the siege' : 'the session'
  // "the 5 Azanians online", or, with allies among them, "the 5 on Azania's side online (3 + 2 allies)".
  const everyone = (side: BattleSide) => {
    const count = online![side]
    const total = count.residents + count.allies
    if (!count.allies) return `the ${n(total)} ${who(side) === 'Azania' ? 'Azanians' : who(side)} online`
    return `the ${n(total)} on ${who(side)}’s side online (${n(count.residents)} + ${n(count.allies)} ${count.allies === 1 ? 'ally' : 'allies'})`
  }
  const kills = need ? `${n(need.kills)} kill${need.kills === 1 ? '' : 's'}` : ''
  return (
    <div className={cn('mt-2.5 border-l-4 py-0.5 pl-3', good ? 'border-lagoon-400' : bad ? 'border-coral-500' : 'border-sand-300/40')}>
      <p className={cn('text-[16px] font-semibold leading-snug', good ? 'text-lagoon-300' : bad ? 'text-coral-300' : 'text-sand-50')}>
        {ahead ? `${who(ahead)} ${outlook.final ? 'wins the siege' : 'takes this session'} as it stands${good ? ': hold on.' : '.'}` : 'Level: whoever holds the banner from here takes it.'}
      </p>
      {behind && need ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-snug text-sand-100">
          <span className={cn('font-semibold', colour(behind))}>{who(behind)}</span>
          {need.holders === null ? (
            <span>
              can’t take it in the time left: <span className={cn(FIGURE, 'font-semibold')}>{kills}</span> short.
            </span>
          ) : online ? (
            <>
              {/* The holders it would take, each a slot, filled by those it has online: an empty slot is a need unmet. */}
              <HeadSlots
                allies={online[behind].allies}
                needed={need.holders}
                online={online[behind].residents}
                words={`${who(behind)}: ${headSlotsWords(need.holders, online[behind].residents, online[behind].allies)} to turn ${what}; or ${kills}`}
              />
              {need.enough ? null : (
                <span aria-hidden="true" className="text-[13px] text-coral-300">
                  out of reach · or <span className={cn(FIGURE, 'font-semibold')}>{kills}</span>
                </span>
              )}
            </>
          ) : (
            <span>
              <span className={cn(FIGURE, 'font-semibold')}>{n(need.holders)}</span> holder{need.holders === 1 ? '' : 's'} from now would turn {what}.
            </span>
          )}
        </p>
      ) : null}
      {outlook.safeToLeave && online ? (
        <p className="mt-1 text-[14px] leading-snug text-sand-200/85">
          {/* The padlock: shut, the leader must stay at the banner; open, it could go. The hint says against whom. */}
          <Hint
            text={
              outlook.safeToLeave.safe
                ? `Even if every one of ${everyone(other(outlook.safeToLeave.side))} took it now, ${who(outlook.safeToLeave.side)} would end ${what} ${n(outlook.safeToLeave.margin)} ahead.`
                : `${everyone(other(outlook.safeToLeave.side))[0].toUpperCase()}${everyone(other(outlook.safeToLeave.side)).slice(1)} taking it would overturn ${what}.`
            }
          >
            <span className="inline-flex items-center gap-1.5" tabIndex={0}>
              <Icon className={cn('h-4 w-4 shrink-0', outlook.safeToLeave.safe ? 'text-lagoon-300' : 'text-sand-50')} name={outlook.safeToLeave.safe ? 'unlock' : 'lock'} />
              <span>
                {who(outlook.safeToLeave.side)} {outlook.safeToLeave.safe ? 'could leave the banner' : 'can’t leave the banner'}
                {outlook.safeToLeave.safe ? (
                  <>
                    {' '}
                    · <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{n(outlook.safeToLeave.margin)}</span> to spare
                  </>
                ) : null}
              </span>
            </span>
          </Hint>
        </p>
      ) : null}
      {outlook.overCap ? (
        <p className="mt-1 text-[14px] leading-snug text-sand-200/85">
          Past the cap by <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{n(outlook.overCap.points)}</span>: {who(outlook.overCap.side)}’s further points count
          for nothing, and so do {who(other(outlook.overCap.side))}’s first {n(outlook.overCap.points)}.
        </p>
      ) : null}
    </div>
  )
}

/**
 * The fold: the session's course as a chart, what each side needs for the
 * session and for the siege, the siege's story across its sessions, and
 * the sessions ahead. Open by itself between sessions, when there's no
 * score to watch; folded during a battle, its line saying the shape.
 */
export function OutlookDetails(props: OutlookProps) {
  const { siege, assessed, readings, now, ours, towns } = props
  const outlook = useOutlook(props)
  const battles = useBattles(true)
  const fighters = useFighters(true)
  const { alliances } = useAlliances(true)
  const who = namer(siege, ours)
  // The sessions the tracker saved: those fought before this one (the siege's story), and this one so far, which starts the
  // session's chart off from its first minute rather than from when the view was opened.
  const clock = sessionClock(now)
  const sessionStart = siege.battle && clock.on ? clock.start : null
  // Asked again each minute: which sessions are this siege's changes only as sessions start.
  const minute = Math.floor(now / 60_000) * 60_000
  const { finished: past, current } = useMemo(() => splitSessions(sessionsOf(battles, siege, minute), sessionStart), [battles, siege, minute, sessionStart])
  // The sessions still to come, after the one on now: their starts, and who of each side usually turns up at them.
  // A session on now counts for the siege whether or not anyone fights it (seen: South_America_Quarry's went from 1/3 to
  // 2/3 with nobody there and no battle on its marker), so it isn't one still to come.
  const left = siege.progress ? Math.max(0, siege.progress.of - siege.progress.done - (siege.battle || clock.on ? 1 : 0)) : 0
  // Who may fight for each side: its residents, and the residents of its known allies, each ally counted for the share of
  // their fighting they've done for allies (a town of no nation has no allies: alliances.ts → defendingNation).
  const sides = useMemo(() => {
    const residents = (nation: string | null) =>
      nation
        ? towns
            .filter((town) => sameNation(town.nation, nation))
            .flatMap((town) => town.people)
            .map((name) => fighters.byName.get(name.toLowerCase()))
            .filter((record): record is NonNullable<typeof record> => Boolean(record))
        : []
    const of = (nation: string | null, allied: string | null) => {
      const own = residents(nation)
      const allyNations = alliesOf(allied, alliances)
      const allies = allyNations.flatMap((ally) => residents(ally).map((record) => ({ ...record, share: allyShare(record) })))
      return {
        people: [...own, ...allies],
        rests: { residents: own.filter((one) => one.hours).length, allies: allies.filter((one) => one.hours && one.share > 0).length, allyNations },
      }
    }
    return { attackers: of(siege.attacker, siege.attacker), defenders: of(siege.defender, defendingNation(siege)) }
  }, [siege, towns, fighters.byName, alliances])
  const forecast = useMemo<SiegeForecast | null>(() => {
    if (!left || !now) return null
    const from = siege.battle ? (assessed?.projected?.balance ?? siege.balance ?? 0) : (siege.balance ?? 0)
    return forecastSiege(from, sessionsAfter(now, left), { attackers: sides.attackers.people, defenders: sides.defenders.people })
  }, [left, now, siege, assessed, sides])
  const open = !siege.battle
  return (
    <details className="az-outlook mt-2.5 border-t border-sand-50/10 pt-1.5" open={open}>
      <summary className="flex cursor-pointer select-none items-center gap-2.5 py-1 focus-visible:outline-saffron-400 [&::-webkit-details-marker]:hidden">
        <span className={cn(EYEBROW, 'shrink-0')}>Outlook</span>
        {assessed && (readings.length > 1 || current) ? <Sparkline assessed={assessed} readings={readings} tracked={current} /> : null}
        {/* The session's number is the header's pips; here, the forecast's winner alone, or nothing. */}
        <span className="min-w-0 flex-1 truncate text-[13px] text-sand-200/80">{forecast?.winner ? `forecast ${who(forecast.winner)}` : ''}</span>
        <span aria-hidden="true" className="az-outlook-chevron shrink-0 text-sand-200/70">
          ▾
        </span>
      </summary>
      <div className="space-y-3 pb-1 pt-1">
        {assessed && outlook ? <SessionChart assessed={assessed} readings={readings} tracked={current} /> : null}
        {assessed && outlook ? <WhatItTakes outlook={outlook} who={who} online={props.online} /> : null}
        <SiegeStory
          assessed={assessed}
          battlesStatus={battles.status}
          forecast={forecast}
          known={fighters.status}
          past={past}
          rests={{ attackers: sides.attackers.rests, defenders: sides.defenders.rests }}
          siege={siege}
          who={who}
        />
        {!forecast && siege.progress && left === 0 ? (
          <p className="text-[14px] leading-snug text-sand-200/80">
            {siege.battle ? 'The last session: the siege is decided at its end.' : 'Every session fought: the siege is decided.'}
          </p>
        ) : null}
        {battles.demo || fighters.demo ? <p className="text-[12px] italic text-sand-300/70">Made up: the war demo’s battles and records.</p> : null}
      </div>
    </details>
  )
}

/**
 * A session's points: as the battle tracker saved them, a point a minute,
 * up to the first the view read itself (`tracked`, the session so far as
 * /maps/battles has it), then as the view read them; the end projected.
 * `since` is the minute the view's own readings begin, when the tracker's
 * came before them. The view's readings carry the banner's holders, the
 * tracker's minutes don't (null), which is what tells a kill's step from
 * the banner's climb (src/maps/course.ts).
 */
function courseOf(assessed: NonNullable<ReturnType<typeof assessBattle>>, readings: BattleReading[], tracked: TrackedBattle | null = null) {
  const total = RULES.sessionMinutes * 60
  const live: CoursePoint[] = readings
    .filter((reading) => reading.points && reading.secondsLeft !== null)
    .map((reading) => ({
      minute: (total - reading.secondsLeft!) / 60,
      attacker: reading.points!.attacker,
      defender: reading.points!.defender,
      banner: reading.banner.side,
      holders: reading.banner.holders,
    }))
  const firstLive = live.length ? live[0].minute : Infinity
  const before: CoursePoint[] = (tracked?.points ?? [])
    .filter(([minute]) => minute < firstLive - 0.5)
    .map(([minute, attacker, defender, banner]) => ({ minute, attacker, defender, banner: banner === 'a' ? 'attackers' : banner === 'd' ? 'defenders' : null, holders: null }))
  const points = [...before, ...live]
  const since = before.length && live.length ? firstLive : null
  const end = assessed.projected ? { minute: RULES.sessionMinutes, ...assessed.projected.points } : null
  const top = Math.max(100, ...points.map((p) => Math.max(p.attacker, p.defender)), end ? Math.max(end.attacker, end.defender) : 0)
  return { points, end, top, since }
}

/**
 * How many kills each side has scored this session, told from the points'
 * steps (course.ts → killsAlong) along the tracker's minutes and the
 * view's readings: for the scoreboard's split of banner points and kill
 * points. Nothing until the battles are read; it asks for them, as the
 * fold does.
 */
export function useSessionKills(siege: Siege, assessed: NonNullable<ReturnType<typeof assessBattle>>, readings: BattleReading[]): Record<BattleSide, number> {
  const battles = useBattles(true)
  const start = sessionClock(assessed.reading.at).start
  return useMemo(() => {
    const { current } = splitSessions(sessionsOf(battles, siege, assessed.reading.at), start)
    const { points } = courseOf(assessed, readings, current)
    const count = { attackers: 0, defenders: 0 }
    for (const step of killsAlong(points)) count[step.side] += step.kills
    return count
  }, [battles, siege, assessed, readings, start])
}

/** The shape of the session in a few pixels, for the fold's line: the two lines alone, no room for the kills' marks. */
function Sparkline({ assessed, readings, tracked }: { assessed: NonNullable<ReturnType<typeof assessBattle>>; readings: BattleReading[]; tracked: TrackedBattle | null }) {
  const { points, end, top } = courseOf(assessed, readings, tracked)
  const w = 64
  const h = 16
  const x = (minute: number) => (minute / RULES.sessionMinutes) * w
  const y = (value: number) => h - (value / top) * (h - 2) - 1
  const line = (key: 'attacker' | 'defender') =>
    [...points, ...(end ? [end] : [])].map((p, i) => `${i ? 'L' : 'M'}${x(p.minute).toFixed(1)} ${y(p[key]).toFixed(1)}`).join('')
  return (
    <svg aria-hidden="true" className="h-4 w-16 shrink-0" viewBox={`0 0 ${w} ${h}`}>
      <path d={line('defender')} fill="none" style={{ stroke: 'var(--az-def)' }} strokeWidth={1.5} />
      <path d={line('attacker')} fill="none" style={{ stroke: 'var(--az-atk)' }} strokeWidth={1.5} />
    </svg>
  )
}

/**
 * The session's points as they went, both sides, with who held the banner
 * along the foot, running on dashed to the end the banner as it is would
 * make (the projection). Where a side's line stepped up by a kill rather
 * than climbed by the banner, a ring on the line in the side's colour,
 * and kills within a few minutes of each other one ring with their number
 * (course.ts → clusterKills), so a hard first few minutes isn't a row of
 * them. The side's own colour, since the points are theirs: a defender's
 * death is a ring on the attackers' line.
 */
function SessionChart({ assessed, readings, tracked }: { assessed: NonNullable<ReturnType<typeof assessBattle>>; readings: BattleReading[]; tracked: TrackedBattle | null }) {
  const { points, end, top, since } = courseOf(assessed, readings, tracked)
  const kills = clusterKills(killsAlong(points))
  if (!points.length) return <p className="text-[13px] text-sand-200/75">The session’s course comes with the readings.</p>
  const w = 320
  const h = 96
  const pad = { l: 34, r: 8, t: 8, b: 16 }
  const x = (minute: number) => pad.l + (minute / RULES.sessionMinutes) * (w - pad.l - pad.r)
  const y = (value: number) => pad.t + (1 - value / top) * (h - pad.t - pad.b)
  const path = (key: 'attacker' | 'defender', list: { minute: number; attacker: number; defender: number }[]) =>
    list.map((p, i) => `${i ? 'L' : 'M'}${x(p.minute).toFixed(1)} ${y(p[key]).toFixed(1)}`).join('')
  const last = points[points.length - 1]
  const ticks = [0, 20, 40, 60]
  const scale = top >= 2000 ? [0, Math.round(top / 2 / 100) * 100, Math.round(top / 100) * 100] : [0, Math.round(top / 2 / 10) * 10, top]
  // Who held the banner, as runs along the foot.
  const runs: { from: number; to: number; side: BattleSide | null }[] = []
  for (const p of points) {
    const run = runs[runs.length - 1]
    if (run && run.side === p.banner) run.to = p.minute
    else runs.push({ from: p.minute, to: p.minute, side: p.banner })
  }
  return (
    <figure>
      <svg aria-label="The session's points as they went" className="az-chart h-24 w-full" preserveAspectRatio="none" viewBox={`0 0 ${w} ${h}`}>
        {scale.map((value) => (
          <g key={value}>
            <line className="az-chart-grid" x1={pad.l} x2={w - pad.r} y1={y(value)} y2={y(value)} />
            <text className="az-chart-label" textAnchor="end" x={pad.l - 4} y={y(value) + 3}>
              {value >= 1000 ? `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : value}
            </text>
          </g>
        ))}
        {ticks.map((minute) => (
          <text className="az-chart-label" key={minute} textAnchor="middle" x={x(minute)} y={h - 4}>
            {minute}
          </text>
        ))}
        {/* Where the view's own readings take over from the tracker's, a point a minute before it. */}
        {since !== null ? <line className="az-chart-grid" strokeDasharray="2 3" x1={x(since)} x2={x(since)} y1={pad.t} y2={h - pad.b} /> : null}
        {/* The banner's holders along the foot. */}
        {runs.map((run, i) => (
          <rect
            className="az-chart-banner"
            data-side={run.side ?? 'none'}
            height={3}
            key={i}
            width={Math.max(1, x(run.to) - x(run.from))}
            x={x(run.from)}
            y={h - pad.b + 2}
          />
        ))}
        <path d={path('defender', points)} fill="none" style={{ stroke: 'var(--az-def)' }} strokeLinejoin="round" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <path d={path('attacker', points)} fill="none" style={{ stroke: 'var(--az-atk)' }} strokeLinejoin="round" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {/* The kills: a ring on the line where it stepped, with the number when there was more than one. */}
        {kills.map((kill) => {
          const p = points[kill.at]
          const cx = x(kill.minute)
          const cy = y(kill.side === 'attackers' ? p.attacker : p.defender)
          return (
            <g className="az-chart-kill" data-side={kill.side} key={`${kill.side}-${kill.at}`}>
              <circle cx={cx} cy={cy} r={3.5} vectorEffect="non-scaling-stroke" />
              {kill.kills > 1 ? (
                <text textAnchor="middle" x={cx} y={cy - 6}>
                  ×{kill.kills}
                </text>
              ) : null}
            </g>
          )
        })}
        {end ? (
          <>
            <path d={path('defender', [last, end])} fill="none" strokeDasharray="3 3" style={{ stroke: 'var(--az-def)' }} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <path d={path('attacker', [last, end])} fill="none" strokeDasharray="3 3" style={{ stroke: 'var(--az-atk)' }} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
        <circle cx={x(last.minute)} cy={y(last.attacker)} r={2.5} style={{ fill: 'var(--az-atk)' }} />
        <circle cx={x(last.minute)} cy={y(last.defender)} r={2.5} style={{ fill: 'var(--az-def)' }} />
      </svg>
      <figcaption className="mt-0.5 text-[12px] text-sand-200/70">
        The session’s points, minute by minute
        <HintMark
          label="About the chart"
          text={`Coral attackers, sea defenders. A ring is a kill (×n: so many close together); the rest is the banner’s. Dashed: to the end, as the banner stands. Foot: who held it.${
            since !== null ? ` To minute ${Math.round(since)}, the tracker’s points, a minute apart.` : ''
          }`}
        />
      </figcaption>
    </figure>
  )
}

/**
 * What each side needs from now, for the session and, when it's another,
 * for the siege: the holders as slots against those online (HeadSlots),
 * the points and the kills small beside them.
 */
function WhatItTakes({ outlook, who, online }: { outlook: BattleOutlook; who: (side: BattleSide) => string; online: OnlineCount | null }) {
  const targets: Target[] = outlook.final ? ['siege'] : ['session', 'siege']
  const words = (target: Target) => (target === 'session' ? 'This session' : outlook.final ? 'The siege' : 'The siege, after all sessions')
  const kills = (need: Need) => `${n(need.kills)} kill${need.kills === 1 ? '' : 's'}`
  return (
    <div>
      <p className={EYEBROW}>
        What it takes, from now
        <HintMark
          label="About what it takes"
          text="For each side: the fewest holders for the rest of the session that would turn it (five minutes to take it or to join), against those online; or the kills instead."
        />
      </p>
      <dl className="mt-1 space-y-1.5">
        {targets.map((target) => (
          <div key={target}>
            <dt className="text-[13px] text-sand-200/75">{words(target)}</dt>
            {(['attackers', 'defenders'] as const).map((side) => {
              const need = outlook.needs[target][side]
              return (
                <dd className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-snug text-sand-100" key={side}>
                  <span className={cn('w-20 shrink-0 truncate font-semibold', colour(side))}>{who(side)}</span>
                  {need.already ? (
                    <span className="text-sand-200/80">theirs as the banner stands</span>
                  ) : need.holders === null ? (
                    <span>
                      too late to take it · <span className={cn(FIGURE, 'font-semibold')}>{n(need.short)}</span> short · <span className={cn(FIGURE, 'font-semibold')}>{kills(need)}</span>
                    </span>
                  ) : (
                    <>
                      {online ? (
                        <HeadSlots
                          allies={online[side].allies}
                          needed={need.holders}
                          online={online[side].residents}
                          words={`${who(side)}: ${headSlotsWords(need.holders, online[side].residents, online[side].allies)}; ${n(need.short)} points short, or ${kills(need)}`}
                        />
                      ) : (
                        <span>
                          <span className={cn(FIGURE, 'font-semibold')}>{n(need.holders)}</span> holder{need.holders === 1 ? '' : 's'} from now
                        </span>
                      )}
                      <span className="text-[12px] text-sand-200/75">
                        · <span className={FIGURE}>{n(need.short)}</span> short · or <span className={FIGURE}>{kills(need)}</span>
                      </span>
                    </>
                  )}
                </dd>
              )
            })}
          </div>
        ))}
      </dl>
    </div>
  )
}

/** What a side's forecast rests on: its residents with usual hours known, and its allies' (those who've fought for allies), by nation. */
type Rests = { residents: number; allies: number; allyNations: string[] }

/** "4 of Sul America's residents and 2 of its allies' (Imperial Avalonia)". */
function restsWords(name: string, rests: Rests): string {
  const own = `${n(rests.residents)} of ${name}’s residents`
  if (!rests.allyNations.length) return own
  const allies = rests.allyNations.map(spoken).join(', ')
  return rests.allies ? `${own} and ${n(rests.allies)} of its allies’ (${allies})` : `${own}, none of its allies’ (${allies}) having fought for an ally yet`
}

/**
 * The forecast in one line: who is likely to bring more at the sessions
 * left, and the lead the side it leaves losing would need going into the
 * other's sessions, when the cap even allows one. The turnout at each
 * session is on its row.
 */
function forecastLine(forecast: SiegeForecast, who: (side: BattleSide) => string): string | null {
  const parts: string[] = []
  if (forecast.winner) {
    const flooded = forecast.sessions.filter((session) => session.favoured === forecast.winner)
    if (flooded.length)
      parts.push(`${who(forecast.winner)} likely to bring more at ${flooded.length === forecast.sessions.length ? 'every session left' : flooded.map((session) => timeOf(session.start)).join(' and ')}`)
  }
  const first = forecast.lead ? forecast.sessions.find((session) => session.favoured === forecast.winner) : null
  if (forecast.lead && first)
    parts.push(
      `${who(forecast.lead.side)} would need a ${n(forecast.lead.needs)} lead into ${timeOf(first.start)}${
        forecast.lead.possible ? ' (within the cap: winning the earlier sessions big enough would do)' : ', more than the cap allows: they must contest those sessions too'
      }`,
    )
  return parts.length ? `${parts.join('; ')}.` : null
}

/**
 * The siege across its sessions, and the sessions still to come: each
 * fought one's result and the balance after it, within the cap; the one
 * on now as projected; and each to come as forecast, by who usually
 * turns up at its hour. Each a row with a bar for the margin, the
 * attackers' to the left of the middle and the defenders' to the right,
 * its figure written at the bar's end, and the balance after it at the
 * right. A forecast row says the turnout it rests on ("2.9 v 2.1 likely")
 * and draws its bar faint; the forecast's one line stands under the rows.
 */
function SiegeStory({
  past,
  assessed,
  forecast,
  rests,
  known,
  siege,
  who,
  battlesStatus,
}: {
  past: TrackedBattle[]
  assessed: NonNullable<ReturnType<typeof assessBattle>> | null
  forecast: SiegeForecast | null
  rests: Record<BattleSide, Rests>
  /** The records' state: what the forecast's turnout rests on. */
  known: string
  siege: Siege
  who: (side: BattleSide) => string
  battlesStatus: string
}) {
  const capped = (value: number) => Math.max(-RULES.balanceCap, Math.min(RULES.balanceCap, value))
  type Row = { key: string; label: string; when: string; margin: number | null; balance: number | null; kind: 'past' | 'now' | 'next'; expected?: SessionForecast['expected'] }
  const rows: Row[] = []
  let balance = 0
  past.forEach((battle, index) => {
    const result = resultOf(battle)
    const margin = result ? result.attacker - result.defender : null
    if (margin !== null) balance = capped(balance + margin)
    const start = Date.parse(battle.startedAt)
    // Numbered by the marker's count where the tracker saved it: a session nobody came to is one, though nothing was tracked.
    rows.push({ key: battle.startedAt, label: `Session ${(battle.session ?? index) + 1}`, when: `${dayOf(start)} ${timeOf(start)}`, margin, balance: margin === null ? null : balance, kind: 'past' })
  })
  // The sessions fought so far, by the marker or the tracker, whichever saw more; the marker's balance is where the siege stands.
  const fought = Math.max(siege.progress?.done ?? 0, past.length)
  const disagree = past.length > 0 && siege.balance !== null && balance !== siege.balance
  if (assessed?.projected && siege.battle) {
    const margin = assessed.projected.points.attacker - assessed.projected.points.defender
    rows.push({ key: 'now', label: `Session ${fought + 1}`, when: 'now', margin, balance: assessed.projected.balance, kind: 'now' })
  }
  forecast?.sessions.forEach((session, index) => {
    rows.push({
      key: String(session.start),
      label: `Session ${fought + (siege.battle ? 1 : 0) + index + 1}`,
      when: `${dayOf(session.start)} ${timeOf(session.start)}`,
      margin: session.favoured ? session.swing : 0,
      balance: session.balance,
      kind: 'next',
      expected: session.expected,
    })
  })
  const most = Math.max(RULES.balanceCap, ...rows.map((row) => Math.abs(row.margin ?? 0)))
  // A bar this wide (of the whole track) carries its figure inside: outside, the figure would reach the next column.
  const INSIDE = 18
  // The words of a row's bar, for a screen reader: the margin and what kind of figure it is.
  const barWords = (row: Row) =>
    row.margin === null ? 'end not seen' : row.kind === 'next' ? `about ${signed(row.margin)}, as the usual hours say` : row.kind === 'now' ? `${signed(row.margin)} on points, if the banner stays as it is` : `${signed(row.margin)} on points`
  const counted = forecast ? forecast.known.attackers + forecast.known.defenders : 0
  const line = forecast && counted ? forecastLine(forecast, who) : null
  return (
    <div>
      <p className={EYEBROW}>
        The siege, session by session
        {forecast ? (
          <HintMark
            label="About the forecast"
            text={`Rough: who usually fights at each session’s hour, from their hours and turnout; each fighter more than the other side brings is worth about ${n(POINTS_PER_EXTRA_FIGHTER)} to the balance.`}
          />
        ) : null}
      </p>
      {rows.length === 0 ? (
        <p className="mt-1 text-[14px] leading-snug text-sand-200/80">
          {battlesStatus === 'asking' || battlesStatus === 'idle'
            ? 'Reading the battles…'
            : battlesStatus === 'down'
              ? 'The battles couldn’t be read just now.'
              : 'No session of this siege tracked yet: the tracker reads every battle from 1 November.'}
        </p>
      ) : (
        <ol className="mt-1 space-y-1">
          {rows.map((row) => {
            const width = row.margin ? (Math.abs(row.margin) / most) * 50 : 0
            return (
              <li className={cn('grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-[13px]', row.kind === 'next' ? 'text-sand-200/70' : 'text-sand-100')} key={row.key}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{row.label}</span>
                  <span className="block truncate text-[12px] text-sand-200/70">{row.when}</span>
                </span>
                <span className="min-w-0">
                  <span aria-label={barWords(row)} className="relative block h-2 bg-sand-50/10" role="img">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-sand-50/40" />
                    {row.margin ? (
                      <span
                        className={cn('absolute inset-y-0', row.kind === 'next' ? 'opacity-50' : null, row.margin > 0 ? 'bg-(--az-atk)' : 'bg-(--az-def)')}
                        // The attackers' margin runs left from the middle, the defenders' right, as every balance bar does (ui/Marks.tsx → CapBalance).
                        style={{ left: row.margin > 0 ? `${50 - width}%` : '50%', width: `${width}%` }}
                      />
                    ) : null}
                    {/* The figure at the bar's end, on the empty side of it, "≈" for a forecast; a long bar (past a third of its half) carries it inside, at its far end, so it never runs into the next column. */}
                    {row.margin !== null ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          FIGURE,
                          'absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] leading-none',
                          width >= INSIDE ? (row.kind === 'next' ? 'text-sand-100' : 'text-sea-950') : row.kind === 'next' ? 'text-sand-200/70' : 'text-sand-100',
                        )}
                        style={
                          width >= INSIDE
                            ? row.margin > 0
                              ? { left: `calc(${50 - width}% + 4px)` }
                              : { right: `calc(${50 - width}% + 4px)` }
                            : row.margin > 0
                              ? { right: `calc(${50 + width}% + 4px)` }
                              : { left: `calc(${50 + width}% + 4px)` }
                        }
                      >
                        {row.kind === 'next' ? '≈' : ''}
                        {signed(row.margin)}
                      </span>
                    ) : (
                      <span aria-hidden="true" className="absolute left-[calc(50%+4px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] leading-none text-sand-300/60">
                        end not seen
                      </span>
                    )}
                  </span>
                  {row.expected ? (
                    <span className="mt-0.5 block truncate text-[12px] text-sand-200/70">
                      <span className={cn(FIGURE, 'text-(--az-atk)')}>{row.expected.attackers.toFixed(1)}</span> v{' '}
                      <span className={cn(FIGURE, 'text-(--az-def)')}>{row.expected.defenders.toFixed(1)}</span> likely
                    </span>
                  ) : null}
                </span>
                <span className={cn(FIGURE, 'text-right text-[15px] font-semibold', row.balance === null ? 'text-sand-300/60' : row.balance > 0 ? 'text-(--az-atk)' : row.balance < 0 ? 'text-(--az-def)' : 'text-sand-50')}>
                  {row.balance === null ? '–' : signed(row.balance)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {disagree ? (
        <p className="mt-1 text-[12px] leading-snug text-sand-200/85">
          The tracked sessions add up to <span className={FIGURE}>{signed(balance)}</span>; the marker says <span className={FIGURE}>{signed(siege.balance!)}</span>: a session not tracked, or not
          seen to its end.
        </p>
      ) : null}
      {forecast ? (
        counted === 0 ? (
          <p className="mt-1.5 text-[13px] leading-snug text-sand-200/80">
            {known === 'ready' ? 'No usual hours known for either side yet: the records are young, so the sessions to come are listed as even.' : known === 'down' ? 'The records couldn’t be read just now.' : 'Reading the records…'}
          </p>
        ) : (
          <>
            {line ? <p className="mt-1.5 text-[15px] font-semibold leading-snug text-sand-100">{line}</p> : null}
            <p className="mt-1 text-[12px] leading-snug text-sand-200/85">
              Rests on the usual hours of {restsWords(who('attackers'), rests.attackers)}, and of {restsWords(who('defenders'), rests.defenders)}
              {siege.townNation && !sameNation(siege.townNation, siege.defender) ? ` (${spoken(siege.townNation)}’s not among them)` : ''}; an ally for the share of their fighting done for
              allies, one the map doesn’t know of not at all.
            </p>
          </>
        )
      ) : null}
    </div>
  )
}
