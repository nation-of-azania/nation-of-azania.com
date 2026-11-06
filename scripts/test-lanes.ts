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
import { inRing, roadCourse, type Point } from '../src/maps/geo'
import { crossingsOf, overpassesOf, sharedInto, snapToRoads } from '../src/maps/junctions'
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
  lanesAxis,
  lanesInUse,
  otherSide,
  parseLanes,
  partCourses,
  pavementSides,
  placedParts,
  reachOf,
  reversedLanes,
  withoutPart,
  withPart,
  withPartAt,
  withPavements,
  withWidth,
  type LanePart,
  type RoadLanes,
  beyondEdge,
  distanceAlong,
  lanesAt,
  profileOf,
  teeSide,
  teesOf,
  tracksOf,
  withChangeAt,
  withChangeMoved,
  withoutChange,
  withProfile,
  acrossCourse,
  describeChanges,
  roomForChange,
  followLaneEnds,
  laneEndsOf,
  laneEndWords,
  laneMouth,
  lanePathsOf,
  onLane,
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
check(kept?.axis === 9.5, 'the drawn line lies down the middle of the carriageway, the pavement beside it not counted')
check(parseLanes({ parts: [{ kind: 'walk', width: 2 }] }) === null, 'pavements alone are no road')
check(parseLanes({ parts: [{ kind: 'lane', width: 3, dir: 'with' }], axis: 99 })?.axis === 1.5, 'an axis sent is no matter: the line is the middle, always')
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
const laneXs = along.filter((p) => p.part.kind === 'lane').map((p) => p.middle[0][0])
check(along.find((p) => p.part.kind === 'strip')!.middle[0][0] === -15002.5, 'the median runs along the drawn line')
check(laneXs.filter((x) => x > -15002.5).length === 2 && laneXs.filter((x) => x < -15002.5).length === 2, '…two lanes either side of it')
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
check(widerLeftLane.axis === 8.5 && placedParts(widerLeftLane)[0].from === -8.5 && placedParts(widerLeftLane).at(-2)!.to === 8.5, 'a lane widened: the road grows about the line, half a block each way')
const widerMedian = withWidth(hauptallee, 3, 4)
check(widerMedian.axis === 9 && placedParts(widerMedian)[3].centre === 0, '…the median itself widened about the line, the line still on it')
let stepped = hauptallee
for (const width of [2.5, 3, 3.5, 4, 3.5]) stepped = withWidth(stepped, 3, width)
check(placedParts(stepped)[3].centre === 0 && placedParts(stepped)[3].from === -1.75, '…half a block at a time, and back, the line never drifting off its middle')
check(withWidth(hauptallee, 0, 99).parts[0].width === 8 && withWidth(hauptallee, 1, 0).parts[1].width === 0, 'widths held within PART_WIDTHS')
const walked = withPartAt(hauptallee, 0, newPart('walk'))
check(walked.parts[0].kind === 'walk' && walked.axis === 10 && lanesWidth(walked) === 24 && placedParts(walked)[4].centre === 0, 'a pavement put in at the left edge: the lanes stay about the line')
check(withPartAt(hauptallee, hauptallee.parts.length, newPart('strip')).axis === 8, '…one at the right edge leaves it be')
const unwalked = withoutPart(hauptallee, hauptallee.parts.length - 1)!
check(same(unwalked, lanePreset('divided', 'right')), 'the pavement taken off: the preset again')
check(same(withoutPart(walked, 0), hauptallee), '…and the one on the left too')
check(withoutPart(lanePreset('shared'), 0) === null, 'the last lane can’t go')
check(withoutPart(withPartAt(lanePreset('two-way'), 1, { kind: 'strip', width: 4, surface: 'grass' }), 1)!.axis === 3.5, 'a part in the middle removed: the line in the middle still')
check(withPart(hauptallee, 0, { dir: 'with' }).parts[0].kind === 'lane' && (withPart(hauptallee, 0, { dir: 'with' }).parts[0] as { dir: string }).dir === 'with', 'a lane turned')
check(withPart(hauptallee, 1, { style: 'solid' }).parts[1].kind === 'line' && (withPart(hauptallee, 1, { style: 'solid' }).parts[1] as { style: string }).style === 'solid', 'a line made solid')
check(lanesAxis(withPavements(lanePreset('two-way'), 3, 'left', 1).parts) === 7.5, 'a pavement and a verge on one side only: the line still down the middle of the lanes')

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

// Changes along a road: Hauptallee's median tapering out, a centre line coming in.
{
  const lane = (dir: 'with' | 'against'): LanePart => ({ kind: 'lane', width: 3, dir })
  const dashed: LanePart = { kind: 'line', width: 1, style: 'dashed' }
  const walk: LanePart = { kind: 'walk', width: 2 }
  const wide = [walk, lane('against'), dashed, lane('against'), { kind: 'strip', width: 3.5, surface: 'grass' } as LanePart, lane('with'), dashed, lane('with'), walk]
  const narrow = [walk, lane('against'), dashed, lane('against'), dashed, lane('with'), dashed, lane('with'), walk]
  const allee = parseLanes({ parts: wide, changes: [{ at: 100, over: 20, parts: narrow }] })!
  check(allee.changes?.length === 1 && allee.changes[0].at === 100 && allee.changes[0].over === 20, 'a change along the road is kept')
  check(!('changes' in parseLanes({ parts: wide, changes: [] })!) && !('changes' in parseLanes({ parts: wide, changes: [{ at: 5, parts: [walk] }] })!), '…and none is no changes at all: a change with no lane is left out')
  const two = parseLanes({ parts: wide, changes: [{ at: 50, over: 30, parts: narrow }, { at: 60, over: 10, parts: wide }, { at: -5, over: 2, parts: narrow }] })!
  check(same(two.changes!.map((c) => [c.at, c.over]), [[0, 2], [50, 30], [80, 10]]), '…in order along the road, none overlapping')

  const tracks = tracksOf(allee)
  check(tracks.length === 10 && tracks.filter((t) => t.parts[0] && t.parts[1]).length === 8, 'followed through the change: eight parts go on, the median ends, a centre line begins')
  const median = tracks.findIndex((t) => t.kind === 'strip')
  check(tracks[median].parts[1] === null && tracks[median + 1].kind === 'line' && tracks[median + 1].parts[0] === null, '…the centre line opening where the median narrows away')
  const halfway = lanesAt(allee, 110)
  check(halfway.parts.find((p) => p.kind === 'strip')?.width === 1.75 && halfway.parts.filter((p) => p.kind === 'line').some((p) => p.width === 0.5), 'halfway through the change: the median half gone, the centre line half there')
  check(!lanesAt(allee, 130).parts.some((p) => p.kind === 'strip') && lanesWidth(lanesAt(allee, 130)) === lanesWidth({ parts: narrow }), 'once run: as the cross-section after')
  const halfwayLanes = placedParts(halfway).filter((p) => p.part.kind === 'lane')
  check(Math.abs(halfwayLanes[0].from + halfwayLanes.at(-1)!.to) < 1e-9, 'the drawn line stays in the middle of the lanes all through the change')

  const course: Point[] = [[0, 0], [200, 0]]
  const areas = laneAreas(course, allee)
  const across = (line: Point[], x: number) => {
    for (let i = 1; i < line.length; i++) if (line[i - 1][0] <= x && line[i][0] >= x) return line[i - 1][1] + ((line[i][1] - line[i - 1][1]) * (x - line[i - 1][0])) / (line[i][0] - line[i - 1][0])
    return NaN
  }
  const widthOfTrack = (t: number, x: number) => across(areas.boundaries[t + 1], x) - across(areas.boundaries[t], x)
  check(Math.abs(widthOfTrack(median, 50) - 3.5) < 1e-6 && Math.abs(widthOfTrack(median, 110) - 1.75) < 1e-6 && Math.abs(widthOfTrack(median, 150)) < 1e-6, 'laid along the course: the median 3.5 blocks, narrowing over the change, then gone')
  const centreLine = areas.parts[median + 1]
  check(centreLine.runs.length === 1 && centreLine.runs[0].middle[0][0] >= 100 - 1e-6 && centreLine.runs[0].middle.at(-1)![0] === 200, '…the centre line drawn only from where it opens')
  check(areas.kerbs.length > 0 && areas.kerbs.every((kerb) => kerb.every((p) => p[0] <= 120 + 1e-6) || kerb.some((p) => Math.abs(p[1]) > 7)), '…the median’s kerbs ending with it, the pavements’ running on')
  check(Math.abs(across(areas.edges.left, 50) - -10.75) < 1e-6 && Math.abs(across(areas.edges.left, 150) - -9.5) < 1e-6, '…the road narrowing about the line, half the median each side')
  const plain = laneAreas(course, lanePreset('two-way'))
  check(plain.parts.every((p) => (p.part.kind === 'lane' || p.part.kind === 'line' ? p.runs.length === 1 : p.runs.length === 0)) && plain.kerbs.length === 0, 'a road the same all along: one run a lane, no kerbs without a verge or pavement')

  // Shaping the changes.
  const added = withChangeAt(lanePreset('two-way'), 40)!
  check(added.k === 1 && added.lanes.changes?.[0].at === 40 && added.lanes.changes[0].over === 12 && same(added.lanes.changes[0].parts, lanePreset('two-way').parts), 'a change put in: the lanes holding there, to shape')
  const shaped = withProfile(added.lanes, 1, withWidth(profileOf(added.lanes, 1), 1, 2))
  check(shaped.changes?.[0].parts[1].width === 2 && shaped.parts[1].width === 1, '…shaped on its own, the start as it was')
  check(withWidth(shaped, 0, 4).changes?.[0].parts[1].width === 2, '…and kept when the start is shaped')
  const later = withChangeAt(shaped, 45)!
  check(later.k === 2 && later.lanes.changes![1].at === 52 && same(later.lanes.changes![1].parts, shaped.changes![0].parts), 'another put in during the first: it begins once that one has run, from where it led')
  check(withChangeMoved(later.lanes, 1, 30, 50).changes![0].over === 22, 'a change can’t run into the next')
  check(same(withoutChange(later.lanes, 2), shaped), 'a change taken out')
  const reversed = reversedLanes(allee, 200)
  check(reversed.changes?.[0].at === 80 && reversed.changes[0].over === 20 && lanesWidth(reversed) === lanesWidth({ parts: narrow }), 'the road drawn the other way: its changes from the far end')
  check(same(reversedLanes(reversed, 200), allee), '…and turned about twice is as it was')
  check(otherSide(allee).changes![0].parts[1].kind === 'lane' && (otherSide(allee).changes![0].parts[1] as { dir: string }).dir === 'with', 'traffic turned about all along the road')
  check(distanceAlong([[0, 0], [10, 0], [10, 10]], [11, 4]) === 14, 'a spot near the road: how far along it lies')
  check(near(acrossCourse([[0, 0], [10, 0], [10, 10]], 5, 2, 3)!, [[5, -2], [5, 3]]), 'a line across the road five blocks along: two blocks left, three right')
  check(near(acrossCourse([[0, 0], [10, 0], [10, 10]], 15, 1, 1)!, [[11, 5], [9, 5]]), '…and round the corner, turned with the road')
  check(roomForChange(lanePreset('two-way'), 200) === 94 && roomForChange(allee, 200) === 44, 'a new change goes where there’s most room: mid-road, or mid the longest stretch left')
  const words = describeChanges(allee)
  check(words.length === 1 && words[0].at === 100 && words[0].words === 'narrows to 2 + 2 lanes · pavements both sides', 'a change in a few words: what the road narrows to')
  check(describeChanges(parseLanes({ parts: narrow, changes: [{ at: 50, over: 10, parts: wide }] })!)[0].words.startsWith('widens to'), '…or widens to')
}

// T-junctions: a road ending on another, not at its end.
{
  const through = { id: 1, line: [[-20, 0], [0, 0], [20, 0]] as Point[] }
  const stem = { id: 2, line: [[0, 30], [0, 0]] as Point[] }
  const tees = teesOf([through, stem, { id: 3, line: [[20, 0], [40, 0]] as Point[] }])
  check(tees.length === 1 && tees[0].stem === 2 && tees[0].through === 1 && tees[0].end === 'end', 'a T found where a road ends on another’s node; one end to end isn’t one')
  check(teeSide(stem.line, 'end', through.line, [0, 0]) === 1, '…the stem right of the through road (south of a road drawn east)')
  const beyond = beyondEdge(through.line, [0, 0], 1, 2, 12)
  check(inRing([0, 0], beyond) && inRing([5, -5], beyond) && !inRing([0, 3], beyond) && !inRing([5, 2.5], beyond), '…the ground beyond its near edge, 2 blocks off its course, masked')
  check(inRing([0, -9], beyond) && !inRing([0, -11], beyond) && !inRing([14, 0], beyond), '…as far beyond as asked, and as far along')
  // The through road curving round toward the stem: the mask follows its edge, not a straight cut.
  const arc: Point[] = Array.from({ length: 21 }, (_, k): Point => {
    const angle = Math.PI + (k * Math.PI) / 20
    return [30 * Math.cos(angle), 30 + 30 * Math.sin(angle)]
  })
  const bent = beyondEdge(arc, [0, 0], 1, 2, 14)
  check(inRing([10, 0], bent) && !inRing([10, 4], bent) && inRing([-10, 2.5], bent), '…round a through road curving toward the stem, the mask follows its curve')
  // A tight bend, the stem on its inside: the band still covers the far half of the road at the apex.
  const tight: Point[] = Array.from({ length: 21 }, (_, k): Point => {
    const angle = Math.PI + (k * Math.PI) / 20
    return [10 * Math.cos(angle), 10 + 10 * Math.sin(angle)]
  })
  const tightBand = beyondEdge(tight, [0, 0], 1, 2, 26)
  check(inRing([0, -1], tightBand) && inRing([0, -4], tightBand) && inRing([0, 1], tightBand) && !inRing([0, 3], tightBand), '…and on a tight bend covers the whole road beyond the kerb, not only a sliver')
}

// Transitions are S-curves: eased in and out, halfway still halfway.
{
  const lane = (dir: 'with' | 'against'): LanePart => ({ kind: 'lane', width: 3, dir })
  const wide = parseLanes({ parts: [lane('against'), { kind: 'strip', width: 4, surface: 'grass' }, lane('with')], changes: [{ at: 0, over: 20, parts: [lane('against'), lane('with')] }] })!
  const medianAt = (s: number) => lanesAt(wide, s).parts.find((p) => p.kind === 'strip')?.width ?? 0
  check(Math.abs(medianAt(10) - 2) < 1e-9 && Math.abs(medianAt(5) - 4 * (1 - 0.15625)) < 1e-9, 'a change runs as an S: a quarter of the way through, a sixth of the way narrowed')
  check(medianAt(1) > 3.95 && medianAt(19) < 0.05, '…leaving the old width and meeting the new one along the road')
}

// Lanes as paths: a road ending on another's lane (a slip road off the outer lane).
{
  const divided = withPavements(lanePreset('divided', 'right'), 3, 'right')
  const road = { id: 1, kind: 'main' as const, line: [[0, 0], [100, 0]] as Point[], shape: 'straight' as const, corners: [], lanes: divided }
  const paths = lanePathsOf(road).paths
  check(same(paths.map((p) => [p.track, p.middle[0][1], p.from, p.to]), [[0, -6.5, 0, 100], [2, -2.5, 0, 100], [4, 2.5, 0, 100], [6, 6.5, 0, 100]]), 'each lane a path of its own, along its middle, the whole way')
  check(onLane([40, 6.9], road)?.path.track === 6 && same(onLane([40, 6.9], road)?.at, [40, 6.5]) && onLane([40, 6.9], road)?.s === 40, 'a spot on the outer lane: that lane, its middle, 40 blocks along')
  check(onLane([40, 0.5], road) === null && onLane([40, 9.5], road) === null, '…not on the drawn line (a shared point’s place), nor on the pavement')

  const slip = { id: 2, kind: 'street' as const, line: [[40, 7], [60, 20]] as Point[], shape: 'straight' as const, corners: [], lanes: null }
  check(same(snapToRoads(slip, [road]), [[40, 6.5], [60, 20]]), 'a road’s end put down on the lane is set on its middle')
  check(same(snapToRoads({ id: 3, line: [[30, 20], [40, 7], [60, 20]] }, [road])[1], [40, 7]), '…an end only: a point on the way is left be')
  const placed = { ...slip, line: [[40, 6.5], [60, 20]] as Point[] }
  const ends = laneEndsOf([road, placed])
  check(ends.length === 1 && ends[0].road === 2 && ends[0].onto === 1 && ends[0].track === 6 && ends[0].side === 1 && ends[0].end === 'start', '…and ends on it: the outer lane, from the right')
  check(sharedInto(placed, [road]).length === 0 && teesOf([road, placed]).length === 0, '…no point shared, and no T')

  const mouth = laneMouth(ends[0], road, placed, { left: 1.5, right: 1.5 })!
  check(inRing([40, 7], mouth.carriageway) && inRing([40, 3], mouth.carriageway) && !inRing([45, 8.5], mouth.carriageway), 'the slip road drawn only beyond the lane’s edge')
  check(inRing([40, 7.5], mouth.kerbs) && !inRing([45, 9], mouth.kerbs) && inRing([40, 10], mouth.outside) && !inRing([45, 12], mouth.outside), '…its kerbs from the road’s kerb, its pavements from the road’s outer edge')
  check(inRing([44.1, 9.3], mouth.cut) && !inRing([30, 9.5], mouth.cut), 'the road’s pavement opened where the slip road passes, and only there')
  check(same(mouth.cutTracks, [7]) && same(mouth.cutBoundaries, [7, 8]) && mouth.cutEdge === 'right', '…its pavement, the kerb and edge on that side: nothing of the lane it leaves')
  check(mouth.outsideCut === mouth.cut, '…a stem with no pavement opens the road’s edge over its carriageway alone')
  const paved = laneMouth(ends[0], road, placed, { left: 1.5, right: 1.5 }, { left: 3.5, right: 3.5 })!
  check(inRing([42, 11.2], paved.outsideCut) && !inRing([42, 11.2], paved.cut) && same(paved.carriageway, mouth.carriageway), '…one with pavements opens the edge over its whole width, its lanes cut as before')
  const inner = laneMouth({ ...ends[0], track: 4 }, road, placed, { left: 1.5, right: 1.5 })!
  check(same(inner.cutTracks, [5, 6, 7]), 'leaving an inner lane: the line and the outer lane it crosses open too')
  check(laneEndWords(road, ends[0]) === 'outer right lane' && laneEndWords(road, { ...ends[0], track: 4 }) === 'inner right lane', 'which lane, in words: the outer right lane, the inner right lane')
  check(laneEndWords(road, { ...ends[0], track: 0 }) === 'outer left lane', '…the outer left lane across the median, whichever side the end came from')
  const twoWay = { id: 5, line: [[0, 0], [50, 0]] as Point[], lanes: lanePreset('two-way') }
  check(laneEndWords(twoWay, { track: 2, s: 10 }) === 'right lane' && laneEndWords(twoWay, { track: 0, s: 10 }) === 'left lane', '…the right lane and the left of a lane each way')
  check(laneEndWords({ id: 6, line: [[0, 0], [50, 0]] as Point[], lanes: lanePreset('shared') }, { track: 0, s: 10 }) === 'lane', '…a one-lane road’s lane')
  const threeWide = { id: 7, line: [[0, 0], [50, 0]] as Point[], lanes: lanePreset('divided') }
  const wider = { ...threeWide, lanes: withPartAt(withPartAt(threeWide.lanes, 7, { kind: 'lane', width: 3, dir: 'with' }), 7, { kind: 'line', width: 1, style: 'dashed' }) }
  check(laneEndWords(wider, { track: 6, s: 10 }) === '2nd right lane from the kerb', '…and the middle one of three, counted from the kerb')

  // Across to the far lane: the median opens, and the road's line crossed on the way is no junction and no bridge.
  const across = { id: 4, kind: 'street' as const, line: [[40, -6.5], [60, 20]] as Point[], shape: 'straight' as const, corners: [], lanes: null }
  const far = laneEndsOf([road, across])
  check(far.length === 1 && far[0].track === 0 && far[0].side === 1, 'a turn into the far lane, from the right')
  check(same(laneMouth(far[0], road, across, { left: 1.5, right: 1.5 })!.cutTracks, [1, 2, 3, 4, 5, 6, 7]), '…opening the median and the near carriageway as it crosses')
  check(crossingsOf(across, [road]).length === 0 && overpassesOf([road, across]).length === 0, '…its crossing of the road’s line no junction offered, and no bridge')

  // The road changed: the slip road's end follows its lane.
  const widened = { ...road, lanes: withWidth(withWidth(withWidth(withWidth(divided, 0, 4), 2, 4), 4, 4), 6, 4) }
  const followed = followLaneEnds(road, widened, [placed])
  check(followed.length === 1 && same(followed[0].line[0], [40, 8]), 'the road’s lanes widened: the slip road’s end follows the outer lane')
  const added = { ...road, lanes: withPartAt(withPartAt(divided, 7, { kind: 'lane', width: 3, dir: 'with' }), 7, { kind: 'line', width: 1, style: 'dashed' }) }
  check(same(followLaneEnds(road, added, [placed])[0]?.line[0], [40, 8.5]), '…a lane added outside it: to the new outer lane, as many in from its side as before')
  check(followLaneEnds(road, widened, [placed], () => false).length === 0, '…unless the slip road isn’t the drawer’s to change')
}

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
