import { spoken } from '@/maps/data'
import type { Bounds, Point } from '@/maps/geo'
import { GROUND } from '@/maps/palette'
import { WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST } from '@/maps/source'

import { halo, named, steadyType, type Projection } from './projection'

/**
 * A nation's reach: the server lets a nation besiege towns only within
 * CAPITAL_WAR_RADIUS (12,320 blocks, about Africa's width) of its capital,
 * and this is that circle, drawn with the diplomacy layer only. Azania's is
 * drawn calmly, a dashed line in the deep sea on a whitewash casing, named
 * along its top; another nation's is drawn in its colour while its nation
 * is open or under the pointer.
 *
 * The circle is some 77,000 blocks round, so it's never drawn whole when
 * the reader is close: it's sampled finely enough to stay round at every
 * zoom (a chord never strays half a pixel), and only the arcs over the
 * page are kept. It ends where the world does: the game's world doesn't
 * wrap, so no capital reaches across a seam, and each copy of the world on
 * the page draws its own ring cut at its own edges — a ring near the east
 * edge stops at the seam there, and its arc is seen again, washed, just
 * west of the west seam, in the echo that is the east edge's copy.
 */

/** The world the game has, which a ring stops at: the sheet's own extent. */
const WORLD: Bounds = { minX: WORLD_WEST, maxX: WORLD_EAST, minZ: WORLD_NORTH, maxZ: WORLD_SOUTH }

const inside = (b: Bounds, [x, z]: Point) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ

/** Where a segment leaving (or entering) `b` crosses its edge, by halving: the segments are short, so a few steps do. */
function edgeOf(b: Bounds, inner: Point, outer: Point): Point {
  let lo = inner
  let hi = outer
  for (let i = 0; i < 12; i++) {
    const mid: Point = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]
    if (inside(b, mid)) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * The circle's arcs within `clip`, as runs of points in blocks: sampled so
 * a chord strays under half a pixel at this scale (at most 4,096 points
 * round), cut exactly at the clip's edges.
 */
export function ringRuns(centre: Point, radius: number, ppb: number, clip: Bounds): Point[][] {
  const rpx = radius * ppb
  const steps = Math.min(4096, Math.max(96, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - 0.4 / Math.max(rpx, 1))))))
  const runs: Point[][] = []
  let run: Point[] | null = null
  let last: Point | null = null
  // From due north, clockwise, and once more to close the circle.
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2
    const point: Point = [centre[0] + radius * Math.cos(a), centre[1] + radius * Math.sin(a)]
    const isIn = inside(clip, point)
    if (isIn && !run) {
      run = last ? [edgeOf(clip, point, last)] : []
      runs.push(run)
    }
    if (isIn) run!.push(point)
    if (!isIn && run && last) {
      run.push(edgeOf(clip, last, point))
      run = null
    }
    last = point
  }
  // A ring wholly inside, begun and ended at north, is one run; one cut across north is two that meet there.
  if (runs.length > 1 && inside(clip, [centre[0], centre[1] - radius])) {
    const first = runs.shift()!
    runs[runs.length - 1].push(...first.slice(1))
  }
  return runs.filter((points) => points.length > 1)
}

const intersect = (a: Bounds, b: Bounds): Bounds | null => {
  const box = {
    minX: Math.max(a.minX, b.minX),
    maxX: Math.min(a.maxX, b.maxX),
    minZ: Math.max(a.minZ, b.minZ),
    maxZ: Math.min(a.maxZ, b.maxZ),
  }
  return box.minX < box.maxX && box.minZ < box.maxZ ? box : null
}

const pathThrough = (projection: Projection, points: Point[]) =>
  points
    .map((point, i) => {
      const [x, y] = projection.project(point)
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join('')

/** The ring's name set along it: the arc's path, and where about the ring it sits, for the live map's names. */
type LabelArc = { d: string; along: string }

/**
 * Where the ring's name goes: along its arc nearest the top of the page,
 * just inside it, when enough of the arc is on the page to carry it. With
 * the path it says where about the ring the name sits, the same at every
 * zoom while the name stays put, so the live map (leaflet/names.ts) can
 * tell a ring cut anew for a view that moved, where the name must cross-
 * fade to its new stretch, from one merely drawn again: exactly the top
 * when the whole ring is on the page, else the angle to the nearest 0.05.
 */
function labelArc(
  projection: Projection,
  centre: Point,
  radius: number,
  runs: Point[][],
  width: number,
): LabelArc | null {
  const view = projection.view ?? projection.bounds
  const all = runs.flat()
  const seen = all.filter((point) => inside(view, point))
  if (seen.length < 2) return null
  // The whole ring on the page: named along its top, as an atlas would. Only some of it: named at the
  // middle of the longest stretch on the page, well clear of the page's edges.
  const stretches = runs.map((run) => run.filter((point) => inside(view, point)))
  const longest = stretches.reduce((best, stretch) => (stretch.length > best.length ? stretch : best))
  const whole = seen.length > all.length * 0.9
  const at = whole ? seen.reduce((best, point) => (point[1] < best[1] ? point : best)) : longest[Math.floor(longest.length / 2)]
  const angle = Math.atan2(at[1] - centre[1], at[0] - centre[0])
  const along = whole ? 'top' : (Math.round(angle / 0.05) * 0.05).toFixed(2)
  // On the ring's lower half the name runs the other way round, so it reads upright; either way it sits just inside.
  const lower = Math.sin(angle) > 0
  const rpx = radius * projection.ppb
  const inset = lower ? 5 : 12
  const r = radius - inset / projection.ppb
  const half = width / 2 / Math.max(rpx - inset, 1)
  if (half > Math.PI / 2) return null
  const [a0, a1] = lower ? [angle + half, angle - half] : [angle - half, angle + half]
  const from: Point = [centre[0] + r * Math.cos(a0), centre[1] + r * Math.sin(a0)]
  const to: Point = [centre[0] + r * Math.cos(a1), centre[1] + r * Math.sin(a1)]
  // The whole of the label's arc must be on the page, and on the world, never over a seam.
  if (!inside(view, from) || !inside(view, to) || !inside(WORLD, from) || !inside(WORLD, to)) return null
  const [fx, fy] = projection.project(from)
  const [tx, ty] = projection.project(to)
  const rr = (rpx - inset).toFixed(1)
  return { d: `M${fx.toFixed(1)} ${fy.toFixed(1)}A${rr} ${rr} 0 0 ${lower ? 0 : 1} ${tx.toFixed(1)} ${ty.toFixed(1)}`, along }
}

/** A capital and the ring about it, and how to draw it. */
export type Reach = {
  nation: string
  capital: { town: string; home: Point }
  colour: string
  /** Azania's: the calm dashed ring in the deep sea, always named. */
  home: boolean
  /** Named along its top: Azania's, and the nation open in the panel. */
  named: boolean
}

/**
 * One ring on one projection: cut to the world and to the page, cased,
 * dashed, and named along its top. The ring, its name, or both (the
 * default): the live map draws the ring with the ground and the name over
 * it, where it keeps its size mid-zoom (leaflet/canvas.tsx → OnTop).
 */
export function NationReach({
  projection,
  reach,
  radius,
  part,
}: {
  projection: Projection
  reach: Reach
  radius: number
  part?: 'ring' | 'name'
}) {
  const clip = intersect(WORLD, projection.bounds)
  if (!clip) return null
  const runs = ringRuns(reach.capital.home, radius, projection.ppb, clip)
  if (!runs.length) return null
  const d = runs.map((run) => pathThrough(projection, run)).join('')
  // Its name in full where the arc on the page will carry it, else just whose reach it is.
  const short = `${spoken(reach.nation).toUpperCase()}’S REACH`
  const long = `${short} · ${radius.toLocaleString('en-GB')} BLOCKS FROM ${spoken(reach.capital.town).toUpperCase()}`
  const fontSize = 10
  const tracking = 1.6
  const widthOf = (words: string) => words.length * (fontSize * 0.6 + tracking)
  let text = long
  let arc = reach.named ? labelArc(projection, reach.capital.home, radius, runs, widthOf(long)) : null
  if (reach.named && !arc) {
    text = short
    arc = labelArc(projection, reach.capital.home, radius, runs, widthOf(short))
  }
  const id = `${projection.id}-reach-${reach.nation.replace(/[^\w-]/g, '')}`
  return (
    <g className="az-reach" pointerEvents="none">
      {part === 'name' ? null : (
        <>
          <path d={d} fill="none" stroke={GROUND.whitewash} strokeLinecap="round" strokeOpacity={0.7} strokeWidth={reach.home ? 4 : 3.5} />
          <path
            d={d}
            fill="none"
            stroke={reach.colour}
            strokeDasharray={reach.home ? '10 6' : '6 5'}
            strokeLinecap="round"
            strokeOpacity={0.9}
            strokeWidth={reach.home ? 2 : 1.5}
          />
        </>
      )}
      {arc && part !== 'ring' ? (
        // Along the ring itself, so it can't be scaled back as a whole mid-zoom: its type is, instead.
        <g {...named(projection, 'reach', reach.nation, { along: arc.along })}>
          <defs>
            <path d={arc.d} id={id} />
          </defs>
          <text
            className="font-label"
            fill={reach.colour}
            fontSize={fontSize}
            fontWeight={700}
            letterSpacing={tracking}
            {...halo(GROUND.whitewash, 3)}
            {...steadyType(fontSize, tracking, 3)}
          >
            <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
              {text}
            </textPath>
          </text>
        </g>
      ) : null}
    </g>
  )
}
