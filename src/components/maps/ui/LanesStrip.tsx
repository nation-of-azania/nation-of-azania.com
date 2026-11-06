'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { lanesWidth, partLabel, placedParts, reachOf, type LanePart, type RoadLanes } from '@/maps/lanes'
import { GROUND, LANE_PAINT, ROAD_STYLES } from '@/maps/palette'
import type { RoadKind } from '@/maps/registry'

import { stripSpan } from './lanesScale'

/**
 * A road's cross-section drawn to scale, seen from above with the road
 * running up the page the way it was drawn: its parts side by side, left
 * to right, each as wide as it is, in the colours the map draws them in
 * (src/maps/palette.ts → LANE_PAINT); an arrow in each lane the way its
 * traffic runs (up: with the road); the lines dashed or solid; a kerb
 * between the road and a verge or a pavement; and the drawn line itself,
 * in the editor's saffron, down the middle of the carriageway.
 *
 * The strip is laid out about that line, which stays at the middle of the
 * frame: the frame reaches as far each side as the road does on its further
 * side (lanesScale.ts → stripSpan), so a part widened grows the road
 * outward both ways and the line holds still, and a pavement on one side
 * leaves the other side bare ground. On the road's page it's a picture; in
 * the editor (editor/LanesEditor.tsx) each part is pressed to pick it, and
 * dragged along the strip to move it: the others make room as it goes, the
 * slot it will land in marked, and it's put there on the drop (from the
 * keyboard, shift and an arrow key). While it's dragged the road's left
 * edge holds still, whatever the drawn line will be the middle of once it
 * lands, so nothing shifts under the pointer.
 */

/** A part narrower on the page than this takes a hit area this wide, so a line a block wide is still found by a finger. */
const LEAST_HIT = 22
/** Room above a live strip for the mark over the drawn line. */
const HEAD = 7
/** A press that moves less than this, in px, is a press, not a drag. */
const SLOP = 5

const paintOf = (part: LanePart, kind: RoadKind) =>
  part.kind === 'lane' ? ROAD_STYLES[kind].fill : part.kind === 'walk' ? LANE_PAINT.walk : part.kind === 'line' ? ROAD_STYLES[kind].casing ?? GROUND.inkSoft : LANE_PAINT[part.surface]

const onRoad = (p: LanePart) => p.kind === 'lane' || p.kind === 'line'

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

/** A part being dragged: which, how far the pointer has taken it (px), and the place it would land in. */
type Drag = { index: number; dx: number; to: number }

/**
 * Where each part sits while the one at `index` is dragged, in blocks from
 * the drawn line, by index: the dragged one taken out, the rest closed up
 * from the left edge, and a gap as wide as it is opened at `to` (its place
 * among the rest) for it to land in; the dragged part's own entry is that
 * gap.
 */
function roomFor(lanes: RoadLanes, index: number, to: number): number[] {
  const from: number[] = []
  let at = -lanes.axis
  let place = 0
  lanes.parts.forEach((part, i) => {
    if (i === index) return
    if (place === to) {
      from[index] = at
      at += lanes.parts[index].width
    }
    from[i] = at
    at += part.width
    place++
  })
  if (place === to) from[index] = at
  return from
}

/**
 * The place a dragged part lands in, its middle at `centre` blocks from the
 * drawn line: from `to`, on past the next part once its middle is passed,
 * or back past the one before. A part passed slides aside by the dragged
 * part's width, so each is held until the pointer has come well over it.
 */
function landing(lanes: RoadLanes, index: number, centre: number, to: number): number {
  const rest = lanes.parts.map((_, i) => i).filter((i) => i !== index)
  for (let guard = 0; guard <= rest.length; guard++) {
    const from = roomFor(lanes, index, to)
    const after = rest[to]
    const before = rest[to - 1]
    if (after != null && centre > from[after] + lanes.parts[after].width / 2) {
      to++
      continue
    }
    if (before != null && centre < from[before] + lanes.parts[before].width / 2) {
      to--
      continue
    }
    break
  }
  return to
}

export function LanesStrip({
  lanes,
  kind,
  ppb,
  height = 56,
  frame = 0,
  selected = null,
  onSelect,
  onMove,
  className,
}: {
  lanes: RoadLanes
  kind: RoadKind
  /** Px per block (stripScale). */
  ppb: number
  /** The road's run shown, in px. */
  height?: number
  /**
   * The frame at least this wide, in px, the road centred in it: strips in
   * a list given the same frame share one centreline, and the editor's
   * holds still as the road grows.
   */
  frame?: number
  /** The part picked in the editor, by index. */
  selected?: number | null
  /** A press on a part: the editor picks it. */
  onSelect?: (index: number) => void
  /** A part dragged to a new place (0 the left edge), or moved there from the keyboard: the editor moves it (lanes.ts → withPartMoved). */
  onMove?: (from: number, to: number) => void
  className?: string
}) {
  const placed = placedParts(lanes)
  const { left, right } = reachOf(lanes)
  const width = Math.max(stripSpan(lanes) * ppb, frame)
  const half = width / 2
  // The drawn line is the origin: a part's offset in blocks, right of it positive, is its place.
  const x = (offset: number) => offset * ppb
  const live = Boolean(onSelect)
  const top = live ? HEAD : 0
  const casing = ROAD_STYLES[kind].casing ?? GROUND.inkSoft
  const dash = Math.max(3, Math.min(height / 5, 3 * ppb))
  const n = lanes.parts.length

  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const press = useRef<{ index: number; startX: number; pointer: number; dragging: boolean } | null>(null)
  const hits = useRef<(SVGRectElement | null)[]>([])
  // After a move from the keyboard the part's hit area is a new element: focus follows it.
  const refocus = useRef<number | null>(null)
  useEffect(() => {
    if (refocus.current == null) return
    hits.current[refocus.current]?.focus()
    refocus.current = null
  })

  // Where each part is shown, in blocks from the drawn line: as laid, or making room while one is dragged.
  const shown = drag ? roomFor(lanes, drag.index, drag.to) : placed.map((p) => p.from)
  const dragged = drag ? placed[drag.index] : null
  // A part dragged follows the pointer, held within the road: where its left edge is, in blocks from the drawn line.
  const held = (part: LanePart, from: number, dx: number) => Math.max(-left, Math.min(lanesWidth(lanes) - left - part.width, from + dx / ppb))
  const floating = drag && dragged ? held(dragged.part, dragged.from, drag.dx) : 0

  const down = (event: PointerEvent<SVGRectElement>, index: number) => {
    if (event.button !== 0 || !onSelect) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { index, startX: event.clientX, pointer: event.pointerId, dragging: false }
  }
  const move = (event: PointerEvent<SVGRectElement>) => {
    const p = press.current
    if (!p || event.pointerId !== p.pointer) return
    const dx = event.clientX - p.startX
    if (!p.dragging) {
      if (!onMove || Math.abs(dx) < SLOP) return
      p.dragging = true
    }
    const { part, from } = placed[p.index]
    const to = landing(lanes, p.index, held(part, from, dx) + part.width / 2, dragRef.current?.to ?? p.index)
    dragRef.current = { index: p.index, dx, to }
    setDrag(dragRef.current)
  }
  const up = (event: PointerEvent<SVGRectElement>) => {
    const p = press.current
    if (!p || event.pointerId !== p.pointer) return
    press.current = null
    if (!p.dragging) {
      onSelect?.(p.index)
      return
    }
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (d && d.to !== d.index) onMove?.(d.index, d.to)
    else onSelect?.(p.index)
  }
  const cancel = (event: PointerEvent<SVGRectElement>) => {
    if (press.current?.pointer !== event.pointerId) return
    press.current = null
    dragRef.current = null
    setDrag(null)
  }
  const keys = (event: KeyboardEvent<SVGRectElement>, index: number) => {
    const key = event.key
    if (key === 'Enter' || key === ' ') {
      onSelect?.(index)
    } else if ((key === 'ArrowLeft' || key === 'ArrowRight') && event.shiftKey && onMove) {
      const to = key === 'ArrowLeft' ? index - 1 : index + 1
      if (to < 0 || to >= n) return
      refocus.current = to
      onMove(index, to)
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      hits.current[key === 'ArrowLeft' ? index - 1 : index + 1]?.focus()
    } else return
    event.preventDefault()
  }

  /** A part drawn where it lies: its colour, and a lane's arrow. */
  const draw = (part: LanePart, index: number, from: number): ReactNode => {
    const px = x(from)
    const w = part.width * ppb
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
    return (
      <g key={index}>
        <rect fill={paintOf(part, kind)} height={height} width={w} x={px} y={0} />
        {part.kind === 'lane' ? <Arrow colour={casing} dir={part.dir} size={Math.min(height * 0.5, Math.max(8, w * 0.55))} x={px + w / 2} y={height / 2} /> : null}
      </g>
    )
  }

  // The parts in the order shown: the dragged one in the gap it will land in, for the kerbs.
  const order = [...placed].sort((a, b) => shown[a.index] - shown[b.index])

  return (
    <svg
      aria-hidden={live ? undefined : true}
      className={cn('block shrink-0 select-none', drag && 'cursor-grabbing', className)}
      height={height + top}
      role={live ? 'group' : undefined}
      // A finger on a part drags it, not the page: set on the svg itself, where the browser reads it (not on the parts' hit areas).
      style={{ touchAction: onMove ? 'none' : undefined }}
      viewBox={`${-half} ${-top} ${width} ${height + top}`}
      width={width}
    >
      {/* The ground across the frame: bare where the road doesn't reach. */}
      <rect fill="currentColor" fillOpacity={0.06} height={height} width={width} x={-half} y={0} />
      {/* The parts, each as wide as it is; the others sliding aside as one is dragged. */}
      {placed.map(({ part, index, from }) =>
        drag?.index === index ? null : (
          <g key={index} style={{ transform: `translateX(${x(shown[index] - from)}px)`, transition: drag ? 'transform 120ms ease-out' : undefined }}>
            {draw(part, index, from)}
          </g>
        ),
      )}
      {/* A kerb wherever the road meets a verge or a pavement, and the ends of the road. */}
      {order.map(({ part, index }, place) => {
        const before = order[place - 1]?.part
        if (!before || (onRoad(before) && onRoad(part))) return null
        return <line key={`kerb-${index}`} stroke={casing} strokeOpacity={0.55} strokeWidth={1} x1={x(shown[index])} x2={x(shown[index])} y1={0} y2={height} />
      })}
      <line stroke={casing} strokeWidth={1.5} x1={x(-left) + 0.75} x2={x(-left) + 0.75} y1={0} y2={height} />
      <line stroke={casing} strokeWidth={1.5} x1={x(right) - 0.75} x2={x(right) - 0.75} y1={0} y2={height} />
      {/* The drawn line, down the middle, as the editor draws it on the map. */}
      <line
        stroke={GROUND.saffron}
        strokeDasharray={live ? '4 3' : '2 2'}
        strokeOpacity={live ? 0.95 : 0.8}
        strokeWidth={live ? 1.5 : 1}
        x1={0}
        x2={0}
        y1={0}
        y2={height}
      />
      {/* The mark over it, in the editor: where the road was drawn, and so where it grows from. */}
      {live ? <path d={`M-5 ${-HEAD}h10L0 -1z`} fill={GROUND.saffron} pointerEvents="none" /> : null}
      {/* The part picked. */}
      {!drag && selected != null && placed[selected] ? (
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
      {/* Pressed to pick, dragged to move: the wide parts first, so a narrow one's wider hit area lies over them. */}
      {onSelect
        ? [...placed]
            .sort((a, b) => b.part.width - a.part.width)
            .map(({ part, index, from, to }) => {
              const w = (to - from) * ppb
              const hit = Math.max(w, LEAST_HIT)
              return (
                <rect
                  aria-label={`${partLabel(lanes, index)}, ${part.width} block${part.width === 1 ? '' : 's'}, ${index + 1} of ${n}`}
                  aria-pressed={selected === index}
                  className={cn('focus-visible:outline-saffron-500', onMove ? 'cursor-grab' : 'cursor-pointer')}
                  fill="transparent"
                  height={height}
                  key={`hit-${index}`}
                  onKeyDown={(event) => keys(event, index)}
                  onPointerCancel={cancel}
                  onPointerDown={(event) => down(event, index)}
                  onPointerMove={move}
                  onPointerUp={up}
                  ref={(el) => {
                    hits.current[index] = el
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
      {/* The part dragged: the slot it will land in marked, and the part itself afloat under the pointer. */}
      {drag && dragged ? (
        <g pointerEvents="none">
          <rect
            fill={GROUND.saffron}
            fillOpacity={0.12}
            height={height - 2}
            stroke={GROUND.saffron}
            strokeDasharray="3 2"
            strokeWidth={1.5}
            width={Math.max(2, dragged.part.width * ppb - 2)}
            x={x(shown[drag.index]) + 1}
            y={1}
          />
          <g style={{ filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35))', transform: `translateX(${x(floating - dragged.from)}px)` }}>
            {draw(dragged.part, drag.index, dragged.from)}
            <rect
              fill="none"
              height={height - 2}
              stroke={GROUND.saffron}
              strokeWidth={2}
              width={Math.max(2, dragged.part.width * ppb - 2)}
              x={x(dragged.from) + 1}
              y={1}
            />
          </g>
        </g>
      ) : null}
    </svg>
  )
}
