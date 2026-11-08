import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { RULES } from '@/maps/battle'
import {
  asPips,
  capBalanceWords,
  capSpan,
  capX,
  countWords,
  deltaWords,
  headSlotsWords,
  meterWords,
  n,
  ordinal,
  pipGroups,
  pipState,
  rankCell,
  rankWords,
  reachScale,
  reachWords,
  share,
  sideOfBalance,
  sideWords,
  signed,
  slotsOf,
  tallyWords,
  trackScale,
  trackWords,
  winLossWords,
  type Span,
  type TallyPart,
  type WayBackWords,
} from '@/maps/marks'

import { Icon } from './icons'

/**
 * The panels' small marks, each in place of a sentence: "X of Y" as pips
 * or a meter, parts of a whole as a tally, a siege balance against the
 * cap, a rank on its scale, a distance against a limit, the holders
 * needed against those online, and an up-or-down chip. The sums are in
 * src/maps/marks.ts; the look in maps.css (.az-mark), every colour a
 * token or a side's, so each mark holds in the light panels, the dark
 * appearance and the war sidebar, where it takes the sidebar's tone of
 * itself (or told, `tone="war"`). Two sizes: `row`, beside a name or
 * under a line of 13px; `panel`, for a figure of its own.
 *
 * Each mark is one image to a screen reader (`role="img"`), named by the
 * sentence it replaced: the caller's `words`, else the mark's own ("2 of
 * 3 sessions"). Nothing rests on colour alone: position, a pattern or a
 * shape says it too, and the numeral stays beside the mark unless the
 * words around it say the same (`figure={false}`).
 */

export type MarkTone = 'panel' | 'war'
export type MarkSize = 'row' | 'panel'
export type MarkSide = 'attackers' | 'defenders'
export type MarkPattern = 'solid' | 'hatched' | 'hollow' | 'dotted'

type MarkProps = {
  /** The sidebar's tone, where the mark isn't inside `.az-war` already. */
  tone?: MarkTone
  size?: MarkSize
  className?: string
  /** The sentence the mark replaces, for a screen reader and the hover; else the mark says its own figures. */
  words?: string
}

const LAYOUT = {
  /** Beside words: pips, slots, a chip. */
  inline: 'inline-flex items-center gap-x-2 align-middle',
  /** A bar filling its row, the figure after it. */
  row: 'flex items-center gap-x-2',
  /** A bar with a line under it. */
  column: 'flex flex-col items-stretch gap-y-1',
}

/** The mark's shell: an image named by its words, sized and toned by attribute (maps.css → .az-mark). */
function Mark({ words, tone, size = 'row', className, layout = 'inline', children }: MarkProps & { words: string; layout?: keyof typeof LAYOUT; children: ReactNode }) {
  return (
    <span aria-label={words} className={cn('az-mark', LAYOUT[layout], className)} data-size={size} data-tone={tone} role="img" title={words}>
      {children}
    </span>
  )
}

/** The figure beside a mark: `X` in ink, and the rest ("/Y", " of Y blocks") softer. */
function Figure({ value, rest }: { value: string; rest?: string }) {
  return (
    <span aria-hidden="true" className="az-mark-figure shrink-0">
      {value}
      {rest ? <small>{rest}</small> : null}
    </span>
  )
}

/** "X of Y" in the panel size, "X/Y" in a row. */
const ofRest = (size: MarkSize, of: number, noun?: string) => (size === 'panel' ? ` of ${n(of)}${noun ? ` ${noun}` : ''}` : `/${n(of)}`)

const pc = (fraction: number) => `${(fraction * 100).toFixed(3)}%`
const spanStyle = ({ left, width }: Span): CSSProperties => ({ left: pc(left), width: pc(width) })

const TRACK = 'relative block h-(--az-mark-bar) min-w-0 flex-1 bg-(--az-mark-track)'

/** A wall or a tick standing a little proud of the bar, in the track's line or, where it matters, in ink. */
function Tick({ at, ink = false, tall = false }: { at: number; ink?: boolean; tall?: boolean }) {
  return <span className={cn('absolute w-0.5 -translate-x-1/2', tall ? '-inset-y-1' : '-inset-y-0.5', ink ? 'bg-(--az-mark-ink)' : 'bg-(--az-mark-line)')} style={{ left: pc(at) }} />
}

/**
 * "X of Y" as pips, one each, grouped in fives: done solid, the one on
 * now half-filled, the rest hollow. Past twenty it's a meter instead.
 */
export function Pips({
  done,
  of,
  current = null,
  side,
  noun,
  figure = true,
  words,
  ...mark
}: MarkProps & {
  done: number
  of: number
  /** The one on now, counted from 0: the third session is 2. */
  current?: number | null
  /** Coloured as a side's; else in ink. */
  side?: MarkSide
  /** What's counted, for the words: "sessions fought". */
  noun?: string
  figure?: boolean
}) {
  if (!asPips(of)) return <Meter figure={figure} noun={noun} of={of} side={side} value={done} words={words} {...mark} />
  let index = 0
  return (
    <Mark words={words ?? countWords(done, of, noun)} {...mark}>
      <span aria-hidden="true" className="az-pips" data-side={side}>
        {pipGroups(of).map((count, group) => (
          <span className="az-pip-group" key={group}>
            {Array.from({ length: count }, () => {
              const i = index++
              return <span className="az-pip" data-state={pipState(i, done, current)} key={i} />
            })}
          </span>
        ))}
      </span>
      {figure ? <Figure rest={`/${n(of)}`} value={n(done)} /> : null}
    </Mark>
  )
}

/**
 * "X of Y" as a thin bar, with a target's tick when there's one to reach
 * (a bullet graph: "6 of 52 online, 10 needed"). Fills the row; give it a
 * width by class where it shouldn't.
 */
export function Meter({
  value,
  of,
  target = null,
  side,
  noun,
  figure = true,
  words,
  size = 'row',
  ...mark
}: MarkProps & {
  value: number
  of: number
  /** A level to reach, on the same scale, drawn as a tick in ink. */
  target?: number | null
  side?: MarkSide
  noun?: string
  figure?: boolean
}) {
  return (
    <Mark layout="row" size={size} words={words ?? meterWords(value, of, noun, target)} {...mark}>
      <span aria-hidden="true" className={TRACK}>
        <span className="az-mark-fill absolute inset-y-0 left-0" data-side={side} style={{ width: pc(share(value, of)) }} />
        {target !== null ? <Tick at={share(target, of)} ink /> : null}
      </span>
      {figure ? <Figure rest={ofRest(size, of, noun)} value={n(value)} /> : null}
    </Mark>
  )
}

const PATTERNS: MarkPattern[] = ['solid', 'hatched', 'hollow', 'dotted']

/**
 * Parts of a whole as one stacked bar ("6 held, 8 died, 7 left, of 21
 * tries"), each part in its own pattern as well as any colour, with a key
 * under it saying each part's figure. The whole may be more than the parts
 * add up to: the rest stays track.
 */
export function Tally({
  parts,
  of = null,
  noun,
  figure = true,
  words,
  ...mark
}: MarkProps & {
  parts: (TallyPart & { pattern?: MarkPattern; side?: MarkSide })[]
  /** The whole, when it's more than the parts; else their sum. */
  of?: number | null
  noun?: string
  /** The key under the bar. */
  figure?: boolean
}) {
  const sum = parts.reduce((total, part) => total + Math.max(0, part.value), 0)
  const whole = Math.max(of ?? 0, sum)
  const pattern = (part: (typeof parts)[number], index: number) => part.pattern ?? PATTERNS[index % PATTERNS.length]
  return (
    <Mark layout="column" words={words ?? tallyWords(parts, whole || null, noun)} {...mark}>
      <span aria-hidden="true" className="flex h-(--az-mark-bar) gap-px">
        {parts.map((part, index) =>
          part.value > 0 ? <span className="az-mark-fill shrink-0" data-pattern={pattern(part, index)} data-side={part.side} key={part.label} style={{ width: pc(share(part.value, whole)) }} /> : null,
        )}
        {whole > sum ? <span className="min-w-0 flex-1 bg-(--az-mark-track)" /> : null}
      </span>
      {figure ? (
        <span aria-hidden="true" className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-(--az-mark-soft)">
          {parts.map((part, index) => (
            <span className="inline-flex items-center gap-1" key={part.label}>
              <span className="az-mark-fill inline-block h-2 w-2.5" data-pattern={pattern(part, index)} data-side={part.side} />
              <span className="az-mark-figure">{n(part.value)}</span> {part.label}
            </span>
          ))}
          {of !== null && whole > sum ? <span>of {n(whole)}</span> : null}
        </span>
      ) : null}
    </Mark>
  )
}

/**
 * A siege balance against the ±cap (battle.ts → RULES.balanceCap), walls
 * at both ends and even in the middle: the attackers' lead fills towards
 * the left in their colour, the defenders' towards the right in theirs. A
 * solid marker in ink stands where it is now; given `after`, a faint run
 * and a hollow marker show where this session would leave it.
 */
export function CapBalance({
  now,
  after = null,
  cap = RULES.balanceCap,
  names,
  ends,
  figure = false,
  words,
  ...mark
}: MarkProps & {
  now: number
  /** The balance projected to the session's end, when there's one. */
  after?: number | null
  cap?: number
  /** The sides' full names for the words, attacker first; else "the attackers" and "the defenders". */
  names?: [attacker: string, defender: string]
  /** Short tags drawn under the bar's ends, attacker first (sieges.ts → sideTags). */
  ends?: [attacker: string, defender: string]
  /** The balance as a figure after the bar, and the projected one after an arrow. */
  figure?: boolean
}) {
  const nowSide = sideOfBalance(now)
  const afterSide = after !== null ? sideOfBalance(after) : null
  const run = after !== null && after !== now ? capSpan(after, now, cap) : null
  const sideText = (side: MarkSide | null) => (side === 'attackers' ? 'text-(--az-atk)' : side === 'defenders' ? 'text-(--az-def)' : undefined)
  return (
    <Mark layout={ends ? 'column' : 'row'} words={words ?? capBalanceWords(now, after, names, cap)} {...mark}>
      <span className="flex min-w-0 flex-1 items-center gap-x-2">
        <span aria-hidden="true" className={TRACK}>
          <span className="absolute inset-y-0 left-1/2 w-px bg-(--az-mark-line)" />
          {now !== 0 ? <span className="az-mark-fill absolute inset-y-0" data-side={nowSide} style={spanStyle(capSpan(now, 0, cap))} /> : null}
          {run ? <span className="az-mark-fill absolute inset-y-0" data-faint="" data-side={sideOfBalance(after! - now)} style={spanStyle(run)} /> : null}
          <Tick at={0} />
          <Tick at={1} />
          <span className="absolute -inset-y-0.5 w-[3px] -translate-x-1/2 bg-(--az-mark-ink)" style={{ left: pc(capX(now, cap)) }} />
          {after !== null ? <span className="absolute -inset-y-0.5 w-[7px] -translate-x-1/2 border-[1.5px] border-(--az-mark-ink) bg-(--az-mark-paper)" style={{ left: pc(capX(after, cap)) }} /> : null}
        </span>
        {figure ? (
          <span aria-hidden="true" className="az-mark-figure flex items-center gap-x-1.5">
            <span className={sideText(nowSide)}>{signed(now)}</span>
            {after !== null ? (
              <>
                <small>→</small>
                <span className={sideText(afterSide)}>{signed(after)}</span>
              </>
            ) : null}
          </span>
        ) : null}
      </span>
      {ends ? (
        <span aria-hidden="true" className="flex justify-between gap-2 font-label text-[11px] font-semibold uppercase leading-none tracking-[0.12em]">
          <abbr className="min-w-0 truncate text-(--az-atk) no-underline" title={names?.[0]}>
            {ends[0]}
          </abbr>
          <abbr className="min-w-0 truncate text-(--az-def) no-underline" title={names?.[1]}>
            {ends[1]}
          </abbr>
        </span>
      ) : null}
    </Mark>
  )
}

/** A position on a 1…N scale, the first at the left: "4th of 39 nations by people". */
export function RankStrip({ rank, of, noun, figure = true, words, ...mark }: MarkProps & { rank: number; of: number; noun?: string; figure?: boolean }) {
  return (
    <Mark layout="row" words={words ?? rankWords(rank, of, noun)} {...mark}>
      <span aria-hidden="true" className={TRACK}>
        <span className="absolute inset-y-0 min-w-[3px] bg-(--az-mark-ink)" style={spanStyle(rankCell(rank, of))} />
        <Tick at={0} />
        <Tick at={1} />
      </span>
      {figure ? <Figure rest={` of ${n(of)}`} value={ordinal(rank)} /> : null}
    </Mark>
  )
}

/**
 * A distance against a limit, the limit's wall standing where it falls:
 * "4,700 of 12,320 blocks". Within the limit the bar runs to the wall;
 * beyond it the fill runs past the wall, hatched from there.
 */
export function ReachBar({
  distance,
  limit,
  unit = 'blocks',
  figure = true,
  words,
  size = 'row',
  ...mark
}: MarkProps & { distance: number; limit: number; unit?: string; figure?: boolean }) {
  const scale = reachScale(distance, limit)
  return (
    <Mark layout="row" size={size} words={words ?? reachWords(distance, limit, unit)} {...mark}>
      <span aria-hidden="true" className={TRACK}>
        <span className="az-mark-fill absolute inset-y-0 left-0" style={{ width: pc(Math.min(scale.fill, scale.wall)) }} />
        {!scale.within ? <span className="az-mark-fill absolute inset-y-0" data-pattern="hatched" style={spanStyle({ left: scale.wall, width: scale.fill - scale.wall })} /> : null}
        <Tick at={scale.wall} ink tall />
      </span>
      {figure ? <Figure rest={ofRest(size, limit, size === 'panel' ? unit : undefined)} value={n(distance)} /> : null}
    </Mark>
  )
}

/**
 * The needed against the available: a hollow slot for each one needed,
 * filled in turn by those online (solid) and their allies (dashed), and
 * the spare online beyond a hairline. "1 holder needed · 5 online + 1
 * ally" reads as one filled slot and five more marks.
 */
export function HeadSlots({
  needed,
  online,
  allies = 0,
  noun = 'holder',
  figure = true,
  words,
  ...mark
}: MarkProps & { needed: number; online: number; allies?: number; noun?: string; figure?: boolean }) {
  const slots = slotsOf(needed, online, allies)
  const spare = slots.filter((slot) => !slot.slot)
  return (
    <Mark words={words ?? headSlotsWords(needed, online, allies, noun)} {...mark}>
      <span aria-hidden="true" className="az-slots">
        {slots.slice(0, needed).map((slot, i) => (
          <span className="az-slot" data-mark={slot.mark ?? undefined} data-slot="" key={i} />
        ))}
        {needed > 0 && spare.length ? <span className="az-slot-rule" /> : null}
        {spare.map((slot, i) => (
          <span className="az-slot" data-mark={slot.mark ?? undefined} key={`spare-${i}`} />
        ))}
      </span>
      {figure ? <Figure rest={` · ${n(online)}${allies ? ` + ${n(allies)}` : ''} online`} value={`${n(needed)} needed`} /> : null}
    </Mark>
  )
}

/**
 * Sessions won and lost as marks, a form guide's W and L: one solid mark
 * in the good colour for each won, one hatched in the bad for each lost,
 * and the figure "4–3". Past twenty they're a tally instead.
 */
export function WinLoss({ won, lost, figure = true, words, ...mark }: MarkProps & { won: number; lost: number; figure?: boolean }) {
  const said = words ?? winLossWords(won, lost)
  if (!asPips(won + lost))
    return (
      <Tally
        figure={figure}
        parts={[
          { label: 'won', value: won, pattern: 'solid' },
          { label: 'lost', value: lost, pattern: 'hatched' },
        ]}
        words={said}
        {...mark}
      />
    )
  return (
    <Mark words={said} {...mark}>
      <span aria-hidden="true" className="az-pips">
        {pipGroups(won + lost).map((count, group) => (
          <span className="az-pip-group" key={group}>
            {Array.from({ length: count }, (_, i) => {
              const index = group * 5 + i
              return <span className="az-pip" data-state={index < won ? 'won' : 'lost'} key={i} />
            })}
          </span>
        ))}
      </span>
      {figure ? <Figure rest={`–${n(lost)}`} value={n(won)} /> : null}
    </Mark>
  )
}

/**
 * A fighter's place on the way to the banner: a track running two siege
 * zones out from the banner at its right end, the zone shaded, the
 * banner zone's edge ticked, and a mark in the side's colour where they
 * stand (on the left wall when they're further than the track reaches).
 * After the bar, one figure: the time back, or by default the blocks.
 */
export function TrackToBanner({
  distance,
  back = null,
  side,
  figure,
  words,
  size = 'row',
  ...mark
}: MarkProps & {
  distance: number
  /** The way back, for the words; null when they're in the zone or it isn't known. */
  back?: WayBackWords | null
  side?: MarkSide
  /** What's said after the bar: the blocks by default; a time, or nothing (`false`). */
  figure?: ReactNode | false
}) {
  const scale = trackScale(distance)
  return (
    <Mark layout="row" size={size} words={words ?? trackWords(distance, back)} {...mark}>
      <span aria-hidden="true" className={TRACK}>
        <span className="az-mark-fill absolute inset-y-0 right-0" data-faint="" data-pattern="hatched" style={{ left: pc(scale.zoneX) }} />
        <Tick at={scale.bannerX} />
        <Tick at={1} ink tall />
        <span className="az-track-mark absolute -inset-y-0.5 w-[5px] -translate-x-1/2" data-side={side} style={{ left: pc(scale.x) }} />
      </span>
      {figure === false ? null : figure !== undefined ? (
        <span aria-hidden="true" className="az-mark-figure shrink-0">
          {figure}
        </span>
      ) : (
        <Figure rest={size === 'panel' ? ' blocks' : undefined} value={n(distance)} />
      )}
    </Mark>
  )
}

/** The side a fighter fought on, as its glyph: crossed swords for an attacker, a shield for a defender, in the side's colour. */
export function SideMark({ side, words, className, size = 'row' }: { side: MarkSide; words?: string; className?: string; size?: MarkSize }) {
  const said = words ?? sideWords(side)
  return (
    <span aria-label={said} className={cn('inline-flex shrink-0 align-middle', side === 'attackers' ? 'text-(--az-atk)' : 'text-(--az-def)', className)} role="img" title={said}>
      <Icon className={size === 'panel' ? 'h-4 w-4' : 'h-3.5 w-3.5'} name={side === 'attackers' ? 'war' : 'shield'} />
    </span>
  )
}

/**
 * An up-or-down chip: a triangle for the direction and the signed figure.
 * Told which way is good, it's lagoon that way and coral the other; else
 * in ink. No change is a dash.
 */
export function Delta({
  value,
  noun,
  good,
  words,
  className,
  ...mark
}: MarkProps & {
  value: number
  noun?: string
  /** Which direction is the good one, when there is one. */
  good?: 'up' | 'down'
}) {
  const up = value > 0
  const colour = value === 0 || !good ? 'text-(--az-mark-ink)' : (good === 'up') === up ? 'text-(--az-mark-good)' : 'text-(--az-mark-bad)'
  return (
    <Mark className={cn('gap-x-1 border border-current/40 px-1.5 py-0.5 font-mono font-semibold tabular-nums', colour, className)} words={words ?? deltaWords(value, noun)} {...mark}>
      {value === 0 ? (
        <span aria-hidden="true">–</span>
      ) : (
        <>
          <svg aria-hidden="true" className="h-[0.6em] w-[0.6em] shrink-0" viewBox="0 0 10 10">
            <path d={up ? 'M5 1l4.5 8h-9z' : 'M5 9L0.5 1h9z'} fill="currentColor" />
          </svg>
          <span aria-hidden="true">{signed(value)}</span>
        </>
      )}
    </Mark>
  )
}
