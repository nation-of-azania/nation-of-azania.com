'use client'

import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

import { cn } from '@/blocks/components/shared'
import { lanesWidth, partLabel, placedParts, type LanePart, type RoadLanes } from '@/maps/lanes'
import { GROUND, LANE_PAINT, ROAD_STYLES } from '@/maps/palette'
import type { RoadKind } from '@/maps/registry'

/**
 * A road's cross-section drawn to scale, seen from above with the road
 * running up the page the way it was drawn: its parts side by side, left
 * to right, each as wide as it is, in the colours the map draws them in
 * (src/maps/palette.ts → LANE_PAINT); an arrow in each lane the way its
 * traffic runs (up: with the road); the lines dashed or solid; a kerb
 * between the road and a verge or a pavement; and the drawn line itself,
 * in the editor's saffron, where it lies across them. On the road's page
 * it's a picture; in the editor (editor/LanesEditor.tsx) each part is
 * pressed to pick it and the drawn line is dragged across the road.
 */

/** A part narrower on the page than this takes a hit area this wide, so a line a block wide is still found by a finger. */
const LEAST_HIT = 22
/** Room above the strip for the drawn line's handle: the handle's hit area, big enough for a finger, lies there and a little way into the strip, so the part under the line can still be pressed. */
const HEAD = 18
const HANDLE_REACH = 6

const paintOf = (part: LanePart, kind: RoadKind) =>
  part.kind === 'lane' ? ROAD_STYLES[kind].fill : part.kind === 'walk' ? LANE_PAINT.walk : part.kind === 'line' ? ROAD_STYLES[kind].casing ?? GROUND.inkSoft : LANE_PAINT[part.surface]

/** A lane's arrow: a chevron up (with the road), down (against), or both ways (shared). */
function Arrow({ x, y, size, dir, colour }: { x: number; y: number; size: number; dir: 'with' | 'against' | 'both'; colour: string }) {
  const h = size / 2
  const w = size * 0.42
  const stem = size * 0.9
  const up = `M${x - w} ${y - h + w}L${x} ${y - h}L${x + w} ${y - h + w}`
  const down = `M${x - w} ${y + h - w}L${x} ${y + h}L${x + w} ${y + h - w}`
  return (
    <path
      d={dir === 'with' ? `${up}M${x} ${y - h}v${stem}` : dir === 'against' ? `${down}M${x} ${y + h}v${-stem}` : `${up}${down}M${x} ${y - h}v${size}`}
      fill="none"
      stroke={colour}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity={0.8}
      strokeWidth={Math.max(1, size / 7)}
    />
  )
}

export function LanesStrip({
  lanes,
  kind,
  ppb,
  height = 56,
  selected = null,
  onSelect,
  onAxis,
  className,
}: {
  lanes: RoadLanes
  kind: RoadKind
  /** Px per block (stripScale). */
  ppb: number
  /** The road's run shown, in px. */
  height?: number
  /** The part picked in the editor, by index. */
  selected?: number | null
  /** A press on a part: the editor picks it. */
  onSelect?: (index: number) => void
  /** The drawn line dragged across the road: the editor sets where it lies, in blocks from the left edge. */
  onAxis?: (axis: number) => void
  className?: string
}) {
  const svg = useRef<SVGSVGElement>(null)
  const placed = placedParts(lanes)
  const total = lanesWidth(lanes)
  const width = total * ppb
  const left = lanes.axis * ppb
  const x = (offset: number) => (offset + lanes.axis) * ppb
  const live = Boolean(onSelect || onAxis)
  const top = live ? HEAD : 0
  const casing = ROAD_STYLES[kind].casing ?? GROUND.inkSoft
  const dash = Math.max(3, Math.min(height / 5, 3 * ppb))
  const axisX = left

  // The handle dragged along the strip: the line lands on the half block under the pointer.
  const drag = (event: PointerEvent<SVGElement>) => {
    if (!onAxis || !svg.current) return
    const element = event.currentTarget
    element.setPointerCapture(event.pointerId)
    const at = (e: { clientX: number }) => {
      const box = svg.current!.getBoundingClientRect()
      onAxis(Math.round(((e.clientX - box.left) / ppb) * 2) / 2)
    }
    at(event)
    const move = (e: globalThis.PointerEvent) => at(e)
    const stop = () => {
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', stop)
      element.removeEventListener('pointercancel', stop)
    }
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', stop)
    element.addEventListener('pointercancel', stop)
  }
  const key = (event: KeyboardEvent<SVGElement>) => {
    if (!onAxis) return
    const step = event.key === 'ArrowLeft' ? -0.5 : event.key === 'ArrowRight' ? 0.5 : event.key === 'Home' ? -total : event.key === 'End' ? total : 0
    if (!step) return
    event.preventDefault()
    onAxis(lanes.axis + step)
  }

  return (
    <svg
      aria-hidden={live ? undefined : true}
      className={cn('block shrink-0 touch-none select-none', className)}
      height={height + top}
      ref={svg}
      role={live ? 'group' : undefined}
      style={{ touchAction: live ? 'none' : undefined }}
      viewBox={`0 ${-top} ${width} ${height + top}`}
      width={width}
    >
      {/* The parts, each as wide as it is. */}
      {placed.map(({ part, index, from, to }) => {
        const px = x(from)
        const w = (to - from) * ppb
        if (part.kind === 'line') {
          // A line is drawn as one: a block of white, or a hairline where it's painted on.
          return (
            <line
              key={index}
              stroke={paintOf(part, kind)}
              strokeDasharray={part.style === 'dashed' ? `${dash} ${dash}` : undefined}
              strokeWidth={Math.max(1.5, w)}
              x1={px + w / 2}
              x2={px + w / 2}
              y1={0}
              y2={height}
            />
          )
        }
        return <rect fill={paintOf(part, kind)} height={height} key={index} width={w} x={px} y={0} />
      })}
      {/* A kerb wherever the road meets a verge or a pavement, and the ends of the road. */}
      {placed.map(({ part, index, from }) => {
        const before = lanes.parts[index - 1]
        if (!before) return null
        const road = (p: LanePart) => p.kind === 'lane' || p.kind === 'line'
        if (road(before) && road(part)) return null
        return <line key={`kerb-${index}`} stroke={casing} strokeOpacity={0.55} strokeWidth={1} x1={x(from)} x2={x(from)} y1={0} y2={height} />
      })}
      <line stroke={casing} strokeWidth={1.5} x1={0.75} x2={0.75} y1={0} y2={height} />
      <line stroke={casing} strokeWidth={1.5} x1={width - 0.75} x2={width - 0.75} y1={0} y2={height} />
      {/* Which way each lane runs. */}
      {placed.map(({ part, index, from, to }) =>
        part.kind === 'lane' ? (
          <Arrow
            colour={casing}
            dir={part.dir}
            key={`arrow-${index}`}
            size={Math.min(height * 0.5, Math.max(8, (to - from) * ppb * 0.55))}
            x={x((from + to) / 2)}
            y={height / 2}
          />
        ) : null,
      )}
      {/* The drawn line where it lies, as the editor draws it on the map. */}
      <line
        stroke={GROUND.saffron}
        strokeDasharray={live ? '4 3' : '2 2'}
        strokeOpacity={live ? 0.95 : 0.8}
        strokeWidth={live ? 1.5 : 1}
        x1={axisX}
        x2={axisX}
        y1={0}
        y2={height}
      />
      {/* The part picked. */}
      {selected != null && placed[selected] ? (
        <rect
          fill="none"
          height={height - 2}
          pointerEvents="none"
          stroke={GROUND.saffron}
          strokeWidth={2}
          width={Math.max(2, placed[selected].part.width * ppb - 2)}
          x={x(placed[selected].from) + 1}
          y={1}
        />
      ) : null}
      {/* Pressed to pick: the wide parts first, so a narrow one's wider hit area lies over them. */}
      {onSelect
        ? [...placed]
            .sort((a, b) => b.part.width - a.part.width)
            .map(({ part, index, from, to }) => {
              const w = (to - from) * ppb
              const hit = Math.max(w, LEAST_HIT)
              return (
                <rect
                  aria-label={`${partLabel(lanes, index)}, ${part.width} block${part.width === 1 ? '' : 's'}`}
                  aria-pressed={selected === index}
                  className="cursor-pointer focus-visible:outline-saffron-500"
                  fill="transparent"
                  height={height}
                  key={`hit-${index}`}
                  onClick={() => onSelect(index)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    onSelect(index)
                  }}
                  role="button"
                  tabIndex={0}
                  width={hit}
                  x={x(from) + w / 2 - hit / 2}
                  y={0}
                />
              )
            })
        : null}
      {/* The handle over the drawn line, dragged across the road. */}
      {onAxis ? (
        <g
          aria-label="Where the drawn line lies"
          aria-valuemax={total}
          aria-valuemin={0}
          aria-valuenow={lanes.axis}
          aria-valuetext={`${lanes.axis} blocks from the left edge`}
          className="cursor-ew-resize focus-visible:outline-saffron-500"
          onKeyDown={key}
          onPointerDown={drag}
          role="slider"
          tabIndex={0}
        >
          <rect fill="transparent" height={HEAD + HANDLE_REACH} width={36} x={axisX - 18} y={-HEAD} />
          <path d={`M${axisX - 6} ${-HEAD + 3}h12l-6 ${HEAD - 5}z`} fill={GROUND.saffron} />
        </g>
      ) : null}
    </svg>
  )
}
