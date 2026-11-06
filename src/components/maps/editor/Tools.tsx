'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { cn } from '@/blocks/components/shared'
import { curvePath } from '@/maps/curves'
import { roadPoints, type MapData, type MapRights } from '@/maps/data'
import { roundPoint, samplePath, type Point } from '@/maps/geo'
import {
  acrossCourse,
  distanceAlong,
  HAS_LANES,
  laneEndsOf,
  lanePathsOf,
  lanesAt,
  reachOf,
  withChangeMoved,
  type LaneEnd,
  type LanedRoad,
  type RoadLanes,
} from '@/maps/lanes'
import { GROUND, INK_COLOURS } from '@/maps/palette'
import { ROAD_KINDS, type Drawing } from '@/maps/registry'
import { clampToWorld } from '@/maps/source'

import type { EditorUpdate } from '../context'
import { useLatest } from '../hooks'
import { DrawingsLayer } from '../layers/DrawingsLayer'
import { EventMark } from '../layers/EventsLayer'
import { PlacePin } from '../layers/PlacesLayer'
import { pathOf, upright, type Projection } from '../layers/projection'
import { RoadsLayer } from '../layers/RoadsLayer'
import { L, toPoint, useLeaflet } from '../leaflet/canvas'
import type { Editor, RoadDraft } from '../state'
import { insertPoint, midpoints, movePoint, nearestOnPath, removePoint } from './points'
import { withinRights } from './rights'
import {
  betweenPoints,
  meetingsOf,
  nearestOnRoad,
  otherRoads,
  snappedPoint,
  withChoice,
  withCornerToggled,
  withoutPointAt,
  withPointAt,
  type Meeting,
} from './road'

type Props = {
  data: MapData
  rights: MapRights
  editor: Editor
  onEditor: (update: EditorUpdate, press?: number) => void
  projection: Projection
}

/** Points a highlight may have before its handles thin out and the "+" marks are left off. */
const HANDLED_POINTS = 40

/**
 * Each press of the pointer, from down to release, is numbered. The changes
 * a drag makes carry its number, and the shell undoes them as one step.
 */
let presses = 0

type PressHandlers = {
  /** The press lands: a tap, or the start of a drag. */
  onDown?: (at: Point, press: number) => void
  onMove?: (at: Point, press: number) => void
  /** The release: whether the pointer travelled (a drag) or stayed put (a click or tap). */
  onUp?: (event: PointerEvent, moved: boolean, press: number) => void
}

/**
 * Pointer handling for something drawn on the overlay: the map holds still
 * while it's pressed, the element keeps the pointer till release, and the
 * map's own click never follows. Native listeners, since the element must
 * stop Leaflet's drag before it starts. A finger's wobble isn't a drag.
 */
function usePress<T extends SVGElement>(ref: RefObject<T | null>, handlers: PressHandlers) {
  const { map } = useLeaflet()
  const latest = useLatest(handlers)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    L.DomEvent.disableClickPropagation(element as unknown as HTMLElement)
    // A drag past the world's edge stops at the edge: nothing is ever drawn in an echo of the world.
    const at = (event: PointerEvent) => roundPoint(clampToWorld(toPoint(map.mouseEventToLatLng(event))))
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      event.stopPropagation()
      event.preventDefault()
      const press = ++presses
      const startX = event.clientX
      const startY = event.clientY
      let moved = false
      const wasDragging = map.dragging.enabled()
      map.dragging.disable()
      element.setPointerCapture(event.pointerId)
      latest.current.onDown?.(at(event), press)
      const onMove = (move: PointerEvent) => {
        if (!moved && Math.hypot(move.clientX - startX, move.clientY - startY) < 3) return
        moved = true
        latest.current.onMove?.(at(move), press)
      }
      const onUp = (up: PointerEvent) => {
        element.removeEventListener('pointermove', onMove)
        element.removeEventListener('pointerup', onUp)
        element.removeEventListener('pointercancel', onUp)
        if (wasDragging) map.dragging.enable()
        latest.current.onUp?.(up, moved, press)
      }
      element.addEventListener('pointermove', onMove)
      element.addEventListener('pointerup', onUp)
      element.addEventListener('pointercancel', onUp)
    }
    element.addEventListener('pointerdown', onPointerDown)
    return () => element.removeEventListener('pointerdown', onPointerDown)
  }, [map, ref, latest])
}

/**
 * A handle on a point: dragged to move it, clicked to pick it (the chip
 * beside it then offers more), clicked twice or right-clicked to remove
 * it. Square, it marks a sharp corner of a curved road. As a "+", it sits
 * halfway along a line and offers a new point: pressed, the point is put
 * in at once and follows the drag.
 */
function Handle({
  point,
  projection,
  colour = GROUND.saffron,
  picked,
  square,
  plus,
  title,
  onDown,
  onDrag,
  onPick,
  onRemove,
}: {
  point: Point
  projection: Projection
  colour?: string
  picked?: boolean
  square?: boolean
  plus?: boolean
  title?: string
  onDown?: (press: number) => void
  onDrag: (point: Point, press: number) => void
  /** A click or tap without a drag; `again` when it's the second within a moment. */
  onPick?: (event: PointerEvent, again: boolean) => void
  /** A right click. */
  onRemove?: () => void
}) {
  const ref = useRef<SVGGElement>(null)
  const lastPick = useRef(0)
  const remove = useLatest(onRemove)
  usePress(ref, {
    onDown: (_, press) => onDown?.(press),
    onMove: onDrag,
    onUp: (event, moved) => {
      if (moved) return
      const now = performance.now()
      const again = now - lastPick.current < 400
      lastPick.current = again ? 0 : now
      onPick?.(event, again)
    },
  })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const onContext = (event: Event) => {
      if (!remove.current) return
      event.preventDefault()
      event.stopPropagation()
      remove.current()
    }
    element.addEventListener('contextmenu', onContext)
    return () => element.removeEventListener('contextmenu', onContext)
  }, [remove])

  const [x, y] = projection.project(point)
  const r = plus ? 5 : 6
  const paint = {
    fill: picked ? colour : GROUND.whitewash,
    stroke: picked ? GROUND.whitewash : colour,
    strokeWidth: 2,
  }
  return (
    <g
      className={cn('az-handle', plus && 'az-handle-plus', picked && 'az-handle-picked')}
      ref={ref}
    >
      {title ? <title>{title}</title> : null}
      <g {...upright(x, y)}>
        {/* Room for a finger. */}
        <circle cx={x} cy={y} fill="transparent" r={14} />
        {picked ? (
          <circle cx={x} cy={y} fill="none" r={r + 5} stroke={colour} strokeOpacity={0.4} strokeWidth={2} />
        ) : null}
        <g className="az-handle-mark">
          {square ? (
            <rect height={r * 2} width={r * 2} x={x - r} y={y - r} {...paint} />
          ) : (
            <circle cx={x} cy={y} r={r} {...paint} />
          )}
          {plus ? (
            <path
              d={`M${x - 2.5} ${y}h5M${x} ${y - 2.5}v5`}
              fill="none"
              stroke={colour}
              strokeLinecap="round"
              strokeWidth={1.5}
            />
          ) : null}
        </g>
      </g>
    </g>
  )
}

/**
 * The line itself, pressed to add a point right there: on a curved road,
 * on the bend. With a mouse, a ghost "+" rides along the line under the
 * pointer first, so it's plain what a press will do; pressed, the point
 * is put in at once, picked, and follows the drag.
 */
function Course({
  projection,
  path,
  closed,
  colour,
  locate,
  onInsert,
  onMove,
}: {
  projection: Projection
  path: Point[]
  closed?: boolean
  colour: string
  /** The spot on the line nearest a point, and the place a point there takes. */
  locate: (at: Point) => { point: Point; index: number } | null
  onInsert: (point: Point, index: number, press: number) => void
  onMove: (index: number, point: Point, press: number) => void
}) {
  const { map } = useLeaflet()
  const ref = useRef<SVGPathElement>(null)
  const inserted = useRef<number | null>(null)
  const pressing = useRef(false)
  const [ghost, setGhost] = useState<Point | null>(null)
  usePress(ref, {
    onDown: (at, press) => {
      pressing.current = true
      setGhost(null)
      const found = locate(at)
      inserted.current = found?.index ?? null
      if (found) onInsert(roundPoint(found.point), found.index, press)
    },
    onMove: (at, press) => {
      if (inserted.current != null) onMove(inserted.current, at, press)
    },
    onUp: () => {
      pressing.current = false
    },
  })
  const hover = (event: React.PointerEvent) => {
    if (pressing.current || event.pointerType !== 'mouse') return
    const found = locate(toPoint(map.mouseEventToLatLng(event.nativeEvent)))
    setGhost(found?.point ?? null)
  }
  const g = ghost ? projection.project(ghost) : null
  return (
    <>
      <path
        className="az-course"
        d={pathOf(projection, path, closed)}
        fill="none"
        onPointerLeave={() => setGhost(null)}
        onPointerMove={hover}
        ref={ref}
        stroke="transparent"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={18}
      >
        <title>Press on the line to add a point there</title>
      </path>
      {g ? (
        <g className="az-ghost" pointerEvents="none" {...upright(g[0], g[1])}>
          <circle cx={g[0]} cy={g[1]} fill={GROUND.whitewash} fillOpacity={0.9} r={6} stroke={colour} strokeDasharray="2 2" strokeWidth={1.5} />
          <path d={`M${g[0] - 2.5} ${g[1]}h5M${g[0]} ${g[1] - 2.5}v5`} fill="none" stroke={colour} strokeLinecap="round" strokeWidth={1.5} />
        </g>
      ) : null}
    </>
  )
}

/** What the tools do to a line, whoever owns it; each change names the press it belongs to. */
type LineOps = {
  move: (index: number, point: Point, press: number) => void
  /** Puts a point in at `index` and picks it. */
  insert: (index: number, point: Point, press: number) => void
  remove: (index: number) => void
  /** A click on a point: picks it, or whatever the keys held ask for. */
  pick: (index: number, event: PointerEvent) => void
}

/**
 * The grammar every line shares, drawn over it: a handle on each point to
 * drag, a "+" halfway between each pair, the line itself pressed to add a
 * point exactly there, and the picked point ringed. A road passes its
 * course so the "+" and the ghost sit on the bends.
 */
function LineHandles({
  projection,
  points,
  course = points,
  closed = false,
  colour,
  picked,
  squares,
  canRemove,
  /** Whether the line is settled enough to add to: not while it's still being drawn. */
  editable,
  locate,
  between,
  ops,
  pointTitle,
}: {
  projection: Projection
  points: Point[]
  course?: Point[]
  closed?: boolean
  colour: string
  picked: number | null
  /** Points drawn square: a curved road's sharp corners. */
  squares?: number[]
  canRemove: boolean
  editable: boolean
  locate?: (at: Point) => { point: Point; index: number } | null
  /** Where the "+" marks sit; halfway along each pair unless told otherwise. */
  between?: Point[]
  ops: LineOps
  pointTitle?: string
}) {
  const many = points.length > HANDLED_POINTS
  // A freehand stroke with hundreds of points gets a handle at each end and every few along.
  const step = many ? Math.max(1, Math.floor(points.length / 12)) : 1
  const find =
    locate ??
    ((at: Point) => {
      const found = nearestOnPath(course, at, closed)
      return found ? { point: found.point, index: found.segment + 1 } : null
    })
  const title =
    pointTitle ??
    `Drag to move. Click for more${canRemove ? '; click twice to remove' : ''}.`
  return (
    <>
      {editable && points.length >= 2 ? (
        <Course
          closed={closed}
          colour={colour}
          locate={find}
          onInsert={(point, index, press) => ops.insert(index, point, press)}
          onMove={ops.move}
          path={course}
          projection={projection}
        />
      ) : null}
      {editable && !many
        ? (between ?? midpoints(points, closed)).map((point, i) => (
            <Handle
              colour={colour}
              key={`plus-${i}`}
              onDown={(press) => ops.insert(i + 1, roundPoint(point), press)}
              onDrag={(next, press) => ops.move(i + 1, next, press)}
              plus
              point={point}
              projection={projection}
              title="Add a point here: click, or drag it into place"
            />
          ))
        : null}
      {points.map((point, index) =>
        index % step === 0 || index === points.length - 1 ? (
          <Handle
            colour={colour}
            key={index}
            onDrag={(next, press) => ops.move(index, next, press)}
            onPick={(event, again) => {
              if (again && canRemove) ops.remove(index)
              else ops.pick(index, event)
            }}
            onRemove={canRemove ? () => ops.remove(index) : undefined}
            picked={picked === index}
            point={point}
            projection={projection}
            square={squares?.includes(index)}
            title={title}
          />
        ) : null,
      )}
    </>
  )
}

/** The crossing marks' size on the page: the disc, the roads' lines through it, the hop of the one passing over, the gap under it. */
const MARK = { disc: 11, reach: 9, hop: 4, gap: 4, node: 3.4 }

/** A road's line through the mark, along the x axis before its turn: full across, or from the centre out where the road ends here. */
const across = (ends: boolean) => (ends ? `M0 0H${MARK.reach}` : `M${-MARK.reach} 0H${MARK.reach}`)
/** The road passing over: it hops the other. */
const hop = `M${-MARK.reach} 0H${-MARK.hop}A${MARK.hop} ${MARK.hop} 0 0 1 ${MARK.hop} 0H${MARK.reach}`
/** The road passing under: a gap where the other crosses it. */
const under = `M${-MARK.reach} 0H${-MARK.gap}M${MARK.gap} 0H${MARK.reach}`
/** A road ending at the other without joining it: stopping short. */
const short = `M${MARK.gap} 0H${MARK.reach}`

/**
 * The two roads' lines through a crossing, as its mark draws them: the
 * other road in ink, the drawn road in its colour, turned the way each
 * runs there. Joined, they meet at a node; apart, the one passing over
 * hops the other, as a wire does in a circuit diagram.
 */
function CrossingGlyph({ meeting, colour, node }: { meeting: Meeting; colour: string; node: boolean }) {
  const { joined, over, ends, otherEnds, heading, otherHeading } = meeting
  const mine = joined ? across(ends) : over === true ? hop : over === false ? under : across(ends)
  const theirs = joined ? across(otherEnds) : over === true ? across(false) : over === false ? hop : otherEnds ? short : across(false)
  const line = { fill: 'none', strokeLinecap: 'round' as const, strokeWidth: 2.5 }
  return (
    <>
      <circle fill={GROUND.whitewash} fillOpacity={0.96} r={MARK.disc} stroke={colour} strokeWidth={1.5} />
      <path d={theirs} stroke={GROUND.inkSoft} transform={`rotate(${otherHeading.toFixed(1)})`} {...line} />
      <path d={mine} stroke={colour} transform={`rotate(${heading.toFixed(1)})`} {...line} />
      {joined && node ? <circle fill={colour} r={MARK.node} stroke={GROUND.whitewash} strokeWidth={1} /> : null}
    </>
  )
}

/** What a crossing's mark says of itself, for a mouse resting on it. */
function describe(meeting: Meeting): string {
  const { other, joined, over } = meeting
  const name = other.name ?? `an unnamed ${ROAD_KINDS[other.kind].label.toLowerCase()}`
  if (joined) return `Junction with ${name}. Click for a bridge instead.`
  const passes = over === true ? 'Passes over' : over === false ? 'Passes under' : 'Meets'
  return `${passes} ${name} without joining. Click for a junction.`
}

/**
 * A crossing with another road, marked where it is: a node the two will
 * share, or a bridge. Clicked or tapped, it's the other. Where the drawn
 * road has a point there already the crossing is a junction as long as the
 * point stays, so the mark is drawn under the point's handle and takes no
 * press of its own.
 */
function CrossingMark({
  meeting,
  projection,
  colour,
  onToggle,
}: {
  meeting: Meeting
  projection: Projection
  colour: string
  onToggle?: (joined: boolean) => void
}) {
  const ref = useRef<SVGGElement>(null)
  usePress(ref, {
    onUp: (_, moved) => {
      if (!moved) onToggle?.(!meeting.joined)
    },
  })
  const [x, y] = projection.project(meeting.crossing.at)
  if (!onToggle) {
    return (
      <g className="az-crossing az-crossing-fixed" pointerEvents="none" {...upright(x, y)}>
        <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
          <CrossingGlyph colour={colour} meeting={meeting} node={false} />
        </g>
      </g>
    )
  }
  return (
    <g
      aria-pressed={meeting.joined}
      className={cn('az-crossing', meeting.joined ? 'az-crossing-joined' : 'az-crossing-apart')}
      ref={ref}
      role="button"
      {...upright(x, y)}
    >
      <title>{describe(meeting)}</title>
      <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
        {/* Room for a finger. */}
        <circle fill="transparent" r={16} />
        <g className="az-crossing-mark">
          <CrossingGlyph colour={colour} meeting={meeting} node />
        </g>
      </g>
    </g>
  )
}

/*
 * A road's end on another road's lane (src/maps/lanes.ts → laneEndsOf): a
 * slip road leaving the outer lane, a turn into the far one. It's a lane
 * end because the end lies on the lane, so there's nothing to toggle: the
 * mark only says so, under the end's handle as a junction's does. The
 * lane runs through the disc as a soft band, the ending road from the
 * centre out; the drawn road's part in the editor's colour, the other's
 * in ink, whichever ends on which.
 */

/** The width of the lane's band through the mark, in px. */
const LANE_BAND = 6

/** Which way a line runs where it passes nearest `at`, in degrees on the page. */
function headingNear(line: Point[], at: Point): number {
  const found = nearestOnPath(line, at)
  if (!found || line.length < 2) return 0
  const [a, b] = [line[found.segment], line[found.segment + 1] ?? line[found.segment]]
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
}

/** The way out of a course from one of its ends: along its first piece, or back along its last. */
function headingOut(course: Point[], end: 'start' | 'end'): number {
  if (course.length < 2) return 0
  const [a, b] = end === 'start' ? [course[0], course[1]] : [course[course.length - 1], course[course.length - 2]]
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
}

function LaneEndMark({
  laneEnd,
  road,
  onto,
  mine,
  projection,
  colour,
}: {
  laneEnd: LaneEnd<number>
  /** The road ending here, and the one whose lane it ends on: either may be the draft. */
  road: LanedRoad<number>
  onto: LanedRoad<number>
  /** Whether the draft is the road ending here (true) or the one whose lane it ends on (false). */
  mine: boolean
  projection: Projection
  colour: string
}) {
  const [x, y] = projection.project(laneEnd.at)
  const lane = lanePathsOf(onto).paths.find((path) => path.track === laneEnd.track && path.from - 1e-9 <= laneEnd.s && laneEnd.s <= path.to + 1e-9)
  const laneHeading = headingNear(lane?.middle ?? lanePathsOf(onto).course, laneEnd.at)
  const roadHeading = headingOut(lanePathsOf(road).course, laneEnd.end)
  return (
    <g className="az-crossing az-crossing-fixed az-lane-end" pointerEvents="none" {...upright(x, y)}>
      <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
        <circle fill={GROUND.whitewash} fillOpacity={0.96} r={MARK.disc} stroke={colour} strokeWidth={1.5} />
        <path
          d={across(false)}
          fill="none"
          stroke={mine ? GROUND.inkSoft : colour}
          strokeOpacity={mine ? 0.3 : 0.45}
          strokeWidth={LANE_BAND}
          transform={`rotate(${laneHeading.toFixed(1)})`}
        />
        <path
          d={across(true)}
          fill="none"
          stroke={mine ? colour : GROUND.inkSoft}
          strokeLinecap="round"
          strokeWidth={2.5}
          transform={`rotate(${roadHeading.toFixed(1)})`}
        />
      </g>
    </g>
  )
}

/** A road not saved yet, among the others, for the lane ends: no saved road has this id. */
const DRAFT_ID = -1

/**
 * The draft as a road among the others (its lanes only for a kind that has
 * any), with its ends on other roads' lanes and other roads' ends on its
 * lanes; worked out again only as the draft or the roads change, and the
 * one object kept, so the lanes laid along it are too (lanePathsOf).
 */
function useLaneEnds(editor: Editor, data: MapData): { draftRoad: LanedRoad<number> | null; laneEnds: LaneEnd<number>[] } {
  const road = editor.kind === 'road' ? editor : null
  const draft = road?.draft ?? null
  const id = road?.id ?? DRAFT_ID
  const { roads } = data
  return useMemo(() => {
    if (!draft || draft.line.length < 2) return { draftRoad: null, laneEnds: [] }
    const draftRoad = { ...draft, lanes: HAS_LANES.has(draft.kind) ? draft.lanes : null, id }
    return { draftRoad, laneEnds: laneEndsOf([draftRoad, ...otherRoads(roads, id)]).filter((end) => end.road === id || end.onto === id) }
  }, [draft, id, roads])
}

/*
 * Where a road's lanes change along it (src/maps/lanes.ts → changes): a
 * bar across the road where each change begins and a dashed one where
 * it's run, the picked change's in the editor's colour. Pressed, a bar
 * picks its change, so the panel's strip shows that cross-section; dragged
 * along the road, the first bar slides the change and the second sets how
 * far it runs. The same marks as the panel's ribbon (./ChangesRibbon.tsx).
 */

/** The bar reaches this far past the road's edges each side, in blocks. */
const BAR_PAST = 1.5

function ChangeBar({
  ends,
  projection,
  colour,
  picked,
  dashed,
  title,
  onDrag,
  onPick,
}: {
  ends: [Point, Point]
  projection: Projection
  colour: string
  picked: boolean
  dashed?: boolean
  title: string
  onDrag: (at: Point, press: number) => void
  onPick: () => void
}) {
  const ref = useRef<SVGGElement>(null)
  usePress(ref, {
    onDown: () => onPick(),
    onMove: onDrag,
  })
  const [ax, ay] = projection.project(ends[0])
  const [bx, by] = projection.project(ends[1])
  const d = `M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`
  const ink = picked ? colour : GROUND.inkSoft
  return (
    <g className="az-handle az-change" ref={ref}>
      <title>{title}</title>
      {/* Room for a finger. */}
      <path d={d} fill="none" stroke="transparent" strokeLinecap="round" strokeWidth={18} />
      <path d={d} fill="none" stroke={GROUND.whitewash} strokeLinecap="round" strokeOpacity={0.85} strokeWidth={picked ? 6 : 5} />
      <path
        d={d}
        fill="none"
        stroke={ink}
        strokeDasharray={dashed ? '4 3' : undefined}
        strokeLinecap="round"
        strokeOpacity={picked ? 1 : 0.8}
        strokeWidth={picked ? 2.5 : 2}
      />
    </g>
  )
}

function ChangeMarks({
  lanes,
  course,
  section,
  projection,
  colour,
  onLanes,
  onPick,
}: {
  lanes: RoadLanes
  course: Point[]
  section: number
  projection: Projection
  colour: string
  onLanes: (lanes: RoadLanes, press: number) => void
  onPick: (k: number) => void
}) {
  const changes = lanes.changes ?? []
  if (!changes.length || course.length < 2) return null
  // Across the road as wide as it is at the spot, and a little past its edges.
  const across = (s: number) => {
    const { left, right } = reachOf(lanesAt(lanes, s))
    return acrossCourse(course, s, left + BAR_PAST, right + BAR_PAST)
  }
  return (
    <>
      {changes.map((change, i) => {
        const k = i + 1
        const begins = across(change.at)
        const runs = across(change.at + change.over)
        const picked = section === k
        return (
          <g key={k}>
            {begins ? (
              <ChangeBar
                colour={colour}
                ends={begins}
                onDrag={(at, press) => onLanes(withChangeMoved(lanes, k, distanceAlong(course, at), change.over), press)}
                onPick={() => onPick(k)}
                picked={picked}
                projection={projection}
                title={`The lanes change from here, over ${change.over} blocks. Drag along the road to move it; press to shape the lanes from here on.`}
              />
            ) : null}
            {runs ? (
              <ChangeBar
                colour={colour}
                dashed
                ends={runs}
                onDrag={(at, press) => onLanes(withChangeMoved(lanes, k, change.at, distanceAlong(course, at) - change.at), press)}
                onPick={() => onPick(k)}
                picked={picked}
                projection={projection}
                title="The change has run its course here. Drag along the road to set how far it runs."
              />
            ) : null}
          </g>
        )
      })}
    </>
  )
}

/** Where the road being drawn meets the others, worked out again only as the draft or the roads change. */
function useMeetings(editor: Editor, data: MapData): Meeting[] {
  const road = editor.kind === 'road' ? editor : null
  const draft = road?.draft ?? null
  const id = road?.id ?? null
  const choices = road?.junctions ?? null
  const { roads } = data
  return useMemo(
    () => (draft && choices ? meetingsOf(draft, id, otherRoads(roads, id), choices) : []),
    [draft, id, choices, roads],
  )
}

/** Douglas–Peucker: fewer points along a freehand stroke, within a tolerance in blocks. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points
  const [ax, az] = points[0]
  const [bx, bz] = points[points.length - 1]
  let farthest = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const [px, pz] = points[i]
    const length = Math.hypot(bx - ax, bz - az)
    const distance =
      length === 0
        ? Math.hypot(px - ax, pz - az)
        : Math.abs((bx - ax) * (az - pz) - (ax - px) * (bz - az)) / length
    if (distance > farthest) {
      farthest = distance
      index = i
    }
  }
  if (farthest <= tolerance) return [points[0], points[points.length - 1]]
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ]
}

/** A line or an area needs this many points to stand. */
const least = (kind: 'line' | 'area') => (kind === 'line' ? 2 : 3)

/**
 * The editor's marks on the map: the draft being drawn, with the line
 * grammar over its points (LineHandles), and the pen for a map view's
 * freehand strokes. Keys: Enter finishes a line, Backspace takes the last
 * point back while drawing, Delete removes what's picked, Escape steps
 * out; the shell holds undo and redo.
 */
export function Tools({ data, rights, editor, onEditor, projection }: Props) {
  const { map } = useLeaflet()
  const editorRef = useLatest(editor)
  const [stroke, setStroke] = useState<Point[] | null>(null)
  const penning = editor.kind === 'view' && editor.tool === 'pen'
  const meetings = useMeetings(editor, data)
  const { draftRoad, laneEnds } = useLaneEnds(editor, data)

  // The pen: a press on the map starts a stroke, a release keeps it.
  useEffect(() => {
    if (!penning) return
    const container = map.getContainer()
    let points: Point[] | null = null
    const at = (event: PointerEvent) =>
      roundPoint(clampToWorld(toPoint(map.mouseEventToLatLng(event as unknown as MouseEvent))))
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      event.preventDefault()
      container.setPointerCapture(event.pointerId)
      points = [at(event)]
      setStroke(points)
    }
    const onMove = (event: PointerEvent) => {
      if (!points) return
      points = [...points, at(event)]
      setStroke(points)
    }
    const onUp = () => {
      if (!points) return
      const current = editorRef.current
      // A block at this zoom is one pixel-ish; keep the stroke's shape, drop its jitter.
      const tolerance = Math.max(0.5, 1.5 / projection.ppb)
      const simplified = simplify(points, tolerance)
      points = null
      setStroke(null)
      if (current.kind === 'view' && simplified.length >= 2) {
        onEditor({
          ...current,
          selected: current.draft.drawings.length,
          vertex: null,
          draft: {
            ...current.draft,
            drawings: [
              ...current.draft.drawings,
              {
                kind: 'line',
                points: simplified,
                ink: current.ink,
                weight: current.weight,
                arrow: current.arrow,
                curve: current.curve,
              },
            ],
          },
        })
      }
    }
    container.addEventListener('pointerdown', onDown)
    container.addEventListener('pointermove', onMove)
    container.addEventListener('pointerup', onUp)
    container.addEventListener('pointercancel', onUp)
    return () => {
      container.removeEventListener('pointerdown', onDown)
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerup', onUp)
      container.removeEventListener('pointercancel', onUp)
    }
  }, [map, penning, projection.ppb, onEditor, editorRef])

  // Keys, anywhere but in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.metaKey || event.ctrlKey) return
      const current = editorRef.current
      const removing = event.key === 'Delete' || event.key === 'Backspace'
      switch (current.kind) {
        case 'road': {
          const { draft, vertex } = current
          if (event.key === 'Enter' && current.drawing) onEditor({ ...current, drawing: false })
          else if (event.key === 'Backspace' && current.drawing && draft.line.length)
            onEditor({ ...current, draft: withoutPointAt(draft, draft.line.length - 1) })
          else if (removing && vertex != null && draft.line.length > 2)
            onEditor({ ...current, vertex: null, draft: withoutPointAt(draft, vertex) })
          else if (event.key === 'Escape')
            onEditor(
              current.drawing
                ? { ...current, drawing: false }
                : vertex != null
                  ? { ...current, vertex: null }
                  : null,
            )
          else return
          break
        }
        case 'place': {
          const { draft, vertex } = current
          if (event.key === 'Enter' && current.tracing) onEditor({ ...current, tracing: false })
          else if (event.key === 'Backspace' && current.tracing && draft.outline.length)
            onEditor({ ...current, draft: { ...draft, outline: draft.outline.slice(0, -1) } })
          else if (removing && vertex != null && draft.outline.length > 3)
            onEditor({
              ...current,
              vertex: null,
              draft: { ...draft, outline: removePoint(draft.outline, vertex) },
            })
          else if (event.key === 'Escape')
            onEditor(
              current.tracing || current.placing
                ? { ...current, tracing: false, placing: false }
                : vertex != null
                  ? { ...current, vertex: null }
                  : null,
            )
          else return
          break
        }
        case 'event': {
          if (event.key === 'Escape')
            onEditor(current.picking ? { ...current, picking: false } : null)
          else return
          break
        }
        case 'view': {
          const { draft, selected, vertex } = current
          const chosen = selected != null ? draft.drawings[selected] : null
          if (event.key === 'Enter' && current.pending.length) {
            const enough =
              current.tool === 'line' ? current.pending.length >= 2 : current.pending.length >= 3
            if (!enough) return
            const drawing =
              current.tool === 'line'
                ? {
                    kind: 'line' as const,
                    points: current.pending,
                    ink: current.ink,
                    weight: current.weight,
                    arrow: current.arrow,
                    curve: current.curve,
                  }
                : { kind: 'area' as const, points: current.pending, ink: current.ink }
            onEditor({
              ...current,
              pending: [],
              selected: draft.drawings.length,
              vertex: null,
              draft: { ...draft, drawings: [...draft.drawings, drawing] },
            })
          } else if (event.key === 'Backspace' && current.pending.length)
            onEditor({ ...current, pending: current.pending.slice(0, -1) })
          else if (
            removing &&
            vertex != null &&
            chosen &&
            (chosen.kind === 'line' || chosen.kind === 'area') &&
            chosen.points.length > least(chosen.kind)
          )
            onEditor({
              ...current,
              vertex: null,
              draft: {
                ...draft,
                drawings: draft.drawings.map((d, i) =>
                  i === selected ? { ...chosen, points: removePoint(chosen.points, vertex) } : d,
                ),
              },
            })
          else if (removing && selected != null)
            onEditor({
              ...current,
              selected: null,
              vertex: null,
              draft: { ...draft, drawings: draft.drawings.filter((_, i) => i !== selected) },
            })
          else if (event.key === 'Escape')
            onEditor(
              current.pending.length
                ? { ...current, pending: [] }
                : vertex != null
                  ? { ...current, vertex: null }
                  : selected != null
                    ? { ...current, selected: null }
                    : { ...current, tool: 'select' },
            )
          else return
          break
        }
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEditor, editorRef])

  switch (editor.kind) {
    case 'place': {
      const { draft } = editor
      const ok = withinRights(
        [...(draft.point ? [draft.point] : []), ...draft.outline],
        data,
        rights,
      )
      const colour = ok ? GROUND.saffron : GROUND.coral
      const settled = !editor.tracing && !editor.placing && draft.outline.length >= 3
      // Changes to the outline, each as a function of the editor as it stands.
      const outline = (
        change: (outline: Point[]) => Point[],
        rest: Partial<Extract<Editor, { kind: 'place' }>> = {},
        press?: number,
      ) =>
        onEditor(
          (current) =>
            current?.kind === 'place'
              ? { ...current, ...rest, draft: { ...current.draft, outline: change(current.draft.outline) } }
              : current,
          press,
        )
      const ops: LineOps = {
        move: (index, point, press) => outline((points) => movePoint(points, index, point), {}, press),
        insert: (index, point, press) =>
          outline((points) => insertPoint(points, index, point), { vertex: index }, press),
        remove: (index) => outline((points) => removePoint(points, index), { vertex: null }),
        pick: (index) => {
          // While tracing, the first point clicked again closes the ring.
          if (index === 0 && editor.tracing && draft.outline.length >= 3)
            onEditor({ ...editor, tracing: false })
          else onEditor({ ...editor, vertex: editor.vertex === index ? null : index })
        },
      }
      return (
        <g className="az-tools">
          {draft.outline.length > 0 ? (
            <path
              d={pathOf(projection, draft.outline, !editor.tracing)}
              fill={colour}
              fillOpacity={0.15}
              stroke={colour}
              strokeDasharray={editor.tracing ? '5 4' : undefined}
              strokeLinejoin="round"
              strokeWidth={2}
            />
          ) : null}
          <LineHandles
            canRemove={draft.outline.length > 3}
            closed={settled}
            colour={colour}
            editable={settled}
            ops={ops}
            picked={editor.vertex}
            points={draft.outline}
            pointTitle={
              editor.tracing
                ? 'Drag to move. Click the first point to close the outline.'
                : undefined
            }
            projection={projection}
          />
          {draft.point ? (
            <>
              <g {...upright(...projection.project(draft.point))}>
                <PlacePin
                  place={{ category: draft.category }}
                  selected
                  x={projection.project(draft.point)[0]}
                  y={projection.project(draft.point)[1]}
                />
              </g>
              <Handle
                colour={colour}
                onDrag={(next, press) =>
                  onEditor(
                    (current) =>
                      current?.kind === 'place'
                        ? { ...current, draft: { ...current.draft, point: next } }
                        : current,
                    press,
                  )
                }
                point={draft.point}
                projection={projection}
                title="Drag to move the pin"
              />
            </>
          ) : null}
        </g>
      )
    }
    case 'road': {
      const { draft } = editor
      // Judged along the course, as the server does: a bend can't swing outside the claims.
      const ok = withinRights(samplePath(roadPoints(draft)), data, rights)
      const colour = ok ? GROUND.saffron : GROUND.coral
      const curved = draft.shape === 'curved'
      const road = (
        change: (draft: RoadDraft) => RoadDraft,
        rest: Partial<Extract<Editor, { kind: 'road' }>> = {},
        press?: number,
      ) =>
        onEditor(
          (current) =>
            current?.kind === 'road' ? { ...current, ...rest, draft: change(current.draft) } : current,
          press,
        )
      // A point placed or dragged onto another road is set on it, as the server will set it.
      const others = otherRoads(data.roads, editor.id)
      const snap = (point: Point) => snappedPoint(point, editor.id, others)
      const ops: LineOps = {
        move: (index, point, press) =>
          road((d) => ({ ...d, line: movePoint(d.line, index, snap(point)) }), {}, press),
        insert: (index, point, press) => road((d) => withPointAt(d, index, snap(point)), { vertex: index }, press),
        remove: (index) => road((d) => withoutPointAt(d, index), { vertex: null }),
        pick: (index, event) =>
          // Alt-click makes a point a sharp corner of a curved road, and back.
          curved && event.altKey
            ? onEditor({ ...editor, vertex: index, draft: withCornerToggled(draft, index) })
            : onEditor({ ...editor, vertex: editor.vertex === index ? null : index }),
      }
      const toggle = (meeting: Meeting) => (joined: boolean) =>
        onEditor((current) =>
          current?.kind === 'road' ? { ...current, junctions: withChoice(current.junctions, meeting, meetings, joined) } : current,
        )
      // A "+" under a crossing's mark would be unreachable: it's left out there.
      const open = meetings.filter((meeting) => !meeting.fixed)
      const between = betweenPoints(draft).filter((point) =>
        open.every((meeting) => Math.hypot(point[0] - meeting.crossing.at[0], point[1] - meeting.crossing.at[1]) * projection.ppb > 2 * MARK.disc),
      )
      return (
        <g className="az-tools">
          {draft.line.length >= 2 ? (
            <RoadsLayer
              projection={projection}
              roads={[{ id: -1, ...draft, name: draft.name || null, town: null, lanes: HAS_LANES.has(draft.kind) ? draft.lanes : null }]}
            />
          ) : null}
          {/* Junctions the road has already, at its own points: under the handles, which are their nodes. */}
          {meetings.map((meeting) =>
            meeting.fixed ? <CrossingMark colour={colour} key={meeting.key} meeting={meeting} projection={projection} /> : null,
          )}
          {/* Its ends on other roads' lanes, and theirs on its own: under the handles too. */}
          {draftRoad
            ? laneEnds.map((end) => {
                const mine = end.road === draftRoad.id
                const other = others.find((road) => road.id === (mine ? end.onto : end.road))
                if (!other) return null
                return (
                  <LaneEndMark
                    colour={colour}
                    key={`${end.road}-${end.end}-${end.onto}`}
                    laneEnd={end}
                    mine={mine}
                    onto={mine ? other : draftRoad}
                    projection={projection}
                    road={mine ? draftRoad : other}
                  />
                )
              })
            : null}
          {/* Where the lanes change along the road: bars across it, under the handles. */}
          {draft.lanes?.changes && draft.line.length >= 2 && HAS_LANES.has(draft.kind) ? (
            <ChangeMarks
              colour={colour}
              course={roadPoints(draft)}
              lanes={draft.lanes}
              onLanes={(lanes, press) => road((d) => ({ ...d, lanes }), {}, press)}
              onPick={(section) => onEditor((current) => (current?.kind === 'road' ? { ...current, section } : current))}
              projection={projection}
              section={editor.section ?? 0}
            />
          ) : null}
          {/* The points joined up: the road itself when straight, the thread the curve follows when curved. */}
          {draft.line.length >= 1 ? (
            <path
              d={pathOf(projection, draft.line)}
              fill="none"
              stroke={colour}
              strokeDasharray="4 4"
              strokeOpacity={curved ? 0.5 : 0.9}
              strokeWidth={1.5}
            />
          ) : null}
          <LineHandles
            between={between}
            canRemove={draft.line.length > 2}
            colour={colour}
            course={roadPoints(draft)}
            editable={!editor.drawing}
            locate={(at) => nearestOnRoad(draft, at)}
            ops={ops}
            picked={editor.vertex}
            points={draft.line}
            pointTitle={
              curved
                ? 'Drag to move. Click for more; alt-click for a sharp corner.'
                : undefined
            }
            projection={projection}
            squares={curved ? draft.corners : undefined}
          />
          {/* The crossings to decide: over the line, so a press lands on the mark and not on the course under it. */}
          {open.map((meeting) => (
            <CrossingMark colour={colour} key={meeting.key} meeting={meeting} onToggle={toggle(meeting)} projection={projection} />
          ))}
        </g>
      )
    }
    case 'event': {
      const { draft } = editor
      const place =
        draft.place != null ? data.places.find((candidate) => candidate.id === draft.place) : null
      const point = place?.point ?? draft.point
      if (!point) return null
      const ok = withinRights([point], data, rights)
      const [x, y] = projection.project(point)
      return (
        <g className="az-tools">
          <g {...upright(x, y)}>
            <EventMark phase="upcoming" selected x={x + 16} y={y - 14} />
          </g>
          {!place ? (
            <Handle
              colour={ok ? GROUND.saffron : GROUND.coral}
              onDrag={(next, press) =>
                onEditor(
                  (current) =>
                    current?.kind === 'event'
                      ? { ...current, draft: { ...current.draft, point: next } }
                      : current,
                  press,
                )
              }
              point={point}
              projection={projection}
              title="Drag to move"
            />
          ) : null}
        </g>
      )
    }
    case 'view': {
      const ink = INK_COLOURS[editor.ink]
      return (
        <g className="az-tools">
          <DrawingsLayer
            drawings={editor.draft.drawings}
            onSelect={
              editor.tool === 'select'
                ? (index) => onEditor({ ...editor, selected: index, vertex: null })
                : undefined
            }
            projection={projection}
            selected={editor.selected}
          />
          {editor.pending.length > 0 ? (
            <>
              <path
                d={
                  editor.tool === 'line' && editor.curve
                    ? curvePath(editor.pending.map((point) => projection.project(point)))
                    : pathOf(projection, editor.pending, editor.tool === 'area')
                }
                fill={editor.tool === 'area' ? ink.fill : 'none'}
                fillOpacity={0.15}
                stroke={ink.fill}
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeWidth={2.5}
              />
              {editor.pending.map((point, index) => (
                <Handle
                  colour={ink.fill}
                  key={index}
                  onDrag={(next, press) =>
                    onEditor(
                      (current) =>
                        current?.kind === 'view'
                          ? { ...current, pending: movePoint(current.pending, index, next) }
                          : current,
                      press,
                    )
                  }
                  point={point}
                  projection={projection}
                  title="Drag to move"
                />
              ))}
            </>
          ) : null}
          {stroke && stroke.length > 1 ? (
            <path
              d={pathOf(projection, stroke)}
              fill="none"
              stroke={ink.fill}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={4}
            />
          ) : null}
          {editor.selected != null && editor.tool === 'select' ? (
            <SelectedHandles editor={editor} onEditor={onEditor} projection={projection} />
          ) : null}
        </g>
      )
    }
    default:
      return null
  }
}

/** Handles on the picked highlight: the line grammar over a line or an area, a single handle under a pin or a note. */
function SelectedHandles({
  editor,
  onEditor,
  projection,
}: {
  editor: Extract<Editor, { kind: 'view' }>
  onEditor: (update: EditorUpdate, press?: number) => void
  projection: Projection
}) {
  const index = editor.selected!
  const drawing = editor.draft.drawings[index]
  if (!drawing) return null
  const ink = INK_COLOURS[drawing.ink].fill
  // The picked drawing changed, as a function of the editor as it stands.
  const change = (
    update: (current: typeof drawing) => typeof drawing,
    rest: Partial<Extract<Editor, { kind: 'view' }>> = {},
    press?: number,
  ) =>
    onEditor(
      (current) =>
        current?.kind === 'view'
          ? {
              ...current,
              ...rest,
              draft: {
                ...current.draft,
                drawings: current.draft.drawings.map((d, i) =>
                  i === index ? update(d as typeof drawing) : d,
                ),
              },
            }
          : current,
      press,
    )
  if (drawing.kind === 'pin' || drawing.kind === 'text') {
    return (
      <Handle
        colour={ink}
        onDrag={(at, press) => change((d) => ({ ...d, at }), {}, press)}
        point={drawing.at}
        projection={projection}
        title="Drag to move"
      />
    )
  }
  const points =
    (update: (points: Point[]) => Point[]) =>
    (d: Drawing): Drawing =>
      d.kind === 'line' || d.kind === 'area' ? { ...d, points: update(d.points) } : d
  const ops: LineOps = {
    move: (i, point, press) => change(points((p) => movePoint(p, i, point)), {}, press),
    insert: (i, point, press) => change(points((p) => insertPoint(p, i, point)), { vertex: i }, press),
    remove: (i) => change(points((p) => removePoint(p, i)), { vertex: null }),
    pick: (i) => onEditor({ ...editor, vertex: editor.vertex === i ? null : i }),
  }
  return (
    <LineHandles
      canRemove={drawing.points.length > least(drawing.kind)}
      closed={drawing.kind === 'area'}
      colour={ink}
      editable
      ops={ops}
      picked={editor.vertex}
      points={drawing.points}
      projection={projection}
    />
  )
}
