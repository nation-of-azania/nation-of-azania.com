'use client'

import { cn } from '@/blocks/components/shared'
import { partLabel, placedParts, reachOf, type LanePart, type RoadLanes } from '@/maps/lanes'
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
 * the editor (editor/LanesEditor.tsx) each part is pressed to pick it.
 */

/** A part narrower on the page than this takes a hit area this wide, so a line a block wide is still found by a finger. */
const LEAST_HIT = 22
/** Room above a live strip for the mark over the drawn line. */
const HEAD = 7

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
  frame = 0,
  selected = null,
  onSelect,
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

  return (
    <svg
      aria-hidden={live ? undefined : true}
      className={cn('block shrink-0 select-none', className)}
      height={height + top}
      role={live ? 'group' : undefined}
      viewBox={`${-half} ${-top} ${width} ${height + top}`}
      width={width}
    >
      {/* The ground across the frame: bare where the road doesn't reach. */}
      <rect fill="currentColor" fillOpacity={0.06} height={height} width={width} x={-half} y={0} />
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
      <line stroke={casing} strokeWidth={1.5} x1={x(-left) + 0.75} x2={x(-left) + 0.75} y1={0} y2={height} />
      <line stroke={casing} strokeWidth={1.5} x1={x(right) - 0.75} x2={x(right) - 0.75} y1={0} y2={height} />
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
    </svg>
  )
}
