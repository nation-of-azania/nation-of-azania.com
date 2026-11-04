import { roadPoints, type MapRoad } from '@/maps/data'
import { boundsOf, pathLength, type Point } from '@/maps/geo'
import { overpassesOf } from '@/maps/junctions'
import { GROUND, ROAD_ORDER, ROAD_STYLES } from '@/maps/palette'

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
  // A wash at every zoom: a little more ink for hairlines far out, more ground showing up close.
  const wash = zoom <= -1 ? ease(zoom, -4, -1, 0.78, 0.55) : ease(zoom, -1, 2, 0.55, 0.42)
  const edge = ease(zoom, 0, 2, 2, 1.2)
  const fontSize = nameSize(zoom)
  const chosen = selected != null ? ordered.find((road) => road.id === selected) : null
  // The bridges on the page, once the roads are wide enough for one to be seen passing over another.
  const byId = new Map(ordered.map((road) => [road.id, road]))
  const bridges =
    part === 'names'
      ? []
      : overpassesAmong(roads).flatMap((bridge) => {
          const over = byId.get(Number(bridge.over))
          const under = byId.get(Number(bridge.under))
          if (!over || !under || !inBounds(projection.bounds, bridge.at)) return []
          const overWidth = roadWidth(over, ppb)
          const underWidth = roadWidth(under, ppb)
          if (underWidth < 3) return []
          // The deck spans the road under it and a little more each way; its fill runs on past the deck's ends, so only
          // the deck's long edges show, as two bars across the road below.
          const course = courses.get(over.id)!
          const reach = (underWidth / 2 + edge + overWidth / 2 + 2) / ppb
          return [
            {
              over,
              deck: pathOf(projection, pieceAround(course, bridge.at, reach)),
              fill: pathOf(projection, pieceAround(course, bridge.at, reach + (DECK + 2) / ppb)),
              width: overWidth,
            },
          ]
        })

  return (
    <g className="az-roads">
      {chosen && part !== 'names' ? (
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
      ) : null}
      {/* Solid inside, washed as one: roads meeting merge, and nothing shows through a fill but the ground. */}
      {part === 'names' ? null : (
        <g className="az-road-body" opacity={wash}>
          <g className="az-road-casings">
            {ordered.map((road) => {
              const style = ROAD_STYLES[road.kind]
              if (!style.casing) return null
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
              {bridges.map(({ over, deck, fill, width }) => {
                const style = ROAD_STYLES[over.kind]
                return (
                  <g key={over.id + deck}>
                    <path
                      d={deck}
                      fill="none"
                      stroke={style.casing ?? GROUND.whitewash}
                      strokeLinecap="butt"
                      strokeLinejoin="round"
                      strokeWidth={width + DECK}
                      {...roadSteady(over, ppb, { plus: DECK })}
                    />
                    <path
                      d={deck}
                      fill="none"
                      stroke={GROUND.ink}
                      strokeLinecap="butt"
                      strokeLinejoin="round"
                      strokeOpacity={DECK_SHADE}
                      strokeWidth={width + DECK}
                      {...roadSteady(over, ppb, { plus: DECK })}
                    />
                    <path
                      d={fill}
                      fill="none"
                      stroke={style.fill}
                      strokeLinecap="butt"
                      strokeLinejoin="round"
                      strokeWidth={width}
                      {...roadSteady(over, ppb)}
                    />
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
