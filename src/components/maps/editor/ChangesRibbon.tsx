'use client'

import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

import { OVER_MAX, withChangeMoved, type RoadLanes } from '@/maps/lanes'
import { GROUND } from '@/maps/palette'

/**
 * The road unrolled, start to end, with each change along its lanes
 * marked where it begins and how far it runs (src/maps/lanes.ts →
 * changes): the ribbon over the lanes strip in the road editor
 * (./LanesEditor.tsx). The start is a dot at the left; each change a band
 * with a tick at each end, the one whose cross-section the strip shows in
 * the editor's saffron. Pressed, a band's cross-section is the strip's;
 * dragged, the change slides along the road; its far tick dragged, the
 * change runs longer or shorter. From the keyboard, the arrows do the
 * same, ten blocks at a time with shift. The map draws the same marks
 * across the road (./Tools.tsx), where they can be dragged too.
 */

/** Each gesture on the ribbon is numbered, so the shell undoes a drag as one step; counted apart from the map's presses. */
let gestures = 1_000_000

const HEIGHT = 30
const PAD = 10
/** A band's end tick takes this much of the band for its own grip, in px, at most half the band. */
const GRIP = 12

type Drag = { k: number; mode: 'move' | 'end'; startX: number; at: number; over: number; gesture: number }

export function ChangesRibbon({
  lanes,
  length,
  width,
  section,
  onSection,
  onChange,
}: {
  lanes: RoadLanes
  /** The road's length along its course, in blocks. */
  length: number
  /** The room the ribbon has, in px. */
  width: number
  /** The cross-section the strip shows: 0 the start, k the k-th change (lanes.ts → profileOf). */
  section: number
  onSection: (k: number) => void
  onChange: (lanes: RoadLanes, gesture?: number) => void
}) {
  const drag = useRef<Drag | null>(null)
  const changes = lanes.changes ?? []
  const scale = (width - 2 * PAD) / Math.max(1, length)
  const x = (s: number) => PAD + Math.max(0, Math.min(length, s)) * scale
  const mid = HEIGHT / 2

  const down = (event: PointerEvent<SVGElement>, k: number, mode: Drag['mode']) => {
    const change = changes[k - 1]
    if (!change || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { k, mode, startX: event.clientX, at: change.at, over: change.over, gesture: ++gestures }
    onSection(k)
  }
  const move = (event: PointerEvent<SVGElement>) => {
    const d = drag.current
    if (!d) return
    const blocks = (event.clientX - d.startX) / scale
    if (d.mode === 'move') onChange(withChangeMoved(lanes, d.k, d.at + blocks, d.over), d.gesture)
    else onChange(withChangeMoved(lanes, d.k, d.at, Math.min(OVER_MAX, d.over + blocks)), d.gesture)
  }
  const up = () => {
    drag.current = null
  }
  const keys = (event: KeyboardEvent<SVGElement>, k: number) => {
    const change = changes[k - 1]
    if (!change) return
    const step = event.shiftKey ? 10 : 1
    switch (event.key) {
      case 'ArrowLeft':
        onChange(withChangeMoved(lanes, k, change.at - step, change.over))
        break
      case 'ArrowRight':
        onChange(withChangeMoved(lanes, k, change.at + step, change.over))
        break
      case 'ArrowUp':
        onChange(withChangeMoved(lanes, k, change.at, change.over + step))
        break
      case 'ArrowDown':
        onChange(withChangeMoved(lanes, k, change.at, change.over - step))
        break
      case 'Enter':
      case ' ':
        onSection(k)
        break
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <svg
      aria-label="Where the lanes change along the road"
      className="block select-none"
      height={HEIGHT}
      role="group"
      style={{ touchAction: 'none' }}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      width={width}
    >
      {/* The road, start to end. */}
      <line stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} x1={PAD} x2={width - PAD} y1={mid} y2={mid} />
      <line stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} x1={width - PAD} x2={width - PAD} y1={mid - 5} y2={mid + 5} />
      {/* The start's cross-section. */}
      <g
        aria-label="The lanes at the start"
        aria-pressed={section === 0}
        className="cursor-pointer focus-visible:outline-saffron-500"
        data-change={0}
        onClick={() => onSection(0)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onSection(0)
        }}
        role="button"
        tabIndex={0}
      >
        <circle cx={PAD} cy={mid} fill="transparent" r={13} />
        <circle
          cx={PAD}
          cy={mid}
          fill={section === 0 ? GROUND.saffron : 'currentColor'}
          fillOpacity={section === 0 ? 1 : 0.55}
          r={section === 0 ? 5.5 : 4}
        />
      </g>
      {/* Each change: a band from where it begins to where it's run, the ticks its grips. */}
      {changes.map((change, i) => {
        const k = i + 1
        const picked = section === k
        const x0 = x(change.at)
        const x1 = Math.max(x0 + 3, x(change.at + change.over))
        const grip = Math.min(GRIP, (x1 - x0) / 2)
        const colour = picked ? GROUND.saffron : 'currentColor'
        return (
          <g key={k}>
            <rect fill={colour} fillOpacity={picked ? 0.28 : 0.14} height={14} width={x1 - x0} x={x0} y={mid - 7} />
            <line stroke={colour} strokeOpacity={picked ? 1 : 0.65} strokeWidth={picked ? 2.5 : 2} x1={x0} x2={x0} y1={mid - 10} y2={mid + 10} />
            <line stroke={colour} strokeOpacity={picked ? 1 : 0.65} strokeWidth={1.5} x1={x1} x2={x1} y1={mid - 7} y2={mid + 7} />
            {/* The band and its start tick slide the change; the far tick sets how far it runs. */}
            <rect
              aria-label={`Change ${k}: from ${change.at} blocks, over ${change.over}`}
              aria-pressed={picked}
              className="cursor-grab focus-visible:outline-saffron-500 active:cursor-grabbing"
              data-change={k}
              fill="transparent"
              height={HEIGHT}
              onKeyDown={(event) => keys(event, k)}
              onPointerCancel={up}
              onPointerDown={(event) => down(event, k, 'move')}
              onPointerMove={move}
              onPointerUp={up}
              role="button"
              tabIndex={0}
              width={x1 - grip - (x0 - GRIP)}
              x={x0 - GRIP}
              y={0}
            />
            <rect
              aria-hidden="true"
              className="cursor-ew-resize"
              fill="transparent"
              height={HEIGHT}
              onPointerCancel={up}
              onPointerDown={(event) => down(event, k, 'end')}
              onPointerMove={move}
              onPointerUp={up}
              width={grip + GRIP}
              x={x1 - grip}
              y={0}
            />
          </g>
        )
      })}
    </svg>
  )
}
