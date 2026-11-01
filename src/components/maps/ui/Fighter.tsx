'use client'

import type { ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { expectedAt, fighterScore, hourOfWeek } from '@/maps/fighters'

import type { FighterEntry, FightersState } from '../fighters'

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
const n = (value: number) => value.toLocaleString('en-GB')
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** From how many battles fought a record says enough to be judged by. */
export const ENOUGH = 2

/** The tracker's first day, said where there's nothing yet. */
const TRACKED_FROM = '1 November'

/** "3 days ago", "today", "6 weeks ago". */
function agoWords(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return `${Math.floor(days / 7)} weeks ago`
}

/** The score as a small pill: a figure of 100, dim where it rests on too little. */
export function ScoreBadge({ record, tone, className }: { record: FighterEntry; tone: Tone; className?: string }) {
  const score = fighterScore(record)
  const thin = record.fought < ENOUGH
  const t = TONES[tone]
  return (
    <span
      className={cn('inline-flex items-baseline gap-1 border px-1.5 py-0.5', t.line, thin ? t.faint : t.ink, className)}
      title={`Score ${score} of 100: the chance they take the banner when they try, times the chance they turn up; ${
        thin ? `rests on ${record.fought === 0 ? 'no battle' : 'one battle'} fought, so says little yet` : `from ${record.fought} battles`
      }`}
    >
      <span className={cn(FIGURE, 'text-[15px] leading-none')}>{score}</span>
      <span className="text-[11px] uppercase tracking-[0.12em] opacity-70">score</span>
    </span>
  )
}

/**
 * The week as a strip, seven rows of twenty-four: each hour's cell as
 * dark as the share of days they were online then, the hour of now ringed
 * in saffron, UTC as the server keeps its sessions.
 */
export function WeekStrip({ hours, now, tone, days }: { hours: number[]; now: number; tone: Tone; days: number }) {
  const t = TONES[tone]
  const here = hourOfWeek(now)
  const weeks = Math.max(1, Math.round(days / 7))
  return (
    <div className="az-week" style={{ '--az-strip': t.strip } as React.CSSProperties}>
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
  const lines: ReactNode[] = []
  lines.push(
    <Line key="turnout" tone={tone} figure={n(record.fought)} words={record.could ? `of ${n(record.could)} battle${record.could === 1 ? '' : 's'} they could, fought` : 'battles fought'} />,
  )
  if (record.fought) {
    lines.push(
      <Line
        key="banner"
        tone={tone}
        figure={tries ? `${n(record.held)}` : '–'}
        words={
          tries
            ? `of ${n(tries)} ${tries === 1 ? 'try' : 'tries'} at the banner held${record.died ? ` · ${n(record.died)} died` : ''}${record.left ? ` · ${n(record.left)} left` : ''}${
                record.cut ? ` · ${n(record.cut)} cut short` : ''
              }`
            : 'tries at the banner'
        }
      />,
    )
    lines.push(
      <Line
        key="deaths"
        tone={tone}
        figure={n(record.deaths)}
        words={`death${record.deaths === 1 ? '' : 's'} in the zone${record.deaths ? ` · ${n(record.confirmed)} confirmed by the points` : ''}`}
      />,
    )
    lines.push(<Line key="minutes" tone={tone} figure={n(record.minutes)} words={`min in the zone · ${n(record.bannerMinutes)} at the banner`} />)
    if (record.won || record.lost)
      lines.push(<Line key="sessions" tone={tone} figure={`${n(record.won)}–${n(record.lost)}`} words="sessions won and lost, on points" />)
  }
  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow}
          {record.lastFought ? (
            <p className={cn('text-[13px]', t.faint)}>
              Last fought {agoWords(record.lastFought, now)}
              {record.side && record.side !== 'other' ? ` as ${record.side === 'attackers' ? 'an attacker' : 'a defender'}` : ''}
            </p>
          ) : null}
        </div>
        <ScoreBadge record={record} tone={tone} />
      </div>
      <dl className="mt-1.5 space-y-1">{lines}</dl>
      {thin ? (
        <p className={cn('mt-1.5 text-[13px] leading-snug', t.faint)}>
          {record.fought === 0 ? 'Never fought one: ' : 'One battle: '}too few to judge by.
        </p>
      ) : null}
      {record.hours ? <Usual hours={record.hours} now={now} tone={tone} days={state.days} /> : null}
      {state.demo ? <Demo tone={tone} /> : null}
    </div>
  )
}

/** One line of the record: the figure first, large, then its words. */
function Line({ figure, words, tone }: { figure: string; words: string; tone: Tone }) {
  const t = TONES[tone]
  return (
    <div className="flex items-baseline gap-2">
      <dt className={cn(FIGURE, 'min-w-[2.5ch] text-[20px] leading-none', t.ink)}>{figure}</dt>
      <dd className={cn('text-[14px] leading-snug', t.soft)}>{words}</dd>
    </div>
  )
}

/** Their usual hours: the strip, and what it says of now. */
function Usual({ hours, now, tone, days }: { hours: number[]; now: number; tone: Tone; days: number }) {
  const t = TONES[tone]
  const share = hours[hourOfWeek(now)] ?? 0
  const weeks = Math.max(1, Math.round(days / 7))
  const day = DAYS[Math.floor(hourOfWeek(now) / 24)]
  return (
    <div className="mt-2.5">
      <p className={t.eyebrow}>Usually on</p>
      <p className={cn('mt-0.5 text-[14px] leading-snug', t.soft)}>
        At this hour on {Math.round(share * weeks)} of the last {weeks} {day}s
        {share >= 0.6 ? ': expect them.' : share > 0 ? '.' : ': not usually on now.'}
      </p>
      <div className="mt-1.5">
        <WeekStrip days={days} hours={hours} now={now} tone={tone} />
      </div>
      <p className={cn('mt-1 text-[12px]', t.faint)}>Hours in UTC, the last {days} days; now is ringed.</p>
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
  return `${record.fought} of ${record.could} fought${tries ? ` · ${record.held} of ${tries} held` : ''}`
}

/** Who to expect: a resident ranked by being on now, then by how likely they are to be fighting at `at`. */
export type Expected = { name: string; online: boolean; expected: number | null; record: FighterEntry | null }

export function rankExpected(names: string[], state: FightersState, online: Set<string>, at: number): Expected[] {
  const seen = new Set<string>()
  const out: Expected[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const record = state.byName.get(key) ?? null
    out.push({ name, online: online.has(key), expected: record ? expectedAt(record, at) : null, record })
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
