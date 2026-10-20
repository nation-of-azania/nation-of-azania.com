import type { MapEvent } from '@/maps/data'
import { GROUND } from '@/maps/palette'
import { eventPhase, type EventPhase } from '@/maps/time'

import { halo, inBounds, labelBeside, LabelPlacer, textWidth, type Projection, type Rect } from './projection'

type Props = {
  projection: Projection
  events: MapEvent[]
  /** Which to show; the default leaves out what's over. */
  phases?: EventPhase[]
  /** The clock the phases are judged by. */
  now: number
  /** Where the plan put each event's title (./labels.ts); none without it. */
  labels?: Map<number, EventName>
  selected?: number | null
  onSelect?: (event: MapEvent) => void
}

const R = 9

/** Titles show from this zoom. */
const NAMED_FROM = -0.5

/** A mark as it will be drawn: the event, its phase, where and how big. */
export type PlacedMark = { event: MapEvent; phase: EventPhase; x: number; y: number; scale: number }

/** An event's title, placed: the text's anchor and position. */
export type EventName = { anchor: 'start' | 'middle' | 'end'; tx: number; ty: number }

/**
 * Where the marks go at this zoom: beside the place's own pin, and two at
 * one spot beside each other. Shared by the drawing and by the label plan
 * (./labels.ts). Empty when too far out.
 */
export function eventMarks(
  projection: Projection,
  events: MapEvent[],
  now: number,
  phases: EventPhase[] = ['upcoming', 'now'],
  selected: number | null = null,
): PlacedMark[] {
  const { zoom, bounds } = projection
  if (zoom < -3.5) return []
  const scale = zoom < -1.5 ? 0.7 : zoom < -0.5 ? 0.85 : 1
  const seen = new Map<string, number>()
  return events
    .filter((event) => {
      const phase = eventPhase(event, now)
      return (phases.includes(phase) || event.id === selected) && inBounds(bounds, event.point)
    })
    .map((event) => {
      const [px, py] = projection.project(event.point)
      const key = `${Math.round(px)}:${Math.round(py)}`
      const stacked = seen.get(key) ?? 0
      seen.set(key, stacked + 1)
      const isSelected = selected === event.id
      return {
        event,
        phase: eventPhase(event, now),
        x: px + 16 * scale + stacked * 20 * scale,
        y: py - 14 * scale,
        scale: isSelected ? scale * 1.2 : scale,
      }
    })
}

/** The box a mark takes, which no label may cover. */
export const markRect = ({ x, y, scale }: PlacedMark): Rect => {
  const r = R * scale + 1
  return { x: x - r, y: y - r, width: r * 2, height: r * 2 }
}

/**
 * Finds each event's title a spot beside its mark (to the right, else the
 * left), after the towns, roads and places have had theirs; part of the
 * label plan (./labels.ts). The selected event keeps its title.
 */
export function placeEventNames(
  projection: Projection,
  marks: PlacedMark[],
  placer: LabelPlacer,
  selected: number | null = null,
): Map<number, EventName> {
  const placed = new Map<number, EventName>()
  if (projection.zoom < NAMED_FROM) return placed
  const fontSize = 12
  for (const { event, x, y, scale } of marks) {
    const width = textWidth(event.title, fontSize)
    const candidates = (['right', 'left'] as const).map((side) =>
      labelBeside(x, y, width, fontSize, side, R * scale + 4),
    )
    const spot = placer.tryPlace(candidates) ?? (event.id === selected ? candidates[0] : null)
    if (spot) placed.set(event.id, { anchor: spot.anchor, tx: spot.tx, ty: spot.ty })
  }
  return placed
}

/**
 * An event's mark: a pennant in the seal's coral on a short staff, haloed.
 * One that's happening now wears a slowly breathing ring (stilled for
 * readers who ask for less motion, see maps.css); one that's past is
 * drawn hollow. Exported for the lists, which draw the same mark small.
 */
export function EventMark({
  x,
  y,
  phase,
  scale = 1,
  selected = false,
}: {
  x: number
  y: number
  phase: EventPhase
  scale?: number
  selected?: boolean
}) {
  const r = R * scale
  const past = phase === 'past'
  return (
    <g transform={`translate(${x} ${y})`}>
      {phase === 'now' ? (
        <circle className="az-pulse" fill="none" r={r + 3} stroke={GROUND.coral} strokeWidth={2} />
      ) : null}
      {selected ? <circle fill="none" r={r + 4} stroke={GROUND.saffron} strokeWidth={3} /> : null}
      <circle
        fill={past ? GROUND.whitewash : GROUND.coral}
        r={r}
        stroke={past ? GROUND.coral : GROUND.whitewash}
        strokeWidth={1.5 * scale}
      />
      {/* The pennant. */}
      <path
        d={`M${-3 * scale} ${-5 * scale}v${10 * scale}M${-3 * scale} ${-5 * scale}h${7 * scale}l${-2 * scale} ${2.5 * scale}l${2 * scale} ${2.5 * scale}h${-7 * scale}`}
        fill="none"
        stroke={past ? GROUND.coral : GROUND.whitewash}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6 * scale}
      />
    </g>
  )
}

/** Events on the map, where they're held; the title beside the mark where the plan found room. */
export function EventsLayer({
  projection,
  events,
  phases = ['upcoming', 'now'],
  now,
  labels,
  selected,
  onSelect,
}: Props) {
  const interactive = Boolean(onSelect)
  const fontSize = 12
  const marks = eventMarks(projection, events, now, phases, selected)
  if (marks.length === 0) return null

  return (
    <g className="az-events">
      {marks.map(({ event, phase, x, y, scale }) => {
        const isSelected = selected === event.id
        const name = labels?.get(event.id) ?? null
        return (
          <g
            key={event.id}
            className={interactive ? 'az-hit' : undefined}
            onClick={onSelect ? () => onSelect(event) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            {!name ? <title>{event.title}</title> : null}
            <EventMark phase={phase} scale={scale} selected={isSelected} x={x} y={y} />
            {name ? (
              <text
                className="font-body"
                dy={fontSize * 0.36}
                fill={GROUND.coralDeep}
                fontSize={fontSize}
                fontWeight={600}
                textAnchor={name.anchor}
                x={name.tx}
                y={name.ty}
                {...halo(GROUND.whitewash, 3)}
              >
                {event.title}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
