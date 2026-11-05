import { roadPoints, type MapRoad } from '@/maps/data'
import { boundsOf, pathLength, type Point } from '@/maps/geo'
import { overpassesOf } from '@/maps/junctions'
import { laneAreas, marksAlong, type LaneMark, type RoadAreas, type RoadLanes } from '@/maps/lanes'
import { GROUND, LANE_PAINT, ROAD_ORDER, ROAD_STYLES, type RoadStyle } from '@/maps/palette'

import {
  boundsTouch,
  halo,
  inBounds,
  LabelPlacer,
  named,
  pathOf,
  steadyType,
  steadyWidth,
  textWidth,
  type Projection,
} from './projection'

/*
 * With lanes (src/maps/lanes.ts), a road close in is drawn as built: once
 * its carriageway is wider on the page than its class would draw it (and
 * never further out than a block a pixel), every part of its cross-section
 * is an area along its course, lanes in the class's fill, grass and paving
 * and pavements in their own (src/maps/palette.ts → LANE_PAINT), with the
 * lines between the lanes, a kerb where the road meets a verge or a
 * pavement, its two edges as its casing, and chevrons along each lane the
 * way its traffic runs, once a lane is wide enough to carry them. All of
 * it solid inside the same wash, so the build shows through and the drawn
 * lanes lie on the real ones. A divided road a little further out is two
 * carriageways about a strip of green: the twin lines of a dual
 * carriageway. Further out still, the road is drawn by its class as any other.
 */

type Props = {
  projection: Projection
  roads: MapRoad[]
  /** Where the plan put each road's name (./labels.ts); none without it. */
  labels?: Map<number, RoadName>
  selected?: number | null
  onSelect?: (road: MapRoad) => void
  /**
   * The roads, their names, or both (the default). The live map draws the
   * roads with the ground and the names over it, where they keep their size
   * mid-zoom (leaflet/canvas.tsx → OnTop).
   */
  part?: 'roads' | 'names'
}

/** A road's name, placed: how far along the course it sits, as a fraction. */
export type RoadName = { offset: number }

/** The point a fraction of the way along a line, by length. */
function pointAlong(line: Point[], fraction: number): Point {
  const target = pathLength(line) * fraction
  let walked = 0
  for (let i = 1; i < line.length; i++) {
    const step = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
    if (walked + step >= target) {
      const t = step === 0 ? 0 : (target - walked) / step
      return [
        line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
        line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t,
      ]
    }
    walked += step
  }
  return line[line.length - 1]
}

/** Where two roads' courses cross without a node they share: one passes over the other (src/maps/junctions.ts). */
type Overpass = ReturnType<typeof overpassesOf>[number]

/**
 * The bridges among a set of roads, worked out once for the set and kept
 * by it: the layer is drawn again at every settle of the map, and the
 * roads change only when one is saved. A fresh array of the same roads
 * (the scene's, filtered) is told by their ids and stamps.
 */
const overpassesByRoads = new WeakMap<MapRoad[], Overpass[]>()
let lastOverpasses: { signature: string; overpasses: Overpass[] } | null = null
function overpassesAmong(roads: MapRoad[]): Overpass[] {
  const kept = overpassesByRoads.get(roads)
  if (kept) return kept
  const signature = roads.map((road) => `${road.id}:${road.updatedAt ?? ''}:${road.line.length}`).join('|')
  const overpasses = lastOverpasses?.signature === signature ? lastOverpasses.overpasses : roads.length > 1 ? overpassesOf(roads) : []
  lastOverpasses = { signature, overpasses }
  overpassesByRoads.set(roads, overpasses)
  return overpasses
}

/** How much wider than its road a bridge's deck is drawn, in px: its edges, across the road below, are what say "bridge". */
const DECK = 7
/** The deck's edges are shaded a shade darker than the road's casing, so they tell against the road below through the wash. */
const DECK_SHADE = 0.55

/** The piece of a course within `reach` blocks either way of `at`, along it: the deck of a bridge there. */
function pieceAround(course: Point[], at: Point, reach: number): Point[] {
  let best = { segment: 0, point: course[0], distance: Infinity }
  for (let i = 0; i < course.length - 1; i++) {
    const [ax, az] = course[i]
    const [bx, bz] = course[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const length2 = dx * dx + dz * dz
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((at[0] - ax) * dx + (at[1] - az) * dz) / length2))
    const point: Point = [ax + dx * t, az + dz * t]
    const d = Math.hypot(point[0] - at[0], point[1] - at[1])
    if (d < best.distance) best = { segment: i, point, distance: d }
  }
  // Out from the spot as far as `reach` runs, each way, through the course's own points on the way.
  const walk = (indices: number[]): Point[] => {
    const out: Point[] = []
    let left = reach
    let here = best.point
    for (const i of indices) {
      const point = course[i]
      const step = Math.hypot(point[0] - here[0], point[1] - here[1])
      if (step >= left) {
        const t = step === 0 ? 0 : left / step
        out.push([here[0] + (point[0] - here[0]) * t, here[1] + (point[1] - here[1]) * t])
        return out
      }
      out.push(point)
      left -= step
      here = point
    }
    return out
  }
  const back = Array.from({ length: best.segment + 1 }, (_, k) => best.segment - k)
  const forward = Array.from({ length: course.length - best.segment - 1 }, (_, k) => best.segment + 1 + k)
  return [...walk(back).reverse(), best.point, ...walk(forward)]
}

const roadWidth = (road: MapRoad, ppb: number) => {
  const style = ROAD_STYLES[road.kind]
  return Math.min(style.maxPx, Math.max(style.minPx, style.blocks * ppb))
}

/*
 * A road with lanes (src/maps/lanes.ts), drawn at its true width once
 * close enough: its parts laid along its course as areas, worked out once
 * per road in blocks and kept, since the layer is drawn again at every
 * settle and the geometry never changes with the view; only the
 * projection does, per render.
 */

/** A road's lanes laid along its course, with the marks along each lane. */
type Laid = RoadAreas & { marks: { index: number; marks: LaneMark[] }[] }

/** Marks this far apart along a lane, in blocks; every n-th is drawn, as the zoom allows (MARK_GAP). */
const MARK_EVERY = 6
/** Marks never closer than this on the page, in px. */
const MARK_GAP = 48
/** A lane narrower than this on the page carries no marks, in px. */
const MARKED_FROM = 10
/** The zoom in from which a road with lanes shows at its true width (a block a pixel), once that beats its class. */
const TRUE_FROM_PPB = 1

const laidByRoad = new WeakMap<MapRoad, Laid>()
const laidById = new Map<number, { key: string; laid: Laid }>()

/** The road's lanes laid along its course, kept by the road object, and by its id and shape for a fresh copy of the same road. */
function laidOf(road: MapRoad, course: Point[]): Laid | null {
  const { lanes } = road
  if (!lanes) return null
  const kept = laidByRoad.get(road)
  if (kept) return kept
  const key = `${road.shape}|${road.corners.join(',')}|${JSON.stringify(road.line)}|${JSON.stringify(lanes)}`
  const byId = laidById.get(road.id)
  const laid = byId?.key === key ? byId.laid : lay(course, lanes)
  laidByRoad.set(road, laid)
  laidById.set(road.id, { key, laid })
  return laid
}

function lay(course: Point[], lanes: RoadLanes): Laid {
  const areas = laneAreas(course, lanes)
  return {
    ...areas,
    marks: areas.parts.flatMap((p) =>
      p.part.kind === 'lane' && p.part.dir !== 'both' ? [{ index: p.index, marks: marksAlong(p.middle, MARK_EVERY, p.part.dir === 'against') }] : [],
    ),
  }
}

/** Whether a road with lanes is drawn at its true width here: close enough, and its carriageway wider on the page than its class. */
const atTrueWidth = (road: MapRoad, laid: Laid | null, ppb: number): laid is Laid =>
  laid != null && ppb >= TRUE_FROM_PPB && laid.carriageway * ppb >= roadWidth(road, ppb)

/** A road's width on the page, by its class or, drawn at true width, kerb to kerb and beyond. */
const drawnWidth = (road: MapRoad, laid: Laid | null, ppb: number) => (atTrueWidth(road, laid, ppb) ? laid.width * ppb : roadWidth(road, ppb))

/** A line's points on the page, each as "x y", so a boundary shared by two parts is projected once. */
const onPaper = (projection: Projection, line: Point[]): string[] =>
  line.map((point) => {
    const [x, y] = projection.project(point)
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  })
const open = (points: string[]) => (points.length ? `M${points.join('L')}` : '')
/** The ring between two boundaries: the one forward, the other back. */
const ring = (a: string[], b: string[]) => `M${a.join('L')}L${b.slice().reverse().join('L')}Z`

/** A kerb runs between the road and whatever lies beside it: a verge, a pavement; not between a lane and its line. */
const onRoad = (lanes: RoadLanes, index: number) => {
  const kind = lanes.parts[index]?.kind
  return kind === 'lane' || kind === 'line'
}

/** Chevrons along a lane, every n-th mark as the zoom allows, as one path. */
function chevrons(projection: Projection, marks: LaneMark[], nth: number, size: number): string {
  const spread = 0.62
  let d = ''
  for (let i = 0; i < marks.length; i += nth) {
    const { at, heading } = marks[i]
    const [x, y] = projection.project(at)
    const ax = x - size * Math.cos(heading - spread)
    const ay = y - size * Math.sin(heading - spread)
    const bx = x - size * Math.cos(heading + spread)
    const by = y - size * Math.sin(heading + spread)
    d += `M${ax.toFixed(1)} ${ay.toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`
  }
  return d
}

/** A road's two kerbs, open at the ends: its casing, drawn with every other road's before any fill, so roads meeting merge. */
function TrueEdges({ projection, laid, casing, edge }: { projection: Projection; laid: Laid; casing: string; edge: number }) {
  const stroke = { fill: 'none', stroke: casing, strokeLinecap: 'butt' as const, strokeLinejoin: 'round' as const, strokeWidth: edge }
  return (
    <>
      <path d={open(onPaper(projection, laid.edges.left))} {...stroke} />
      <path d={open(onPaper(projection, laid.edges.right))} {...stroke} />
    </>
  )
}

/** A road's areas and lines for this render, from its lanes laid along a course (the whole road, or a bridge's deck). */
function TrueRoad({
  projection,
  areas,
  lanes,
  style,
  marks,
}: {
  projection: Projection
  areas: RoadAreas
  lanes: RoadLanes
  style: RoadStyle
  /** The marks along the lanes; none on a bridge's deck. */
  marks?: Laid['marks']
}) {
  const { ppb } = projection
  const casing = style.casing ?? GROUND.inkSoft
  const boundaries = areas.boundaries.map((line) => onPaper(projection, line))
  const lined = ppb >= 1.5
  const kerbed = ppb >= 2
  const nth = Math.max(1, Math.ceil(MARK_GAP / (MARK_EVERY * ppb)))
  return (
    <>
      {areas.parts.map(({ part, index }) => {
        if (part.kind === 'line') {
          if (!lined || !areas.parts[index].middle.length) return null
          const width = Math.max(1, part.width * ppb)
          const dash = part.style === 'dashed' ? [3 * ppb, 3 * ppb] : undefined
          return (
            <path
              d={open(onPaper(projection, areas.parts[index].middle))}
              fill="none"
              key={index}
              stroke={casing}
              strokeDasharray={dash?.map((n) => n.toFixed(1)).join(' ')}
              strokeWidth={width}
              {...steadyWidth({ min: 1, base: part.width * ppb, max: 1e6 }, dash?.map((n) => n / width))}
            />
          )
        }
        if (!areas.parts[index].ring) return null
        const fill = part.kind === 'lane' ? style.fill : part.kind === 'walk' ? LANE_PAINT.walk : LANE_PAINT[part.surface]
        return <path d={ring(boundaries[index], boundaries[index + 1])} fill={fill} key={index} stroke="none" />
      })}
      {/* The kerbs between the road and its verges and pavements. */}
      {kerbed
        ? boundaries.slice(1, -1).map((line, i) => {
            const index = i + 1
            if (onRoad(lanes, index - 1) && onRoad(lanes, index)) return null
            return <path d={open(line)} fill="none" key={`kerb-${index}`} stroke={casing} strokeOpacity={0.5} strokeWidth={1} />
          })
        : null}
      {/* Which way each lane runs: chevrons along it, once a lane is wide enough on the page to carry them. */}
      {marks?.map(({ index, marks: along }) => {
        const lanePx = areas.parts[index].part.width * ppb
        if (lanePx < MARKED_FROM) return null
        const size = Math.min(9, Math.max(4, lanePx * 0.38))
        return (
          <path
            d={chevrons(projection, along, nth, size)}
            fill="none"
            key={`marks-${index}`}
            stroke={casing}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.75}
            strokeWidth={Math.min(2, Math.max(1.2, size / 5))}
          />
        )
      })}
    </>
  )
}

/**
 * The same width as the live map follows it mid-zoom (./projection.ts →
 * steadyWidth): a road widens and narrows as each zoom it passes through
 * would draw it, its blocks within its floor and ceiling, so it lands on
 * its settled width without a jump. `plus` px are added and the whole is
 * taken `times` over, never under `least`; dashes are so many widths.
 */
const roadSteady = (
  road: MapRoad,
  ppb: number,
  how: { plus?: number; times?: number; least?: number } = {},
  dash?: readonly number[],
) => {
  const style = ROAD_STYLES[road.kind]
  return steadyWidth({ min: style.minPx, base: style.blocks * ppb, max: style.maxPx, ...how }, dash)
}

/** Whether a course reads left to right as drawn; a name along it is set the other way otherwise. */
const forwards = (projection: Projection, course: Point[]) =>
  projection.project(course[course.length - 1])[0] >= projection.project(course[0])[0]

/** Between two values as the zoom runs from `from` to `to`, held outside. */
const ease = (zoom: number, from: number, to: number, a: number, b: number) =>
  a + (b - a) * Math.min(1, Math.max(0, (zoom - from) / (to - from)))

/** The roads on the page, in drawing order: the widest class last, so it lies on top at a crossing. */
function onPage(projection: Projection, roads: MapRoad[]) {
  const courses = new Map(roads.map((road) => [road.id, roadPoints(road)]))
  const visible = roads.filter((road) => {
    const b = boundsOf(courses.get(road.id)!)
    return b && boundsTouch(b, projection.bounds)
  })
  return {
    courses,
    ordered: ROAD_ORDER.flatMap((kind) => visible.filter((road) => road.kind === kind)),
  }
}

const nameSize = (zoom: number) => (zoom >= 1.5 ? 12 : 11)

/** Where along a road its name may sit, best first: the middle, then either side of it. */
const OFFSETS = [0.5, 0.38, 0.62, 0.26, 0.74]

/**
 * Finds each road's name a spot along it, the widest class first, once
 * the road is long enough on the page to carry it; part of the label plan
 * (./labels.ts). Names show from street scale.
 */
export function placeRoadNames(
  projection: Projection,
  roads: MapRoad[],
  placer: LabelPlacer,
): Map<number, RoadName> {
  const placed = new Map<number, RoadName>()
  const { zoom, ppb } = projection
  if (zoom < -0.5) return placed
  const fontSize = nameSize(zoom)
  const { courses, ordered } = onPage(projection, roads)
  for (const road of [...ordered].reverse()) {
    if (!road.name) continue
    const course = courses.get(road.id)!
    const width = textWidth(road.name, fontSize)
    if (ppb * pathLength(course) < width + 40) continue
    for (const offset of OFFSETS) {
      const [x, y] = projection.project(pointAlong(course, offset))
      if (placer.tryClaim({ x: x - width / 2, y: y - fontSize, width, height: fontSize * 2 })) {
        placed.set(road.id, { offset })
        break
      }
    }
  }
  return placed
}

/**
 * Roads the way a road map draws them: every casing first, then every fill,
 * so two roads that meet merge at the junction instead of one crossing the
 * other; the widest class on top. Widths follow the zoom with a floor, so
 * a lane is a hairline from afar and a proper street up close. Casings and
 * fills are drawn solid and then washed over the ground together, as one
 * layer at one opacity: a street reads as a see-through white ribbon with a
 * faint edge, the road as built showing through it, rather than a white
 * strip (fading the fills alone let the grey casing show through them).
 * Thin lines far out keep a little more ink; the casing thins to a faint
 * edge up close, so a street there is a ribbon, not a pill. A curved road follows its
 * course (src/maps/geo.ts → roadCourse). A name runs along the line where
 * the plan found it room.
 */
export function RoadsLayer({ projection, roads, labels, selected, onSelect, part }: Props) {
  const { ppb, zoom, id } = projection
  const interactive = Boolean(onSelect)
  const { courses, ordered } = onPage(projection, roads)
  const paths = new Map(ordered.map((road) => [road.id, pathOf(projection, courses.get(road.id)!)]))
  // The roads with lanes, laid along their courses (kept from one render to the next), where they're drawn at true width.
  const laids = new Map(ordered.map((road) => [road.id, laidOf(road, courses.get(road.id)!)]))
  const trueOf = (road: MapRoad): Laid | null => {
    const laid = laids.get(road.id) ?? null
    return atTrueWidth(road, laid, ppb) ? laid : null
  }
  // A wash at every zoom: a little more ink for hairlines far out, more ground showing up close.
  const wash = zoom <= -1 ? ease(zoom, -4, -1, 0.78, 0.55) : ease(zoom, -1, 2, 0.55, 0.42)
  const edge = ease(zoom, 0, 2, 2, 1.2)
  const fontSize = nameSize(zoom)
  const chosen = selected != null ? ordered.find((road) => road.id === selected) : null
  const chosenTrue = chosen ? trueOf(chosen) : null
  // The bridges on the page, once the roads are wide enough for one to be seen passing over another.
  const byId = new Map(ordered.map((road) => [road.id, road]))
  const bridges =
    part === 'names'
      ? []
      : overpassesAmong(roads).flatMap((bridge) => {
          const over = byId.get(Number(bridge.over))
          const under = byId.get(Number(bridge.under))
          if (!over || !under || !inBounds(projection.bounds, bridge.at)) return []
          const overTrue = trueOf(over)
          const overWidth = drawnWidth(over, laids.get(over.id) ?? null, ppb)
          const underWidth = drawnWidth(under, laids.get(under.id) ?? null, ppb)
          if (underWidth < 3) return []
          // The deck spans the road under it and a little more each way; its fill runs on past the deck's ends, so only
          // the deck's long edges show, as two bars across the road below. A road at true width takes a deck as wide
          // as it is, about its middle, and its lanes drawn again along the deck.
          const course = courses.get(over.id)!
          const reach = (underWidth / 2 + edge + overWidth / 2 + 2) / ppb
          const along = overTrue ? pieceAround(course, bridge.at, reach + (DECK + 2) / ppb) : null
          return [
            {
              over,
              deck: pathOf(projection, pieceAround(overTrue ? overTrue.middle : course, bridge.at, reach)),
              fill: along ? null : pathOf(projection, pieceAround(course, bridge.at, reach + (DECK + 2) / ppb)),
              lanes: along && over.lanes ? laneAreas(along, over.lanes) : null,
              width: overWidth,
              steady: !overTrue,
            },
          ]
        })

  return (
    <g className="az-roads">
      {chosen && part !== 'names' ? (
        chosenTrue ? (
          // A road at true width is ringed, the ring's inner half under its fills.
          <path
            d={pathOf(projection, chosenTrue.outline, true)}
            fill="none"
            stroke={GROUND.saffron}
            strokeLinejoin="round"
            strokeOpacity={0.9}
            strokeWidth={6}
          />
        ) : (
          <path
            d={paths.get(chosen.id)}
            fill="none"
            stroke={GROUND.saffron}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.9}
            strokeWidth={roadWidth(chosen, ppb) + 6}
            {...roadSteady(chosen, ppb, { plus: 6 })}
          />
        )
      ) : null}
      {/* Solid inside, washed as one: roads meeting merge, and nothing shows through a fill but the ground. */}
      {part === 'names' ? null : (
        <g className="az-road-body" opacity={wash}>
          <g className="az-road-casings">
            {ordered.map((road) => {
              const style = ROAD_STYLES[road.kind]
              if (!style.casing) return null
              const laid = trueOf(road)
              if (laid) return <TrueEdges casing={style.casing} edge={edge} key={road.id} laid={laid} projection={projection} />
              return (
                <path
                  key={road.id}
                  d={paths.get(road.id)}
                  fill="none"
                  stroke={style.casing}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={roadWidth(road, ppb) + edge}
                  {...roadSteady(road, ppb, { plus: edge })}
                />
              )
            })}
          </g>
          <g className="az-road-fills">
            {ordered.map((road) => {
              const style = ROAD_STYLES[road.kind]
              const width = roadWidth(road, ppb)
              const laid = trueOf(road)
              if (laid) {
                return (
                  <g
                    key={road.id}
                    className={interactive ? 'az-hit' : undefined}
                    onClick={onSelect ? () => onSelect(road) : undefined}
                    style={interactive ? { cursor: 'pointer' } : undefined}
                  >
                    {/* The whole road, kerb to kerb, takes the click. */}
                    {interactive ? <path d={pathOf(projection, laid.outline, true)} fill="transparent" stroke="none" /> : null}
                    <TrueRoad areas={laid} lanes={road.lanes!} marks={laid.marks} projection={projection} style={style} />
                  </g>
                )
              }
              return (
                <g
                  key={road.id}
                  className={interactive ? 'az-hit' : undefined}
                  onClick={onSelect ? () => onSelect(road) : undefined}
                  style={interactive ? { cursor: 'pointer' } : undefined}
                >
                  {/* A wide, invisible stroke makes a thin road easy to click. */}
                  {interactive ? (
                    <path
                      d={paths.get(road.id)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={Math.max(width + 2, 12)}
                      {...roadSteady(road, ppb, { plus: 2, least: 12 })}
                    />
                  ) : null}
                  <path
                    d={paths.get(road.id)}
                    fill="none"
                    stroke={style.fill}
                    strokeDasharray={
                      style.dash ? style.dash.map((n) => n * width).join(' ') : undefined
                    }
                    strokeLinecap={style.dash ? 'butt' : 'round'}
                    strokeLinejoin="round"
                    strokeWidth={width}
                    {...roadSteady(road, ppb, {}, style.dash)}
                  />
                  {style.over ? (
                    <path
                      d={paths.get(road.id)}
                      fill="none"
                      stroke={style.over.colour}
                      strokeDasharray={style.over.dash.map((n) => n * width).join(' ')}
                      strokeWidth={width * 0.45}
                      {...roadSteady(road, ppb, { times: 0.45 }, style.over.dash)}
                    />
                  ) : null}
                </g>
              )
            })}
          </g>
          {/*
            A bridge: the road passing over is drawn again across the one under it, on a deck wider than its casing,
            whose edges, shaded, cut across the road below. A kind drawn without a casing gets a whitewash deck, and
            a dashed kind a solid run over it.
          */}
          {bridges.length ? (
            <g className="az-road-bridges" pointerEvents="none">
              {bridges.map(({ over, deck, fill, lanes, width, steady }) => {
                const style = ROAD_STYLES[over.kind]
                // A deck at true width is as wide as the road, in blocks: it scales with the ground mid-zoom.
                const deckSteady = steady ? roadSteady(over, ppb, { plus: DECK }) : steadyWidth({ min: 0, base: width, max: 1e6, plus: DECK })
                return (
                  <g key={over.id + deck}>
                    <path
                      d={deck}
                      fill="none"
                      stroke={style.casing ?? GROUND.whitewash}
                      strokeLinecap="butt"
                      strokeLinejoin="round"
                      strokeWidth={width + DECK}
                      {...deckSteady}
                    />
                    <path
                      d={deck}
                      fill="none"
                      stroke={GROUND.ink}
                      strokeLinecap="butt"
                      strokeLinejoin="round"
                      strokeOpacity={DECK_SHADE}
                      strokeWidth={width + DECK}
                      {...deckSteady}
                    />
                    {lanes && over.lanes ? (
                      <TrueRoad areas={lanes} lanes={over.lanes} projection={projection} style={style} />
                    ) : fill ? (
                      <path
                        d={fill}
                        fill="none"
                        stroke={style.fill}
                        strokeLinecap="butt"
                        strokeLinejoin="round"
                        strokeWidth={width}
                        {...roadSteady(over, ppb)}
                      />
                    ) : null}
                  </g>
                )
              })}
            </g>
          ) : null}
        </g>
      )}
      {labels?.size && part !== 'roads' ? (
        <g className="az-road-names">
          {ordered.map((road) => {
            const name = labels.get(road.id)
            if (!name || !road.name) return null
            const course = courses.get(road.id)!
            // Set left to right; a course drawn the other way is read backwards.
            const ahead = forwards(projection, course)
            const pathId = `${id}-road-${road.id}`
            // Along the road itself, so it can't be scaled back as a whole mid-zoom: its type is, instead.
            return (
              <g key={road.id} {...named(projection, 'road', road.id)}>
                <defs>
                  <path
                    d={pathOf(projection, ahead ? course : [...course].reverse())}
                    id={pathId}
                  />
                </defs>
                <text
                  className="font-body"
                  dy="0.36em"
                  fill={GROUND.ink}
                  fontSize={fontSize}
                  fontWeight={600}
                  letterSpacing={0.4}
                  {...halo(GROUND.whitewash, 3)}
                  {...steadyType(fontSize, 0.4, 3)}
                >
                  <textPath
                    href={`#${pathId}`}
                    startOffset={`${((ahead ? name.offset : 1 - name.offset) * 100).toFixed(1)}%`}
                    textAnchor="middle"
                  >
                    {road.name}
                  </textPath>
                </text>
              </g>
            )
          })}
        </g>
      ) : null}
    </g>
  )
}
