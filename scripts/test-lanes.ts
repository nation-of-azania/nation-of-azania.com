/**
 * Lanes on Azania Maps (src/maps/lanes.ts), checked without a browser: a
 * cross-section kept as built (half blocks, known parts, a lane at least);
 * Hauptallee's two lanes each way about a median, its drawn line on the
 * median; which side traffic keeps to, turned about, and a road reversed
 * keeping its traffic; pavements added; the lines beside a course, round
 * a corner's inside and outside, a hairpin tighter than the road is wide,
 * and a curve.
 *
 *   pnpm test:lanes
 */
import { roadCourse, type Point } from '../src/maps/geo'
import {
  carriagewayWidth,
  describeLanes,
  drivingSide,
  edgeCourses,
  isDivided,
  laneAreas,
  lanePreset,
  lanesProblem,
  lanesWidth,
  marksAlong,
  newPart,
  offsetCourse,
  oneWay,
  partLabel,
  lanesInUse,
  otherSide,
  parseLanes,
  partCourses,
  pavementSides,
  placedParts,
  reachOf,
  reversedLanes,
  withAxis,
  withoutPart,
  withPart,
  withPartAt,
  withPavements,
  withWidth,
  type RoadLanes,
} from '../src/maps/lanes'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const near = (a: Point[], b: Point[], tolerance = 1e-6) =>
  a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) <= tolerance && Math.abs(p[1] - b[i][1]) <= tolerance)

/** The distance from a point to a polyline. */
function distanceTo(point: Point, line: Point[]): number {
  let best = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i]
    const [bx, bz] = line[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - az) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(point[0] - (ax + dx * t), point[1] - (az + dz * t)))
  }
  return best
}

/** Does a polyline cross itself anywhere? */
function crossesItself(line: Point[]): boolean {
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  for (let i = 0; i < line.length - 1; i++)
    for (let j = i + 2; j < line.length - 1; j++) {
      const [a, b, c, d] = [line[i], line[i + 1], line[j], line[j + 1]]
      const d1 = cross(c, d, a)
      const d2 = cross(c, d, b)
      const d3 = cross(a, b, c)
      const d4 = cross(a, b, d)
      if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))) return true
    }
  return false
}

// Kept as built.
const sent = {
  parts: [
    { kind: 'walk', width: 6 },
    { kind: 'lane', width: 3.2, dir: 'with' },
    { kind: 'line', width: 1, style: 'dashed' },
    { kind: 'lane', width: 3, dir: 'sideways' },
    { kind: 'tram', width: 2 },
  ],
}
const kept = parseLanes(sent)
check(kept?.parts.length === 4, 'a part of no known kind is left out')
check(kept?.parts[1].width === 3, 'widths are kept to the half block')
check(kept?.parts[3].kind === 'lane' && kept.parts[3].dir === 'both', 'a lane of no known direction is shared')
check(kept?.axis === 6.5, 'without an axis, the drawn line lies at the middle')
check(parseLanes({ parts: [{ kind: 'walk', width: 2 }] }) === null, 'pavements alone are no road')
check(parseLanes({ parts: [{ kind: 'lane', width: 3, dir: 'with' }], axis: 99 })?.axis === 3, 'the axis is kept within the road')
check(parseLanes({ parts: [{ kind: 'lane', width: 40, dir: 'with' }] })?.parts[0].width === 8, 'a lane is 8 blocks at most')
check(lanesProblem(null) === null && lanesProblem(sent) !== null && lanesProblem(lanePreset('two-way')) === null, 'the form is told what’s wrong, and only then')

// Hauptallee: two lanes each way about a median, as built on the straight; its line on the median, a pavement on one side.
const hauptallee: RoadLanes = withPavements(lanePreset('divided', 'right'), 6, 'right')
check(lanesWidth(lanePreset('divided')) === 16, 'two each way, divided: 16 blocks kerb to kerb, as Hauptallee')
check(lanesWidth(hauptallee) === 22 && hauptallee.axis === 8, '…and 22 with its pavement, the line still on the median')
const median = placedParts(hauptallee).find((p) => p.part.kind === 'strip')!
check(median.from === -1 && median.to === 1, '…the median a block either side of it')
check(same(reachOf(hauptallee), { left: 8, right: 14 }), '…reaching 8 blocks to the left and 14 to the right')
check(isDivided(hauptallee) && !isDivided(lanePreset('two-way')), 'a median between the ways is a divided road')
const median3 = hauptallee.parts.findIndex((p) => p.kind === 'strip')
check(partLabel(hauptallee, median3) === 'Median', '…a strip between the lanes is its median')

// Towns build their streets differently: pavements behind a verge, on one side or both.
const verged = withPavements(lanePreset('two-way'), 2, 'both', 1)
check(same(verged.parts.map((p) => p.kind), ['walk', 'strip', 'lane', 'line', 'lane', 'strip', 'walk']) && verged.axis === 6.5, 'pavements behind a grass verge, the line still mid-road')
check(partLabel(verged, 1) === 'Verge' && partLabel(verged, 5) === 'Verge' && !isDivided(verged), '…a strip beside the road is a verge, and no median')
const patown = [
  { name: 'Löwenzahnweg', lanes: verged },
  { name: 'Reiseweg', lanes: reversedLanes(verged) },
  { name: 'Hauptallee', lanes: hauptallee },
  { name: 'Gasse', lanes: null },
]
const used = lanesInUse(patown)
check(used.length === 2 && used[0].roads.length === 2 && same(used[0].lanes, verged), 'a town’s own cross-sections, most used first, a road drawn the other way the same')

// Which side traffic keeps to.
check(drivingSide(lanePreset('two-way', 'right')) === 'right' && drivingSide(lanePreset('two-way', 'left')) === 'left', 'the presets keep to the side asked')
check(drivingSide(otherSide(lanePreset('divided', 'right'))) === 'left', 'turned about, traffic keeps to the other side')
check(drivingSide(lanePreset('shared')) === null && drivingSide(lanePreset('one-way')) === null, 'a shared lane or a one-way street keeps to no side')
check(oneWay(lanePreset('one-way')) === 'with' && oneWay(lanePreset('two-way')) === null && oneWay(lanePreset('shared')) === null, 'one-way, only when every lane runs one way')
const back = reversedLanes(hauptallee)
check(drivingSide(back) === 'right' && back.axis === 14 && back.parts[0].kind === 'walk', 'a road drawn the other way keeps its traffic, its pavement now on the left')
check(same(reversedLanes(back), hauptallee), '…and turned about twice is as it was')

// Lines beside a course: right of it positive, with z south.
check(near(offsetCourse([[0, 0], [10, 0]], 2), [[0, 2], [10, 2]]), 'heading east, right of the road is south')
check(near(offsetCourse([[0, 0], [10, 0], [10, 10]], 2), [[0, 2], [8, 2], [8, 10]]), 'a right turn: its inside cut at the crossing')
check(near(offsetCourse([[0, 0], [10, 0], [10, 10]], -2), [[0, -2], [12, -2], [12, 10]]), '…its outside mitred')
const sharp = offsetCourse([[0, 0], [10, 0], [0, 1]], -3)
check(sharp.length === 4, 'a mitre that would reach too far is cut square')

// A hairpin tighter than the road is wide: a half circle of 3 blocks, lanes 5 blocks inside it.
const hairpin: Point[] = [[-10, -3], [0, -3], ...Array.from({ length: 13 }, (_, k): Point => [3 * Math.sin((k * Math.PI) / 12), -3 * Math.cos((k * Math.PI) / 12)]), [-10, 3]]
const inside = offsetCourse(hairpin, 5)
check(!crossesItself(inside), 'the inside of a hairpin tighter than the offset doesn’t fold over itself')
const outside = offsetCourse(hairpin, -5)
check(!crossesItself(outside) && outside.every((p) => distanceTo(p, hairpin) >= 5 - 1e-6), '…its outside runs round it')
// A bend of 120° on a radius of 3, its legs running apart: the inside cut across, the whole offset from the road.
const arc = (from: number, to: number, steps: number): Point[] =>
  Array.from({ length: steps + 1 }, (_, k): Point => {
    const angle = ((from + ((to - from) * k) / steps) * Math.PI) / 180
    return [3 * Math.cos(angle), 3 * Math.sin(angle)]
  })
const bendArc = arc(-90, 30, 12)
const tangent = (point: Point, angle: number, distance: number): Point => [point[0] + distance * Math.cos((angle * Math.PI) / 180), point[1] + distance * Math.sin((angle * Math.PI) / 180)]
const bend: Point[] = [tangent(bendArc[0], 180, 12), ...bendArc, tangent(bendArc[bendArc.length - 1], 120, 12)]
const cut = offsetCourse(bend, 5)
check(!crossesItself(cut) && cut.every((p) => distanceTo(p, bend) >= 5 - 1e-6), 'a bend tighter than the road is wide: its inside cut across, the whole offset from the road')
check(cut.length < bend.length, '…through fewer points than the bend has')

// A curve, as roadCourse gives it.
const curve = roadCourse([[0, 0], [40, 20], [80, 0]], 'curved')
const aside = offsetCourse(curve, 3)
check(aside.every((p) => Math.abs(distanceTo(p, curve) - 3) < 0.15), 'along a curve, a lane keeps its distance')

// The parts along Hauptallee's straight, drawn north to south.
const course: Point[] = [[-15002.5, 1721.5], [-15002.5, 1782.5]]
const along = partCourses(course, hauptallee)
const lanesAt = along.filter((p) => p.part.kind === 'lane').map((p) => p.middle[0][0])
check(along.find((p) => p.part.kind === 'strip')!.middle[0][0] === -15002.5, 'the median runs along the drawn line')
check(lanesAt.filter((x) => x > -15002.5).length === 2 && lanesAt.filter((x) => x < -15002.5).length === 2, '…two lanes either side of it')
check(along.find((p) => p.part.kind === 'walk')!.middle[0][0] === -15002.5 - 11, '…the pavement on the west, right of a road drawn south')
const edges = edgeCourses(course, hauptallee)
check(edges.left[0][0] === -15002.5 + 8 && edges.right[0][0] === -15002.5 - 14, '…its edges 8 blocks east and 14 west')

// In a few words, for the road's page.
check(describeLanes(hauptallee) === '2 + 2 lanes, divided · pavement on the right', 'Hauptallee in a few words')
check(describeLanes(verged) === '1 + 1 lanes · pavements both sides', '…a verged street too')
check(describeLanes(lanePreset('shared')) === 'One shared lane' && describeLanes(lanePreset('one-way')) === 'One-way, 1 lane', '…a shared lane, a one-way')
check(same(pavementSides(verged), { left: true, right: true }) && same(pavementSides(hauptallee), { left: false, right: true }), 'which sides have a pavement, a verge between or not')
check(carriagewayWidth(hauptallee) === 16 && carriagewayWidth(verged) === 7, 'the carriageway: kerb to kerb, pavements and verges not counted')

// Shaping a cross-section: the drawn line stays where it lies on the road.
const widerWalk = withWidth(hauptallee, hauptallee.parts.length - 1, 8)
check(lanesWidth(widerWalk) === 24 && widerWalk.axis === 8, 'a pavement right of the line widened: the line stays on the median')
const widerLeftLane = withWidth(hauptallee, 0, 4)
check(widerLeftLane.axis === 9 && placedParts(widerLeftLane).find((p) => p.part.kind === 'strip')!.from === -1, 'a lane left of the line widened: the line still on the median')
const widerMedian = withWidth(hauptallee, 3, 4)
check(widerMedian.axis === 9 && placedParts(widerMedian)[3].centre === 0, '…the median itself widened about the line')
check(withWidth(hauptallee, 0, 99).parts[0].width === 8 && withWidth(hauptallee, 1, 0).parts[1].width === 0, 'widths held within PART_WIDTHS')
const walked = withPartAt(hauptallee, 0, newPart('walk'))
check(walked.parts[0].kind === 'walk' && walked.axis === 10 && lanesWidth(walked) === 24, 'a pavement put in at the left edge: the line moves along with the parts')
check(withPartAt(hauptallee, hauptallee.parts.length, newPart('strip')).axis === 8, '…one at the right edge leaves it be')
const unwalked = withoutPart(hauptallee, hauptallee.parts.length - 1)!
check(same(unwalked, lanePreset('divided', 'right')), 'the pavement taken off: the preset again')
check(same(withoutPart(walked, 0), hauptallee), '…and the one on the left too')
check(withoutPart(lanePreset('shared'), 0) === null, 'the last lane can’t go')
check(withoutPart(withPartAt(lanePreset('two-way'), 1, { kind: 'strip', width: 4, surface: 'grass' }), 1)!.axis === 3.5, 'a part the line lay in removed: the line lands on its edge')
check(withPart(hauptallee, 0, { dir: 'with' }).parts[0].kind === 'lane' && (withPart(hauptallee, 0, { dir: 'with' }).parts[0] as { dir: string }).dir === 'with', 'a lane turned')
check(withPart(hauptallee, 1, { style: 'solid' }).parts[1].kind === 'line' && (withPart(hauptallee, 1, { style: 'solid' }).parts[1] as { style: string }).style === 'solid', 'a line made solid')
check(withAxis(hauptallee, 3.2).axis === 3 && withAxis(hauptallee, 99).axis === 22, 'the line set across the road, to the half block, within it')

// The parts as areas along a bend: side by side, they meet exactly.
const areas = laneAreas(bend, hauptallee)
check(areas.parts.length === 8 && areas.parts.every((p) => p.ring && p.ring.length >= 4), 'every part an area along the road')
check(areas.width === 22 && areas.carriageway === 16, '…as wide as the road')
check(same(areas.parts[0].ring!.slice(0, areas.boundaries[0].length), areas.boundaries[0]), '…a part’s ring runs along its left boundary')
check(same(areas.parts[3].ring!.slice(0, areas.boundaries[3].length), areas.boundaries[3]) && same(areas.parts[2].ring!.slice(areas.boundaries[2].length), areas.boundaries[3].slice().reverse()), '…and neighbours share the boundary between them')
check(areas.edges.left === areas.boundaries[0] && areas.edges.right === areas.boundaries[8], '…the edges are the outermost boundaries')
check(areas.parts.filter((p) => p.middle.length).length === 6 && areas.parts.every((p) => (p.part.kind === 'lane' || p.part.kind === 'line') === p.middle.length > 0), '…lanes and lines carry the line along their middle')
check(laneAreas(course, { parts: [{ kind: 'lane', width: 3, dir: 'with' }, { kind: 'line', width: 0, style: 'solid' }, { kind: 'lane', width: 3, dir: 'against' }], axis: 3 }).parts[1].ring === null, 'a line no blocks wide is no area')
const marks = marksAlong([[0, 0], [100, 0]], 10)
check(marks.length === 10 && marks[0].at[0] === 5 && marks[9].at[0] === 95 && marks[0].heading === 0, 'marks every ten blocks along a line, from five in')
check(marksAlong([[0, 0], [0, 50]], 10, true)[0].heading === -Math.PI / 2, '…turned about for a lane running against the road')
check(marksAlong([[0, 0], [30, 0], [30, 30]], 10).length === 6, '…round a corner')

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
