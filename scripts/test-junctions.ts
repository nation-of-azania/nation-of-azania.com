/**
 * Junctions on Azania Maps (src/maps/junctions.ts), checked without a
 * browser: a street across another offered as a junction and put into
 * both (the 3 × 3 grid: one street from 2×1 to 2×3, a new one from 1×2 to
 * 3×2, a node at 2×2), or turned off and drawn as a bridge; a street ending
 * on another (a T); a crossing next to a node taking the node; a road over
 * a canal not offered; curves crossing and keeping their bends; a node
 * dragged taking the other road's point along, unless that road isn't the
 * drawer's to change; nodes and bridges as the map draws them.
 *
 *   pnpm test:junctions
 */
import { roadCourse, type Point } from '../src/maps/geo'
import {
  crossingKey,
  crossingsOf,
  followMoves,
  junctionsOf,
  overpassesOf,
  sharedInto,
  snapToRoads,
  withJunctions,
  type JunctionRoad,
} from '../src/maps/junctions'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}
const same = (a: Point[], b: Point[]) => JSON.stringify(a) === JSON.stringify(b)
const road = (id: number, line: Point[], kind: JunctionRoad['kind'] = 'street', shape: JunctionRoad['shape'] = 'straight', corners: number[] = []): JunctionRoad => ({ id, kind, line, shape, corners })

// The grid, ten blocks to a square: a street from 2×1 to 2×3 is there; one from 1×2 to 3×2 is drawn.
const north = road(1, [[20, 10], [20, 30]])
const drawn = { kind: 'street' as const, line: [[10, 20], [30, 20]] as Point[], shape: 'straight' as const, corners: [] }
const [cross] = crossingsOf(drawn, [north])
check(crossingsOf(drawn, [north]).length === 1 && same([cross.at], [[20, 20]]), 'the grid: one crossing, at 2×2')
check(cross.joins && !cross.existing && !cross.shared && cross.index === 1, '…offered as a junction, a new point between the two')
const joined = withJunctions(drawn, [cross])
check(same(joined.line, [[10, 20], [20, 20], [30, 20]]), '…which the new street takes')
const into = sharedInto({ id: 2, line: joined.line }, [north])
check(into.length === 1 && into[0].id === 1 && same(into[0].line, [[20, 10], [20, 20], [30 - 10, 30]]), '…and the server gives the other street too')
const grid = [road(1, into[0].line), road(2, joined.line)]
check(junctionsOf(grid).length === 1 && same([junctionsOf(grid)[0].at], [[20, 20]]), 'the map finds the node both share')
check(overpassesOf(grid).length === 0, '…and no bridge there')
check(sharedInto(road(2, joined.line), [road(1, into[0].line)]).length === 0, 'saving again changes nothing')
check(crossingsOf({ ...drawn, id: 2, line: joined.line }, [road(1, into[0].line)])[0]?.shared === true, 'drawn again, the crossing shows as a junction already')

// Turned off: an underpass.
const under = [north, road(2, drawn.line)]
check(sharedInto(road(2, drawn.line), [north]).length === 0, 'turned off: no point, nothing shared')
const [bridge] = overpassesOf(under)
check(overpassesOf(under).length === 1 && same([bridge.at], [[20, 20]]) && bridge.over === 2, '…a bridge at 2×2, the later street over')
check(overpassesOf([road(1, north.line, 'main'), road(2, drawn.line)])[0]?.over === 1, 'a main road passes over a street, whichever came first')
check(crossingKey(cross) === '1@20,20', 'a crossing keeps its name while the road is drawn on')

// A T: a street drawn to end on another, half a block off it.
const tee = { kind: 'street' as const, line: [[10, 20], [20.5, 20]] as Point[], shape: 'straight' as const, corners: [] }
const snapped = snapToRoads(tee, [north])
check(same(snapped, [[10, 20], [20, 20]]), 'a T: the end half a block off the street is set on it')
const teeCrossings = crossingsOf({ ...tee, line: snapped }, [north])
check(teeCrossings.length === 1 && teeCrossings[0].existing && teeCrossings[0].joins, '…a junction at its end')
check(same(sharedInto({ id: 3, line: snapped }, [north])[0]?.line ?? [], [[20, 10], [20, 20], [20, 30]]), '…which the street it ends on takes')
check(same(snapToRoads({ line: [[10, 20], [12, 25]] }, [north]), [[10, 20], [12, 25]]), 'a point far from any road stays where it is')

// Near a node already there: the node, not a second one beside it.
const bent = road(4, [[20, 10], [20, 21.5], [20, 30]])
const [nearNode] = crossingsOf(drawn, [bent])
check(same([nearNode.at], [[20, 21.5]]), 'a crossing a block and a half from a node takes the node')
check(sharedInto({ id: 2, line: withJunctions(drawn, [nearNode]).line }, [bent]).length === 0, '…so the other road needs nothing')

// Networks.
const canal = road(5, [[20, 10], [20, 30]], 'canal')
const [overWater] = crossingsOf(drawn, [canal])
check(overWater && !overWater.joins, 'a street over a canal: not offered as a junction')
check(overpassesOf([canal, road(2, drawn.line)])[0]?.over === 2, '…the street passes over')
const rail = road(6, [[20, 10], [20, 30]], 'rail')
check(crossingsOf({ ...drawn, kind: 'rail' }, [rail])[0]?.joins === true, 'two railways: offered')
check(crossingsOf(drawn, [road(7, [[20, 10], [20, 30]], 'highway')])[0]?.joins === true, 'a street across a national road: offered (one network)')

// Curves.
const arc = road(8, [[0, 0], [20, 15], [40, 0]], 'main', 'curved')
const across = { kind: 'street' as const, line: [[10, -10], [10, 30]] as Point[], shape: 'straight' as const, corners: [] }
const arcCrossings = crossingsOf(across, [arc])
check(arcCrossings.length === 1, 'a straight street across a curved road: one crossing')
const arcJoined = withJunctions(across, arcCrossings)
const [arcShared] = sharedInto({ id: 9, line: arcJoined.line }, [arc])
check(arcShared?.line.length === 4 && arcShared.line.some((p) => p[0] === arcCrossings[0].at[0] && p[1] === arcCrossings[0].at[1]), '…the curve takes the node as a point it bends through')
const before = roadCourse(arc.line, 'curved')
const after = roadCourse(arcShared.line, 'curved')
const drift = Math.max(...after.map((p) => Math.min(...before.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])))))
check(drift < 1.5, `…and its bend hardly moves (at most ${drift.toFixed(2)} blocks)`)
const curvedDrawn = { kind: 'street' as const, line: [[10, -10], [12, 10], [10, 30]] as Point[], shape: 'curved' as const, corners: [1] }
const curvedJoined = withJunctions(curvedDrawn, crossingsOf(curvedDrawn, [road(10, [[0, 5], [30, 5]])]))
check(curvedJoined.line.length === 4 && same([[curvedJoined.corners[0], 0]], [[2, 0]]), 'a curved road takes a node, and its sharp corner moves along')

// A node dragged.
const shared = [road(1, [[20, 10], [20, 20], [20, 30]])]
const moved = followMoves([[10, 20], [20, 20], [30, 20]], [[10, 20], [22, 20], [30, 20]], shared)
check(moved.length === 1 && same(moved[0].line, [[20, 10], [22, 20], [20, 30]]), 'a node dragged takes the other road’s point along')
check(followMoves([[10, 20], [20, 20], [30, 20]], [[10, 20], [22, 20], [30, 20]], shared, () => false).length === 0, '…unless the other road isn’t the drawer’s to change')
check(followMoves([[10, 20], [20, 20], [30, 20]], [[10, 20], [30, 20]], shared).length === 0, 'a point taken away takes nothing with it')

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
