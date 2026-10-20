import type { MapEvent } from '@/maps/data'
import { GROUND } from '@/maps/palette'
import { eventPhase, type EventPhase } from '@/maps/time'

import { halo, inBounds, LabelPlacer, textWidth, type Projection } from './projection'

type Props = {
  projection: Projection
  events: MapEvent[]
  placer: LabelPlacer
  /** Which to show; the default leaves out what's over. */
  phases?: EventPhase[]
  /** The clock the phases are judged by. */
  now: number
  selected?: number | null
  onSelect?: (event: MapEvent) => void
  labels?: boolean
}

const R = 9

/**
 * An event's mark: a pennant in the seal's coral on a short staff, haloed.
 * One that's happening now wears a slowly breathing ring (stilled for
 * readers who ask for less motion, see globals.css); one that's past is
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

/**
 * Events on the map, where they're held. Two at one spot step aside from
 * each other so both can be seen; the title appears beside the mark once
 * there's room.
 */
export function EventsLayer({
  projection,
  events,
  placer,
  phases = ['upcoming', 'now'],
  now,
  selected,
  onSelect,
  labels = true,
}: Props) {
  const { zoom, bounds } = projection
  const interactive = Boolean(onSelect)
  if (zoom < -3.5) return null
  const fontSize = 12
  const seen = new Map<string, number>()
  const scale = zoom < -1.5 ? 0.7 : zoom < -0.5 ? 0.85 : 1
  const named = labels && zoom >= -0.5

  const shown = events.filter((event) => {
    const phase = eventPhase(event, now)
    return (phases.includes(phase) || event.id === selected) && inBounds(bounds, event.point)
  })

  return (
    <g className="az-events">
      {shown.map((event) => {
        const phase = eventPhase(event, now)
        const [px, py] = projection.project(event.point)
        const key = `${Math.round(px)}:${Math.round(py)}`
        const stacked = seen.get(key) ?? 0
        seen.set(key, stacked + 1)
        // Beside the place's own pin, and beside each other.
        const x = px + 16 * scale + stacked * 20 * scale
        const y = py - 14 * scale
        const isSelected = selected === event.id
        const width = textWidth(event.title, fontSize)
        const rect = {
          x: x + R * scale + 3,
          y: y - fontSize / 2 - 3,
          width: width + 6,
          height: fontSize + 6,
        }
        placer.claim({
          x: x - R * scale,
          y: y - R * scale,
          width: R * scale * 2,
          height: R * scale * 2,
        })
        const showLabel = named && (isSelected || placer.tryClaim(rect))
        return (
          <g
            key={event.id}
            className={interactive ? 'az-hit' : undefined}
            onClick={onSelect ? () => onSelect(event) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            {!showLabel ? <title>{event.title}</title> : null}
            <EventMark
              phase={phase}
              scale={isSelected ? scale * 1.2 : scale}
              selected={isSelected}
              x={x}
              y={y}
            />
            {showLabel ? (
              <text
                className="font-body"
                dy={fontSize * 0.36}
                fill={GROUND.coralDeep}
                fontSize={fontSize}
                fontWeight={600}
                x={x + R * scale + 5}
                y={y}
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
