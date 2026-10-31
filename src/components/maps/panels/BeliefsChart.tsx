'use client'

import { useState, type MouseEvent, type PointerEvent } from 'react'

import { cn } from '@/blocks/components/shared'
import type { Beliefs, Share } from '@/maps/beliefs'
import { spoken } from '@/maps/data'
import { BELIEF_COLOURS, GROUND, NO_NATION } from '@/maps/palette'

import { Icon } from '../ui/icons'
import { PanelSection } from './shared'

/**
 * A nation's cultures and religions (src/maps/beliefs.ts), each a ring of
 * its people with the key beside it: a slice a share, the largest first
 * from the top, the towns that haven't chosen last and hatched, and a
 * long tail folded into "n more", which opens to list them. The key says
 * all the ring does — name, people, towns, share — so the colours only
 * help; a slice and its row light up together under the pointer, or on a
 * tap. A name's colour is its own in every nation's chart (hashed into the
 * palette), so Catholic is Catholic wherever it's met. Said in a sentence
 * where a chart would only belabour it: one share, or none chosen at all.
 */

/** At most this many named shares get a slice of their own; past six, the smallest are folded together, since a tail of one isn't worth a fold. */
const SHOWN = 5
const FOLD_PAST = 6

/** The ring, in its own units: the hole is where the share under the pointer is written. */
const RING = { outer: 46, inner: 30, centre: 50 }

/** The hatching for the towns that have chosen nothing: one pattern, the same wherever it's drawn, so no hook is needed. */
const HATCH = 'az-beliefs-hatch'

type Slice = {
  key: string
  label: string
  towns: number
  residents: number
  /** A named share's colour; the tail's grey; none for the towns that haven't chosen, which are hatched. */
  fill: string | null
  kind: 'named' | 'others' | 'none'
  /** The shares folded into the tail. */
  folded: Share[]
}

/** A name's slot in the palette: the same for the same name, however it's capitalised. */
function slotOf(name: string): number {
  let hash = 5381
  for (const char of name.toLowerCase()) hash = ((hash * 33) ^ char.codePointAt(0)!) >>> 0
  return hash % BELIEF_COLOURS.length
}

/**
 * A colour for each named share shown: its own by its name, or the next
 * free one when two names fall on the same, so no two slices of one ring
 * share a colour (there are always more colours than slices).
 */
function coloursOf(names: string[]): string[] {
  const taken = new Set<number>()
  return names.map((name) => {
    let slot = slotOf(name)
    while (taken.has(slot)) slot = (slot + 1) % BELIEF_COLOURS.length
    taken.add(slot)
    return BELIEF_COLOURS[slot]
  })
}

function slicesOf(shares: Share[]): Slice[] {
  const named = shares.filter((share) => share.name !== null)
  const none = shares.find((share) => share.name === null)
  const shown = named.length > FOLD_PAST ? named.slice(0, SHOWN) : named
  const tail = named.slice(shown.length)
  const fills = coloursOf(shown.map((share) => share.name!))
  const slices: Slice[] = shown.map((share, index) => ({
    key: share.name!.toLowerCase(),
    label: spoken(share.name!),
    towns: share.towns,
    residents: share.residents,
    fill: fills[index],
    kind: 'named',
    folded: [],
  }))
  if (tail.length) {
    slices.push({
      key: 'others',
      label: `${tail.length} more`,
      towns: tail.reduce((sum, share) => sum + share.towns, 0),
      residents: tail.reduce((sum, share) => sum + share.residents, 0),
      fill: NO_NATION.line,
      kind: 'others',
      folded: tail,
    })
  }
  if (none) slices.push({ key: 'none', label: 'None chosen', towns: none.towns, residents: none.residents, fill: null, kind: 'none', folded: [] })
  return slices
}

const percent = (part: number, whole: number): string => {
  if (!whole || !part) return '0%'
  const share = (part / whole) * 100
  return share < 1 ? '<1%' : `${Math.round(share)}%`
}

/** "18 in 3 towns": a share's people, and the towns they're in. */
const peopleWords = (slice: Pick<Slice, 'residents' | 'towns'>): string =>
  `${slice.residents.toLocaleString('en-GB')} in ${slice.towns.toLocaleString('en-GB')} town${slice.towns === 1 ? '' : 's'}`

/** A point on the ring: angles run clockwise from the top, in radians. */
const polar = (angle: number, radius: number): string =>
  `${(RING.centre + radius * Math.sin(angle)).toFixed(2)} ${(RING.centre - radius * Math.cos(angle)).toFixed(2)}`

/** A slice of the ring between two angles, as a path; a wedge from the centre out past the ring's edge when `hit`, to catch the pointer. */
function arcPath(from: number, to: number, hit = false): string {
  const large = to - from > Math.PI ? 1 : 0
  if (hit) return `M${RING.centre} ${RING.centre}L${polar(from, 50)}A50 50 0 ${large} 1 ${polar(to, 50)}Z`
  const { outer, inner } = RING
  return `M${polar(from, outer)}A${outer} ${outer} 0 ${large} 1 ${polar(to, outer)}L${polar(to, inner)}A${inner} ${inner} 0 ${large} 0 ${polar(from, inner)}Z`
}

type Arc = { slice: Slice; from: number; to: number }

/** The slices as arcs, each from where the last ended; a share of nothing takes no room. */
function arcsOf(slices: Slice[], total: number): Arc[] {
  const arcs: Arc[] = []
  let angle = 0
  for (const slice of slices) {
    const to = angle + (slice.residents / total) * Math.PI * 2
    arcs.push({ slice, from: angle, to })
    angle = to
  }
  return arcs
}

/** A share's fill as painted: its colour, or the hatching for none. */
const paint = (slice: Slice): string => slice.fill ?? `url(#${HATCH})`

/** Only a mouse picks a share out by passing over it; a finger does by a tap, which a mouse's click isn't (a click is a pointer event where the browser says what pressed; elsewhere it's taken for a tap). */
const byMouse = (event: PointerEvent | MouseEvent): boolean =>
  ('pointerType' in event ? event.pointerType : (event.nativeEvent as { pointerType?: string }).pointerType) === 'mouse'

/**
 * One measure: its ring, with the share under the pointer (or else the
 * largest) written in the hole, and its key. Where there's nothing to
 * chart, a sentence instead.
 */
function BeliefFigure({ label, what, shares, towns }: { label: string; what: 'culture' | 'religion'; shares: Share[]; towns: number }) {
  const [active, setActive] = useState<string | null>(null)
  const slices = slicesOf(shares)
  const total = slices.reduce((sum, slice) => sum + slice.residents, 0)
  // Said in a sentence where a ring would only belabour it: nothing chosen, or one choice everywhere.
  // A town is Norse, but follows Islam.
  const one = what === 'culture' ? (towns === 1 ? 'is' : 'are') : towns === 1 ? 'follows' : 'follow'
  const sentence =
    !slices.some((slice) => slice.kind !== 'none')
      ? `${towns === 1 ? 'Its town hasn’t' : 'No town has'} chosen a ${what} yet.`
      : slices.length === 1 && slices[0].kind === 'named'
        ? `${towns === 1 ? 'Its one town' : `All ${towns} towns`} ${one} ${slices[0].label}.`
        : null
  if (!sentence && total === 0) return null

  const shown = slices.find((slice) => slice.key === active) ?? slices[0]
  const toggle = (key: string) => setActive((current) => (current === key ? null : key))
  const arcs = arcsOf(slices, total)
  const rowOf = (slice: Slice) =>
    cn(
      '-mx-1.5 flex items-center gap-2 px-1.5 py-1 transition-colors motion-reduce:transition-none',
      active === slice.key && 'bg-sand-100',
      slice.kind === 'none' ? 'text-ink-500' : 'text-ink-900',
    )
  const passes = (slice: Slice) => ({
    onPointerEnter: (event: PointerEvent) => byMouse(event) && setActive(slice.key),
    onPointerLeave: (event: PointerEvent) => byMouse(event) && setActive(null),
  })
  const catches = (slice: Slice) => ({
    ...passes(slice),
    onClick: (event: MouseEvent) => !byMouse(event) && toggle(slice.key),
  })

  return (
    <div className={cn('min-w-0', !sentence && 'flex items-center gap-4')}>
      {sentence ? null : (
        <div className="relative h-24 w-24 shrink-0">
          <svg
            aria-hidden="true"
            className="h-full w-full"
            onPointerLeave={(event) => byMouse(event) && setActive(null)}
            viewBox="0 0 100 100"
          >
            <defs>
              <pattern height={5} id={HATCH} patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width={5}>
                <rect fill={GROUND.sand} height={5} width={5} />
                <line stroke="#d6c9ab" strokeWidth={1.6} x1={0} x2={0} y1={0} y2={5} />
              </pattern>
            </defs>
            {arcs.map(({ slice, from, to }) =>
              to - from >= Math.PI * 2 - 1e-6 ? (
                // The whole ring: one share of everything, which an arc can't draw.
                <circle
                  cx={RING.centre}
                  cy={RING.centre}
                  fill="none"
                  key={slice.key}
                  r={(RING.outer + RING.inner) / 2}
                  stroke={paint(slice)}
                  strokeWidth={RING.outer - RING.inner}
                />
              ) : to > from ? (
                // A whitewash edge is the gap between neighbours; the rest dim while one is picked out.
                <path
                  className="transition-opacity duration-150 motion-reduce:transition-none"
                  d={arcPath(from, to)}
                  fill={paint(slice)}
                  key={slice.key}
                  opacity={active !== null && active !== slice.key ? 0.35 : 1}
                  stroke={GROUND.whitewash}
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                />
              ) : null,
            )}
            {/* The pointer is caught anywhere in a share's sector, hole and margin included, so a sliver is as easy to find as a slab. */}
            {arcs.map(({ slice, from, to }) =>
              to > from ? (
                <path
                  d={to - from >= Math.PI * 2 - 1e-6 ? `M0 0h100v100H0z` : arcPath(from, to, true)}
                  fill="transparent"
                  key={slice.key}
                  {...catches(slice)}
                />
              ) : null,
            )}
          </svg>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center font-body text-[15px] font-semibold leading-none text-ink-900"
          >
            {percent(shown.residents, total)}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500">{label}</h3>
        {sentence ? (
          <p className="mt-1 text-[15px] text-ink-700">{sentence}</p>
        ) : (
          <ul className="mt-1 text-[14px]">
            {slices.map((slice) =>
              slice.kind === 'others' ? (
                <li key={slice.key}>
                  <details className="group">
                    {/* Opens on a click, so a pass of the mouse is all that picks its slice out. */}
                    <summary
                      className={cn(
                        rowOf(slice),
                        'cursor-pointer list-none focus-visible:outline-saffron-500 [&::-webkit-details-marker]:hidden',
                      )}
                      {...passes(slice)}
                    >
                      <Key slice={slice} />
                      <span className="flex min-w-0 flex-1 items-center gap-1 font-semibold">
                        <span className="truncate">{slice.label}</span>
                        <Icon className="h-3 w-3 shrink-0 text-ink-500 transition-transform group-open:rotate-180" name="chevron" />
                      </span>
                      <Figures slice={slice} total={total} />
                    </summary>
                    <ul className="mb-1 ml-[5px] border-l border-sand-300 pl-4 text-[13px] text-ink-700">
                      {slice.folded.map((share) => (
                        <li className="flex items-center gap-2 py-0.5" key={share.name!.toLowerCase()}>
                          <span className="min-w-0 flex-1 truncate">{spoken(share.name!)}</span>
                          <Figures slice={share} total={total} />
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ) : (
                <li className={rowOf(slice)} key={slice.key} {...catches(slice)}>
                  <Key slice={slice} />
                  <span className={cn('min-w-0 flex-1 truncate', slice.kind === 'named' && 'font-semibold')}>{slice.label}</span>
                  <Figures slice={slice} total={total} />
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

/** A share's swatch in the key, as its slice is painted. */
function Key({ slice }: { slice: Slice }) {
  return (
    <svg aria-hidden="true" className="h-2.5 w-2.5 shrink-0" viewBox="0 0 10 10">
      <rect fill={paint(slice)} height={10} width={10} />
    </svg>
  )
}

/** A share's people and towns, and its share of the whole, in the key's columns. */
function Figures({ slice, total }: { slice: Pick<Slice, 'residents' | 'towns'>; total: number }) {
  return (
    <>
      <span className="shrink-0 whitespace-nowrap text-[13px] text-ink-500">{peopleWords(slice)}</span>
      <span className="w-9 shrink-0 text-right text-[13px] text-ink-700 tabular-nums">{percent(slice.residents, total)}</span>
    </>
  )
}

/**
 * A nation's cultures and religions as a section: the two rings, or one
 * line when none of its towns has chosen either. `towns` is how many
 * players' towns it has, which the shares are of.
 */
export function BeliefsSection({ beliefs, towns }: { beliefs: Beliefs; towns: number }) {
  if (towns === 0) return null
  const chosen = (shares: Share[]) => shares.some((share) => share.name !== null)
  return (
    <PanelSection title="Culture and religion">
      {!chosen(beliefs.cultures) && !chosen(beliefs.religions) ? (
        <p className="text-[15px] italic text-ink-500">
          {towns === 1 ? 'Its town hasn’t' : `None of its ${towns} towns has`} chosen a culture or a religion yet.
        </p>
      ) : (
        <>
          <p className="text-[14px] leading-relaxed text-ink-500">
            Shares of the people, by what each town’s mayor chose in game.
          </p>
          <div className="mt-3 space-y-5">
            <BeliefFigure label="Cultures" shares={beliefs.cultures} towns={towns} what="culture" />
            <BeliefFigure label="Religions" shares={beliefs.religions} towns={towns} what="religion" />
          </div>
        </>
      )}
    </PanelSection>
  )
}
