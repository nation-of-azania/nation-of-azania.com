'use client'

import type { ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { expectedAt, fighterScore, hourOfWeek } from '@/maps/fighters'
import { asPips, countWords, n } from '@/maps/marks'

import type { FighterEntry, FightersState } from '../fighters'
import { Hint, HintMark } from './Hint'
import { Meter, Pips, SideMark, Tally, WinLoss, type MarkSize } from './Marks'

/**
 * A fighter's record, as the war view and the players' panels show it
 * (src/maps/fighters.ts; ../fighters.ts fetches): how often they turned
 * up to a battle they could have fought, their tries at the banner and
 * how each ended, their deaths, minutes, sessions won and lost, their
 * score, and their usual hours as a strip of the week with now marked.
 * Counts, not bare percentages: the records are days old and the samples
 * small, and the card says so where they're too few to judge. The same
 * pieces are set on the war sidebar's dark (`tone="war"`) and on a
 * panel's sand (`tone="panel"`), in each one's own tokens.
 */

export type Tone = 'war' | 'panel'

/** The tokens of each tone: the ink and the quieter ink, hairlines, a tint, and the strip's colour. */
const TONES: Record<Tone, { ink: string; soft: string; faint: string; line: string; tint: string; strip: string; eyebrow: string }> = {
  war: {
    ink: 'text-sand-50',
    soft: 'text-sand-200/80',
    faint: 'text-sand-300/70',
    line: 'border-sand-50/10',
    tint: 'bg-sand-50/5',
    strip: '#8acbd2',
    eyebrow: 'font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-sand-200/75',
  },
  panel: {
    ink: 'text-ink-900',
    soft: 'text-ink-700',
    faint: 'text-ink-500',
    line: 'border-sand-300/70',
    tint: 'bg-sand-100',
    strip: '#1a4461',
    eyebrow: 'font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500',
  },
}

const FIGURE = 'font-mono font-semibold tabular-nums'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** From how many battles fought a record says enough to be judged by. */
export const ENOUGH = 2

/** The tracker's first day, said where there's nothing yet. */
const TRACKED_FROM = '1 November'

/** "3 days ago", "today", "6 weeks ago". */
export function agoWords(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return `${Math.floor(days / 7)} weeks ago`
}

/** What the score is, for the one hint a section's head carries where its rows wear the badge without one. */
export const SCORE_WORDS = 'Score: the chance they take the banner when they try, times the chance they turn up, both smoothed.'

/**
 * The score as a small pill: a figure of 100, dim where it rests on too
 * little. On its own it carries what it is as its hint; in a roster
 * (`hint={false}`) the section's head says it once instead.
 */
export function ScoreBadge({ record, tone, className, hint = true }: { record: FighterEntry; tone: Tone; className?: string; hint?: boolean }) {
  const score = fighterScore(record)
  const thin = record.fought < ENOUGH
  const t = TONES[tone]
  const badge = (
    <span className={cn('inline-flex items-baseline gap-1 border px-1.5 py-0.5', t.line, thin ? t.faint : t.ink, className)} tabIndex={hint ? 0 : undefined}>
      <span className={cn(FIGURE, 'text-[15px] leading-none')}>{score}</span>
      <span className="text-[11px] uppercase tracking-[0.12em] opacity-70">score</span>
    </span>
  )
  if (!hint) return badge
  return (
    <Hint
      text={`Score ${score} of 100: the chance they take the banner when they try, times the chance they turn up; ${
        thin ? `rests on ${record.fought === 0 ? 'no battle session' : 'one battle session'} fought, so says little yet.` : `from ${record.fought} battle sessions.`
      }`}
    >
      {badge}
    </Hint>
  )
}

/** "7 of 9 sessions fought", with the sessions for allies when there were any: the one phrasing for turnout across the war view. */
export function foughtWords(record: FighterEntry): string {
  return `${countWords(record.fought, record.could, 'sessions fought')}${record.allied ? `, ${n(record.allied)} for allies` : ''}`
}

/**
 * A fighter's record in a row: the sessions fought as pips ("7/9 fought"),
 * the tries at the banner held as pips or a meter ("6/21 held"), and the
 * side they last fought on as its glyph. The same marks wherever a roster
 * or a card says a record in a line: the overview's scores, who to expect,
 * the player's card on the map.
 */
export function RecordMarks({ record, tone, size = 'row', held = true, className }: { record: FighterEntry; tone: Tone; size?: MarkSize; held?: boolean; className?: string }) {
  const tries = record.held + record.died + record.left
  const t = TONES[tone]
  const word = (text: string) => <span className={cn('text-[12px]', t.soft)}>{text}</span>
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5', className)}>
      <Pips done={record.fought} of={record.could} size={size} tone={tone} words={foughtWords(record)} />
      {word('fought')}
      {held && tries ? (
        <>
          <span className={cn('text-[12px]', t.faint)}>·</span>
          <Pips className={asPips(tries) ? undefined : 'w-16'} done={record.held} of={tries} size={size} tone={tone} words={countWords(record.held, tries, 'tries at the banner held')} />
          {word('held')}
        </>
      ) : null}
      {record.side && record.side !== 'other' ? <SideMark className="ml-0.5" side={record.side} size={size} words={`last fought ${record.side === 'attackers' ? 'as an attacker' : 'as a defender'}`} /> : null}
    </span>
  )
}

/**
 * The week as a strip, seven rows of twenty-four: each hour's cell as
 * dark as the share of days they were online then, the hour of now ringed
 * in saffron, UTC as the server keeps its sessions.
 */
export function WeekStrip({ hours, now, tone, days, words }: { hours: number[]; now: number; tone: Tone; days: number; words?: string }) {
  const t = TONES[tone]
  const here = hourOfWeek(now)
  const weeks = Math.max(1, Math.round(days / 7))
  return (
    <div aria-label={words} className="az-week" role={words ? 'img' : undefined} style={{ '--az-strip': t.strip } as React.CSSProperties}>
      <div className="az-week-hours" aria-hidden="true">
        {[0, 6, 12, 18].map((hour) => (
          <span key={hour} style={{ gridColumnStart: hour + 1 }}>
            {String(hour).padStart(2, '0')}
          </span>
        ))}
      </div>
      {DAYS.map((day, weekday) => (
        <div className="az-week-row" key={day}>
          <span aria-hidden="true" className={cn('az-week-day', t.faint)}>
            {day.slice(0, 2)}
          </span>
          {Array.from({ length: 24 }, (_, hour) => {
            const index = weekday * 24 + hour
            const share = hours[index] ?? 0
            return (
              <span
                className="az-week-cell"
                data-now={index === here ? '' : undefined}
                key={hour}
                style={{ '--az-share': share } as React.CSSProperties}
                title={`${day} ${String(hour).padStart(2, '0')}:00 UTC · on ${Math.round(share * weeks)} of ${weeks} ${day}s`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * The record in full: for a player's view. `state` says how much there is
 * at all, so an empty record is said honestly: no battles tracked yet,
 * none fought, or too few to judge.
 */
export function FighterCard({
  record,
  state,
  now,
  tone,
  className,
}: {
  record: FighterEntry | null
  state: FightersState
  now: number
  tone: Tone
  className?: string
}) {
  const t = TONES[tone]
  const eyebrow = <p className={t.eyebrow}>In the battles{state.since ? ' · last 60 days' : ''}</p>
  if (state.status === 'asking' || state.status === 'idle')
    return (
      <div className={className}>
        {eyebrow}
        <p className={cn('mt-1 text-[14px]', t.soft)}>Reading the records…</p>
      </div>
    )
  if (state.status === 'down')
    return (
      <div className={className}>
        {eyebrow}
        <p className={cn('mt-1 text-[14px]', t.soft)}>The records couldn’t be read just now.</p>
      </div>
    )
  if (state.battles === 0)
    return (
      <div className={className}>
        {eyebrow}
        <p className={cn('mt-1 text-[14px] leading-snug', t.soft)}>No battles recorded yet: the tracker reads every battle from {TRACKED_FROM}.</p>
      </div>
    )
  if (!record)
    return (
      <div className={className}>
        {eyebrow}
        <p className={cn('mt-1 text-[14px] leading-snug', t.soft)}>
          Not seen near a battle in the last 60 days ({state.battles} recorded).
        </p>
        {state.demo ? <Demo tone={tone} /> : null}
      </div>
    )
  const thin = record.fought < ENOUGH
  const tries = record.held + record.died + record.left
  // Sessions, not battles: one at an ally's siege, or at one of their nation's two at once, isn't absent from the other.
  const extras = [record.battles > record.fought ? `${n(record.battles)} battles` : null, record.allied ? `${n(record.allied)} for allies` : null].filter(Boolean)
  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow}
          {record.lastFought ? (
            <p className={cn('flex items-center gap-1.5 text-[13px]', t.faint)}>
              Last fought {agoWords(record.lastFought, now)}
              {record.side && record.side !== 'other' ? <SideMark side={record.side} words={`as ${record.side === 'attackers' ? 'an attacker' : 'a defender'}`} /> : null}
            </p>
          ) : null}
        </div>
        <ScoreBadge record={record} tone={tone} />
      </div>
      {/* Each line a mark first, its words after: the figure is the mark's, said once. */}
      <dl className="mt-2 space-y-1.5">
        <Line tone={tone} words={`sessions fought${record.could ? ', of those they could' : ''}${extras.length ? ` · ${extras.join(' · ')}` : ''}`}>
          <Pips done={record.fought} of={Math.max(record.could, record.fought)} size="panel" tone={tone} words={foughtWords(record)} />
        </Line>
        {record.fought ? (
          <>
            <Line tone={tone} words={tries ? 'tries at the banner' : 'no try at the banner yet'}>
              {tries ? (
                <Tally
                  className="w-44"
                  noun="tries"
                  parts={[
                    { label: 'held', value: record.held },
                    { label: 'died', value: record.died },
                    { label: 'left', value: record.left },
                    ...(record.cut ? [{ label: 'cut short', value: record.cut }] : []),
                  ]}
                  size="panel"
                  tone={tone}
                />
              ) : null}
            </Line>
            <Line tone={tone} words={record.deaths ? 'deaths in the zone, confirmed by the points' : 'deaths in the zone'}>
              {record.deaths ? (
                <Pips done={record.confirmed} of={record.deaths} size="panel" tone={tone} words={`${n(record.deaths)} death${record.deaths === 1 ? '' : 's'} in the zone, ${n(record.confirmed)} confirmed by the points`} />
              ) : (
                <span className={cn(FIGURE, 'text-[15px]', t.ink)}>0</span>
              )}
            </Line>
            <Line tone={tone} words="min at the banner, of those in the zone">
              <Meter className="w-36" noun="min" of={record.minutes} size="panel" tone={tone} value={record.bannerMinutes} words={`${n(record.bannerMinutes)} of ${n(record.minutes)} minutes in the zone at the banner`} />
            </Line>
            {record.won || record.lost ? (
              <Line tone={tone} words="sessions won and lost, on points">
                <WinLoss lost={record.lost} size="panel" tone={tone} won={record.won} />
              </Line>
            ) : null}
          </>
        ) : null}
      </dl>
      {thin ? (
        <p className={cn('mt-1.5 text-[13px] leading-snug', t.faint)}>
          {record.fought === 0 ? 'Never fought one: ' : 'One session: '}too few to judge by.
        </p>
      ) : null}
      {record.hours ? <Usual hours={record.hours} now={now} tone={tone} days={state.days} /> : null}
      {state.demo ? <Demo tone={tone} /> : null}
    </div>
  )
}

/** One line of the record: the mark first, with its figure, then its words. */
function Line({ children, words, tone }: { children: ReactNode; words: string; tone: Tone }) {
  const t = TONES[tone]
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
      <dt className="shrink-0">{children}</dt>
      <dd className={cn('text-[13px] leading-snug', t.soft)}>{words}</dd>
    </div>
  )
}

/** Their usual hours: the strip, and what it says of now. */
function Usual({ hours, now, tone, days }: { hours: number[]; now: number; tone: Tone; days: number }) {
  const t = TONES[tone]
  const share = hours[hourOfWeek(now)] ?? 0
  const weeks = Math.max(1, Math.round(days / 7))
  const day = DAYS[Math.floor(hourOfWeek(now) / 24)]
  // What the ringed cell says: the strip's words for a screen reader, and the hint's last sentence; the strip shows it.
  const now_ = `At this hour on ${Math.round(share * weeks)} of the last ${weeks} ${day}s${share >= 0.6 ? ': expect them.' : share > 0 ? '.' : ': not usually on now.'}`
  return (
    <div className="mt-2.5">
      <p className={t.eyebrow}>
        Usually on
        <HintMark label="About their usual hours" text={`A week of hours, Monday first, in UTC: each cell as dark as the share of the last ${days} days they were online then. Now is ringed. ${now_}`} />
      </p>
      <div className="mt-1.5">
        <WeekStrip days={days} hours={hours} now={now} tone={tone} words={`Their usual hours, a week in UTC. ${now_}`} />
      </div>
    </div>
  )
}

function Demo({ tone }: { tone: Tone }) {
  return <p className={cn('mt-1.5 text-[12px] italic', TONES[tone].faint)}>Made up: the war demo’s records.</p>
}

/** A line of the record for a roster or a card: turnout and the banner in a few words, or that there's nothing yet. */
export function recordWords(record: FighterEntry | null, state: FightersState): string | null {
  if (state.status !== 'ready') return null
  if (state.battles === 0) return 'No battles tracked yet'
  if (!record) return 'No battle in 60 days'
  const tries = record.held + record.died + record.left
  return `${record.fought} of ${record.could} sessions fought${tries ? ` · ${record.held} of ${tries} held` : ''}`
}

/** Who to expect: a resident ranked by being on now, then by how likely they are to be fighting at `at`. */
export type Expected = { name: string; online: boolean; expected: number | null; record: FighterEntry | null }

/**
 * `share` scales how likely each is, 0 to 1: for an ally's residents, the
 * share of their fighting done for allies (src/maps/fighters.ts →
 * allyShare), since an alliance alone brings nobody.
 */
export function rankExpected(names: string[], state: FightersState, online: Set<string>, at: number, share?: (record: FighterEntry) => number): Expected[] {
  const seen = new Set<string>()
  const out: Expected[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const record = state.byName.get(key) ?? null
    const likely = record ? expectedAt(record, at) : null
    out.push({ name, online: online.has(key), expected: likely === null ? null : Math.round(likely * (share ? share(record!) : 1) * 100) / 100, record })
  }
  return out.sort(
    (a, b) =>
      Number(b.online) - Number(a.online) ||
      (b.expected ?? -1) - (a.expected ?? -1) ||
      (b.record ? fighterScore(b.record) : -1) - (a.record ? fighterScore(a.record) : -1) ||
      a.name.localeCompare(b.name),
  )
}

/** The small icon beside an expected fighter: a dot for online now, else nothing. */
export function OnlineDot({ className }: { className?: string }) {
  return <span aria-label="online now" className={cn('inline-block h-2 w-2 rounded-full bg-lagoon-400', className)} role="img" />
}
