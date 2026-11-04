'use client'

import { useMemo, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { sameNation } from '@/maps/abroad'
import { alliesOf, defendingNation } from '@/maps/alliances'
import { assessBattle, RULES, sessionClock, type BattleReading, type BattleSide } from '@/maps/battle'
import { spoken } from '@/maps/data'
import { allyShare } from '@/maps/fighters'
import { forecastSiege, outlookOf, POINTS_PER_EXTRA_FIGHTER, sessionsAfter, type BattleOutlook, type SiegeForecast, type Target } from '@/maps/outlook'
import type { Siege, WorldTown } from '@/maps/world'

import { useAlliances } from '../alliances'
import { resultOf, sessionsOf, splitSessions, useBattles, type TrackedBattle } from '../battles'
import { useFighters } from '../fighters'
import { HintMark } from '../ui/Hint'
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
const n = (value: number) => Math.round(value).toLocaleString('en-GB')
const signed = (value: number) => (value > 0 ? `+${n(value)}` : n(value))
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

/** "5 online", or "3 online + 2 allies". */
export const onlineWords = ({ residents, allies }: OnlineCount[BattleSide]): string =>
  allies ? `${n(residents)} online + ${n(allies)} ${allies === 1 ? 'ally' : 'allies'}` : `${n(residents)} online`

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
 * The glance: who has it if nothing changes, and for the side behind what
 * it would take from now; whether the leader can leave the banner; the
 * cap when it's reached. One rule of colour, as the verdict had: lagoon
 * when Azania holds, coral when it must act.
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
  const balance = assessed.projected.balance
  // "the 5 Azanians online", or, with allies among them, "the 5 on Azania's side online (3 + 2 allies)".
  const everyone = (side: BattleSide) => {
    const count = online![side]
    const total = count.residents + count.allies
    if (!count.allies) return `the ${n(total)} ${who(side) === 'Azania' ? 'Azanians' : who(side)} online`
    return `the ${n(total)} on ${who(side)}’s side online (${n(count.residents)} + ${n(count.allies)} ${count.allies === 1 ? 'ally' : 'allies'})`
  }
  return (
    <div className={cn('mt-2.5 border-l-4 py-0.5 pl-3', good ? 'border-lagoon-400' : bad ? 'border-coral-500' : 'border-sand-300/40')}>
      <p className={cn('text-[16px] font-semibold leading-snug', good ? 'text-lagoon-300' : bad ? 'text-coral-300' : 'text-sand-50')}>
        {ahead ? (
          <>
            {who(ahead)} {outlook.final ? 'wins the siege' : 'takes this session'} if nothing changes
            {!outlook.final && balance !== null ? (
              <span className="font-normal text-sand-200/85">
                , <span className={FIGURE}>{signed(balance)}</span> going into the next
              </span>
            ) : null}
            {good ? ': hold on.' : '.'}
          </>
        ) : (
          'Level: whoever holds the banner from here takes it.'
        )}
      </p>
      {behind && need ? (
        <p className="mt-0.5 text-[15px] leading-snug text-sand-100">
          {who(behind)}
          {need.holders === null ? (
            <>
              {' '}
              can’t take it in the time left: <span className={cn(FIGURE, 'font-semibold')}>{n(need.kills)}</span> kill{need.kills === 1 ? '' : 's'} short.
            </>
          ) : (
            <>
              : <span className={cn(FIGURE, 'font-semibold')}>{n(need.holders)}</span> holder{need.holders === 1 ? '' : 's'} from now would{' '}
              {outlook.final ? 'win the siege' : 'turn the session'}
              {online ? (
                need.enough ? (
                  <>
                    ; they have <span className={cn(FIGURE, 'font-semibold')}>{onlineWords(online[behind])}</span>.
                  </>
                ) : (
                  <>
                    ; they have only <span className={cn(FIGURE, 'font-semibold')}>{onlineWords(online[behind])}</span>: out of reach,{' '}
                    <span className={cn(FIGURE, 'font-semibold')}>{n(need.kills)}</span> kills short.
                  </>
                )
              ) : (
                '.'
              )}
            </>
          )}
        </p>
      ) : null}
      {outlook.safeToLeave && online ? (
        <p className="mt-0.5 text-[14px] leading-snug text-sand-200/85">
          {outlook.safeToLeave.safe ? (
            <>
              {who(outlook.safeToLeave.side)} could leave the banner: every one of {everyone(other(outlook.safeToLeave.side))} taking it would still leave{' '}
              <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{n(outlook.safeToLeave.margin)}</span> to spare.
            </>
          ) : (
            <>
              {who(outlook.safeToLeave.side)} can’t leave the banner: {everyone(other(outlook.safeToLeave.side))} taking it would overturn the{' '}
              {outlook.final ? 'siege' : 'session'}.
            </>
          )}
        </p>
      ) : null}
      {outlook.overCap ? (
        <p className="mt-0.5 text-[14px] leading-snug text-sand-200/85">
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
  const { finished: past, current } = useMemo(() => splitSessions(sessionsOf(battles, siege), sessionStart), [battles, siege, sessionStart])
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
        <span className="min-w-0 flex-1 truncate text-[13px] text-sand-200/80">
          {siege.progress ? `Session ${Math.min(siege.progress.of, siege.progress.done + (siege.battle ? 1 : 0))} of ${siege.progress.of}` : ''}
          {forecast?.winner ? ` · forecast ${who(forecast.winner).toLowerCase() === 'azania' ? 'Azania' : forecast.winner}` : ''}
        </span>
        <span aria-hidden="true" className="az-outlook-chevron shrink-0 text-sand-200/70">
          ▾
        </span>
      </summary>
      <div className="space-y-3 pb-1 pt-1">
        {assessed && outlook ? <SessionChart assessed={assessed} readings={readings} tracked={current} /> : null}
        {assessed && outlook ? <WhatItTakes outlook={outlook} who={who} online={props.online} /> : null}
        <SiegeStory assessed={assessed} forecast={forecast} past={past} siege={siege} who={who} battlesStatus={battles.status} />
        {forecast ? (
          <SessionsAhead forecast={forecast} rests={{ attackers: sides.attackers.rests, defenders: sides.defenders.rests }} siege={siege} who={who} known={fighters.status} />
        ) : siege.progress && left === 0 ? (
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
 * came before them.
 */
function courseOf(assessed: NonNullable<ReturnType<typeof assessBattle>>, readings: BattleReading[], tracked: TrackedBattle | null = null) {
  const total = RULES.sessionMinutes * 60
  const live = readings
    .filter((reading) => reading.points && reading.secondsLeft !== null)
    .map((reading) => ({ minute: (total - reading.secondsLeft!) / 60, attacker: reading.points!.attacker, defender: reading.points!.defender, banner: reading.banner.side }))
  const firstLive = live.length ? live[0].minute : Infinity
  const before = (tracked?.points ?? [])
    .filter(([minute]) => minute < firstLive - 0.5)
    .map(([minute, attacker, defender, banner]) => ({ minute, attacker, defender, banner: (banner === 'a' ? 'attackers' : banner === 'd' ? 'defenders' : null) as BattleSide | null }))
  const points = [...before, ...live]
  const since = before.length && live.length ? firstLive : null
  const end = assessed.projected ? { minute: RULES.sessionMinutes, ...assessed.projected.points } : null
  const top = Math.max(100, ...points.map((p) => Math.max(p.attacker, p.defender)), end ? Math.max(end.attacker, end.defender) : 0)
  return { points, end, top, since }
}

/** The shape of the session in a few pixels, for the fold's line. */
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
 * make (the projection).
 */
function SessionChart({ assessed, readings, tracked }: { assessed: NonNullable<ReturnType<typeof assessBattle>>; readings: BattleReading[]; tracked: TrackedBattle | null }) {
  const { points, end, top, since } = courseOf(assessed, readings, tracked)
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
          text={`Attackers in coral, defenders in sea. Dashed: to the session’s end, if the banner stays as it is. Along the foot, who held the banner.${
            since !== null ? ` To minute ${Math.round(since)} the tracker’s points, one a minute; the view’s own since.` : ''
          }`}
        />
      </figcaption>
    </figure>
  )
}

/** What each side needs from now, for the session and, when it's another, for the siege. */
function WhatItTakes({ outlook, who, online }: { outlook: BattleOutlook; who: (side: BattleSide) => string; online: OnlineCount | null }) {
  const targets: Target[] = outlook.final ? ['siege'] : ['session', 'siege']
  const words = (target: Target) => (target === 'session' ? 'This session' : outlook.final ? 'The siege' : 'The siege, after all sessions')
  return (
    <div>
      <p className={EYEBROW}>
        What it takes, from now
        <HintMark
          label="About what it takes"
          text="For each side: the points short, the least holders at the banner for the rest of the session that would turn it (five minutes to take it, or to join the holders), and the kills that would do instead. The siege is the balance on their side when all its sessions are fought; the sessions ahead are the rest of the story."
        />
      </p>
      <dl className="mt-1 space-y-1.5">
        {targets.map((target) => (
          <div key={target}>
            <dt className="text-[13px] text-sand-200/75">{words(target)}</dt>
            {(['attackers', 'defenders'] as const).map((side) => {
              const need = outlook.needs[target][side]
              return (
                <dd className="flex items-baseline gap-2 text-[14px] leading-snug" key={side}>
                  <span className={cn('w-24 shrink-0 truncate font-semibold', colour(side))}>{who(side)}</span>
                  <span className="min-w-0 text-sand-100">
                    {need.already ? (
                      <>theirs if nothing changes</>
                    ) : (
                      <>
                        <span className={cn(FIGURE, 'font-semibold')}>{n(need.short)}</span> short ·{' '}
                        {need.holders === null ? (
                          'no number of holders would do in time'
                        ) : (
                          <>
                            <span className={cn(FIGURE, 'font-semibold')}>{n(need.holders)}</span> holder{need.holders === 1 ? '' : 's'} from now
                            {online ? (need.enough ? ` (${onlineWords(online[side])})` : ` (only ${onlineWords(online[side])})`) : ''}
                          </>
                        )}{' '}
                        · or <span className={cn(FIGURE, 'font-semibold')}>{n(need.kills)}</span> kills
                      </>
                    )}
                  </span>
                </dd>
              )
            })}
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * The siege across its sessions: each one's result and the balance after
 * it, within the cap; the one on now as projected; and the ones to come
 * as forecast. Each a row with a bar for the result, attackers' to the
 * right.
 */
function SiegeStory({
  past,
  assessed,
  forecast,
  siege,
  who,
  battlesStatus,
}: {
  past: TrackedBattle[]
  assessed: NonNullable<ReturnType<typeof assessBattle>> | null
  forecast: SiegeForecast | null
  siege: Siege
  who: (side: BattleSide) => string
  battlesStatus: string
}) {
  const capped = (value: number) => Math.max(-RULES.balanceCap, Math.min(RULES.balanceCap, value))
  type Row = { key: string; label: string; when: string; margin: number | null; balance: number | null; kind: 'past' | 'now' | 'next'; note?: string }
  const rows: Row[] = []
  let balance = 0
  past.forEach((battle, index) => {
    const result = resultOf(battle)
    const margin = result ? result.attacker - result.defender : null
    if (margin !== null) balance = capped(balance + margin)
    const start = Date.parse(battle.startedAt)
    rows.push({ key: battle.startedAt, label: `Session ${index + 1}`, when: `${dayOf(start)} ${timeOf(start)}`, margin, balance: margin === null ? null : balance, kind: 'past' })
  })
  // The sessions fought so far, by the marker or the tracker, whichever saw more; the marker's balance is where the siege stands.
  const fought = Math.max(siege.progress?.done ?? 0, past.length)
  const disagree = past.length > 0 && siege.balance !== null && balance !== siege.balance
  if (assessed?.projected && siege.battle) {
    const margin = assessed.projected.points.attacker - assessed.projected.points.defender
    rows.push({
      key: 'now',
      label: `Session ${fought + 1}`,
      when: 'now',
      margin,
      balance: assessed.projected.balance,
      kind: 'now',
      note: 'if the banner stays as it is',
    })
  }
  forecast?.sessions.forEach((session, index) => {
    rows.push({
      key: String(session.start),
      label: `Session ${fought + (siege.battle ? 1 : 0) + index + 1}`,
      when: `${dayOf(session.start)} ${timeOf(session.start)}`,
      margin: session.favoured ? session.swing : 0,
      balance: session.balance,
      kind: 'next',
      note: session.favoured ? `${who(session.favoured)} likely ${session.expected[session.favoured].toFixed(0)} to ${session.expected[other(session.favoured)].toFixed(0)}` : 'even, as far as the hours say',
    })
  })
  const most = Math.max(RULES.balanceCap, ...rows.map((row) => Math.abs(row.margin ?? 0)))
  return (
    <div>
      <p className={EYEBROW}>
        The siege, session by session
        {siege.balance !== null ? (
          <span className="ml-2 normal-case tracking-normal text-sand-200/85">
            balance now <span className={cn(FIGURE, 'font-semibold', siege.balance > 0 ? 'text-(--az-atk)' : siege.balance < 0 ? 'text-(--az-def)' : 'text-sand-50')}>{signed(siege.balance)}</span>
            {Math.abs(siege.balance) >= RULES.balanceCap ? ' · at the cap' : ''}
          </span>
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
          {rows.map((row) => (
            <li className={cn('grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-[13px]', row.kind === 'next' ? 'text-sand-200/70' : 'text-sand-100')} key={row.key}>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{row.label}</span>
                <span className="block truncate text-[12px] text-sand-200/70">{row.when}</span>
              </span>
              <span className="min-w-0">
                <span aria-hidden="true" className="relative block h-2 bg-sand-50/10">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-sand-50/40" />
                  {row.margin ? (
                    <span
                      className={cn('absolute inset-y-0', row.kind === 'next' ? 'opacity-50' : null, row.margin > 0 ? 'bg-(--az-atk)' : 'bg-(--az-def)')}
                      style={{
                        left: row.margin > 0 ? '50%' : `${50 - (Math.abs(row.margin) / most) * 50}%`,
                        width: `${(Math.abs(row.margin) / most) * 50}%`,
                      }}
                    />
                  ) : null}
                </span>
                <span className="block truncate text-[12px] text-sand-200/70">
                  {row.margin === null ? 'end not seen' : `${signed(row.margin)} ${row.kind === 'next' ? 'about' : 'on points'}`}
                  {row.note ? ` · ${row.note}` : ''}
                </span>
              </span>
              <span className={cn(FIGURE, 'text-right text-[15px] font-semibold', row.balance === null ? 'text-sand-300/60' : row.balance > 0 ? 'text-(--az-atk)' : row.balance < 0 ? 'text-(--az-def)' : 'text-sand-50')}>
                {row.balance === null ? '–' : signed(row.balance)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {disagree ? (
        <p className="mt-1 text-[12px] leading-snug text-sand-300/70">
          The sessions tracked add up to <span className={FIGURE}>{signed(balance)}</span>; by the marker the balance stands at{' '}
          <span className={FIGURE}>{signed(siege.balance!)}</span>: a session not tracked, or not seen to its end.
        </p>
      ) : null}
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

/** The sessions still to come: who's likely to show up at each, what it does to the balance, and the lead the loser would need. */
function SessionsAhead({
  forecast,
  rests,
  siege,
  who,
  known,
}: {
  forecast: SiegeForecast
  rests: Record<BattleSide, Rests>
  siege: Siege
  who: (side: BattleSide) => string
  known: string
}) {
  const counted = forecast.known.attackers + forecast.known.defenders
  const flooded = forecast.winner ? forecast.sessions.filter((session) => session.favoured === forecast.winner) : []
  const first = forecast.lead ? forecast.sessions.find((session) => session.favoured === forecast.winner) : null
  const words: ReactNode[] = []
  if (forecast.winner && flooded.length) {
    const biggest = flooded.reduce((best, session) => (Math.abs(session.swing) > Math.abs(best.swing) ? session : best))
    words.push(
      <span key="flood">
        {who(forecast.winner)} {flooded.length === forecast.sessions.length ? 'are likely to bring more at every session left' : `are likely to bring more at ${flooded.map((session) => timeOf(session.start)).join(' and ')}`}{' '}
        (about {biggest.expected[forecast.winner].toFixed(0)} to {biggest.expected[other(forecast.winner)].toFixed(0)} at {timeOf(biggest.start)}).
      </span>,
    )
  }
  if (forecast.lead && first) {
    words.push(
      <span key="lead">
        {' '}
        To come through, {who(forecast.lead.side)} would need a <span className={cn(FIGURE, 'font-semibold text-sand-50')}>{n(forecast.lead.needs)}</span> lead going into{' '}
        {timeOf(first.start)}:{' '}
        {forecast.lead.possible ? 'within the cap, so winning the earlier sessions big enough would do.' : 'more than the cap allows, so they must also contest those sessions.'}
      </span>,
    )
  }
  return (
    <div>
      <p className={EYEBROW}>
        Sessions ahead · {forecast.sessions.length}
        <HintMark
          label="About the forecast"
          text={`Rough: who is likely to fight at each session, from their usual hours and their turnout, and about ${n(POINTS_PER_EXTRA_FIGHTER)} to the balance for each fighter more than the other side brings, if they hold the banner. Rests on the usual hours of ${restsWords(who('attackers'), rests.attackers)}, and of ${restsWords(who('defenders'), rests.defenders)}${
            siege.townNation && !sameNation(siege.townNation, siege.defender) ? ` (${spoken(siege.townNation)}’s not among them)` : ''
          }. An ally counts for the share of their fighting done for allies, as SiegeWar counts a mutual ally’s soldiers for the side; an ally the map doesn’t know of isn’t counted.`}
        />
      </p>
      {counted === 0 ? (
        <p className="mt-1 text-[14px] leading-snug text-sand-200/80">
          {known === 'ready'
            ? 'No usual hours known for either side’s residents or allies yet: the tracker’s records are young. The sessions are listed above.'
            : known === 'down'
              ? 'The records couldn’t be read just now.'
              : 'Reading the records…'}
        </p>
      ) : (
        <>
          <ul className="mt-1 space-y-0.5">
            {forecast.sessions.map((session) => (
              <li className="flex items-baseline gap-2 text-[14px]" key={session.start}>
                <span className={cn(FIGURE, 'w-[7rem] shrink-0 whitespace-nowrap text-sand-100')}>
                  {dayOf(session.start)} {timeOf(session.start)}
                </span>
                <span className="min-w-0 flex-1 text-sand-200/85">
                  <span className="text-(--az-atk)">{session.expected.attackers.toFixed(1)}</span> v <span className="text-(--az-def)">{session.expected.defenders.toFixed(1)}</span> likely
                  {session.favoured ? (
                    <>
                      {' '}
                      · <span className={cn(FIGURE, 'font-semibold', colour(session.favoured))}>{signed(session.swing)}</span>
                    </>
                  ) : (
                    ' · even'
                  )}
                </span>
                <span className={cn(FIGURE, 'shrink-0 font-semibold', session.balance > 0 ? 'text-(--az-atk)' : session.balance < 0 ? 'text-(--az-def)' : 'text-sand-50')}>
                  {signed(session.balance)}
                </span>
              </li>
            ))}
          </ul>
          {words.length ? <p className="mt-1.5 text-[15px] leading-snug text-sand-100">{words}</p> : null}
        </>
      )}
    </div>
  )
}
