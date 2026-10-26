/**
 * The names' hand-over and their placing mid-gesture, checked without a
 * browser: the bezier tables read the curves they stand for, a tween reads
 * right at its edges and through its delay, where a name stands comes out
 * the same whether reckoned through placementOf or through the alignments
 * composed by hand and doesn't move at all when the map re-bases across
 * the world's seam; the grid agrees with a plain search over every box,
 * the pass with no hysteresis places exactly what the plan's placer
 * would, a shown name holds its spot against a lesser one, a hidden name
 * waits for room, a zoom wobbling about a tier flips nothing, and ten
 * thousand passes leave the heap as they found it.
 *
 *   pnpm test:names
 *
 * Everything under test is pure (src/components/maps/leaflet/tweens.ts,
 * placing.ts, the spot arithmetic in names.ts and the frames in
 * overlay.ts), so this runs in Node as it is.
 */
import { LabelPlacer, type Rect } from '../src/components/maps/layers/projection'
import { NAMES, spotOf } from '../src/components/maps/leaflet/names'
import { alignment, placementOf, shownAt, type Frame, type Placement } from '../src/components/maps/leaflet/overlay'
import {
  decide,
  entry,
  Grid,
  HIDE,
  NONE,
  SHOW,
  type Entry,
  type Keep,
  type Moment,
  type Params,
} from '../src/components/maps/leaflet/placing'
import { bezier, done, EASE_OUT, GLIDE_EASE, valueAt, type Tween } from '../src/components/maps/leaflet/tweens'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}
const near = (a: number, b: number, within: number) => Math.abs(a - b) <= within

// The exact curve, for the tables to be held against: t for x by a long bisection, then y.
function exact(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t
  return (x) => {
    let low = 0
    let high = 1
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2
      if (at(x1, x2, mid) < x) low = mid
      else high = mid
    }
    return at(y1, y2, (low + high) / 2)
  }
}

// The bezier tables.
for (const [name, points] of [
  ['the glide', [0.2, 0, 0, 1]],
  ['ease-out', [0, 0, 0.58, 1]],
  ['ease-in-out', [0.42, 0, 0.58, 1]],
  ['ease', [0.25, 0.1, 0.25, 1]],
] as const) {
  const [x1, y1, x2, y2] = points
  const table = bezier(x1, y1, x2, y2)
  const curve = exact(x1, y1, x2, y2)
  let worst = 0
  for (let i = 0; i <= 2000; i++) {
    const x = i / 2000
    worst = Math.max(worst, Math.abs(table(x) - curve(x)))
  }
  check(worst <= 0.002, `${name}'s table is within 0.002 of the curve (worst ${worst.toFixed(5)})`)
  check(table(0) === 0 && table(1) === 1 && table(-1) === 0 && table(2) === 1, `${name} is 0 at 0 and 1 at 1, and clamps beyond`)
}
check(GLIDE_EASE(0.5) > 0.5 && EASE_OUT(0.5) > 0.5, 'the glide and ease-out are both ahead of time at the half-way mark')

// A tween at its edges and through its delay.
const tween: Tween = { from: 2, to: 6, start: 1000, duration: 200, delay: 70, ease: EASE_OUT }
check(valueAt(tween, 900) === 2 && valueAt(tween, 1000) === 2 && valueAt(tween, 1069) === 2, 'a tween holds its start until its delay is up')
check(valueAt(tween, 1270) === 6 && valueAt(tween, 5000) === 6, 'a tween holds its end once landed')
check(valueAt(tween, 1170) > 2 && valueAt(tween, 1170) < 6, 'a tween is on its way half-way through')
check(!done(tween, 1269) && done(tween, 1270), 'done turns exactly as the tween lands')
const instant: Tween = { ...tween, duration: 0 }
check(valueAt(instant, 1069) === 2 && valueAt(instant, 1070) === 6 && done(instant, 1070), 'a tween of no duration lands as its delay is up')
const part = NAMES.ARRIVE.duration * (1 - 0.6)
check(near(part, 88, 1e-9), `a fade from 0.6 takes ${part} ms of the ${NAMES.ARRIVE.duration}`)

// Frames: plain points stand for Leaflet's, since only x and y are read.
const frame = (zoom: number, x: number, y: number): Frame => ({ zoom, origin: { x, y } as Frame['origin'] })
const apply = (p: Placement, x: number, y: number) => ({ x: p.k * x + p.x, y: p.k * y + p.y })

// Where a name stands, through placementOf and by hand.
{
  const drawn = frame(-6, 1000, 2000)
  const view = frame(-6.4, 700, 1500)
  const anchor = { x: 340.5, y: 212.25 }
  const centre = { x: 352.5, y: 198.25 }
  const shown = { frame: view, eased: { k: 1.1, x: -20, y: 15 } }
  const through = spotOf(anchor, centre, placementOf(drawn, shown))
  // By hand: the drawn frame aligned to the view, then the view's own easing.
  const a = alignment(drawn, view)
  const moved = apply(a, anchor.x, anchor.y)
  const eased = apply(shown.eased, moved.x, moved.y)
  const byHand = { x: eased.x + (centre.x - anchor.x), y: eased.y + (centre.y - anchor.y) }
  check(near(through.x, byHand.x, 1e-9) && near(through.y, byHand.y, 1e-9), 'a spot through placementOf equals the alignments composed by hand')
  const still = spotOf(anchor, centre, placementOf(drawn, shownAt(drawn)))
  check(near(still.x, centre.x, 1e-12) && near(still.y, centre.y, 1e-12), 'shown at its own frame, a name stands at its box')
  const shifted = spotOf(anchor, centre, placementOf(drawn, shownAt(drawn)), { x: 3, y: -4 })
  check(near(shifted.x, centre.x + 3, 1e-12) && near(shifted.y, centre.y - 4, 1e-12), 'its own shift is added as it is')
}

// A re-basing across the seam: the drawn frame and the view both shift a world over, and nothing moves.
{
  const worldPx = 2304
  for (const [drawnZoom, viewZoom] of [
    [-6, -6],
    [-6, -6.4],
    [-5.5, -6],
  ]) {
    const drawn = frame(drawnZoom, 1000, 2000)
    const view = frame(viewZoom, 700, 1500)
    const scale = 2 ** (viewZoom - drawnZoom)
    const anchor = { x: 340.5, y: 212.25 }
    const centre = { x: 352.5, y: 198.25 }
    const before = spotOf(anchor, centre, placementOf(drawn, shownAt(view)))
    // leaflet/canvas.tsx → settle(rebase): the drawn origin moves by the shift in its own pixels; the view's by the shift.
    const drawnAfter = frame(drawnZoom, drawn.origin.x - worldPx / scale, drawn.origin.y)
    const viewAfter = frame(viewZoom, view.origin.x - worldPx, view.origin.y)
    const after = spotOf(anchor, centre, placementOf(drawnAfter, shownAt(viewAfter)))
    check(near(before.x, after.x, 1e-9) && near(before.y, after.y, 1e-9), `a re-based frame gives a delta of 0 (drawn ${drawnZoom}, view ${viewZoom})`)
  }
}

// The hand-over's numbers, as the brief has them.
check(NAMES.GLIDE.duration === 260 && NAMES.LEAVE.duration === 160 && NAMES.ARRIVE.duration === 220 && NAMES.ARRIVE.delay === 70, 'glide 260, leave 160, arrive 220 after 70')
check(NAMES.FARTHEST === 140 && NAMES.STILL === 0.75 && NAMES.ABSENT === 0.02 && NAMES.ECHO === 0.55, 'farthest 140 px, still 0.75 px, absent 0.02, echo 0.55')
check(
  NAMES.LIVE.glide.duration === 200 && NAMES.LIVE.leave.duration === 160 && NAMES.LIVE.arrive.duration === 220 && NAMES.LIVE.evictDelay === 70,
  'mid-gesture: glide 200, leave 160, arrive 220, an evictor after 70',
)
check(
  NAMES.LIVE.slack === 2 && NAMES.LIVE.room === 4 && NAMES.LIVE.yield === 80 && NAMES.LIVE.dwell === 240 && NAMES.LIVE.free === 120 && NAMES.LIVE.band === 0.1,
  'slack 2 px, room 4 px, yield 80, dwell 240, free 120, band 0.1',
)

// A small deterministic random, so a failing set can be had again.
let seed = 20261026
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const quarter = (n: number) => Math.round(n * 4) / 4

// The grid against a plain search over every box: blocked, free and blockers on random sets.
{
  const grid = new Grid()
  let agree = 0
  let trials = 0
  for (let trial = 0; trial < 10000; trial++) {
    const n = 1 + Math.floor(random() * 40)
    const boxes: number[][] = []
    grid.reset(-80, -60, 900, 700)
    for (let i = 0; i < n; i++) {
      const x0 = quarter(random() * 1000 - 100)
      const y0 = quarter(random() * 800 - 100)
      const box = [x0, y0, x0 + quarter(10 + random() * 150), y0 + quarter(6 + random() * 30)]
      boxes.push(box)
      grid.add(i, box[0], box[1], box[2], box[3])
    }
    const qx0 = quarter(random() * 1000 - 100)
    const qy0 = quarter(random() * 800 - 100)
    const q = [qx0, qy0, qx0 + quarter(10 + random() * 150), qy0 + quarter(6 + random() * 30)]
    const slack = [0, 2, 4][trial % 3]
    const room = [0, 4, 8][trial % 3]
    const hits = (b: number[], s: number) => Math.min(q[2], b[2]) - Math.max(q[0], b[0]) > s && Math.min(q[3], b[3]) - Math.max(q[1], b[1]) > s
    const expectBlocked = boxes.some((b) => hits(b, slack))
    const grown = [q[0] - room, q[1] - room, q[2] + room, q[3] + room]
    const expectFree = !boxes.some((b) => Math.min(grown[2], b[2]) - Math.max(grown[0], b[0]) > 0 && Math.min(grown[3], b[3]) - Math.max(grown[1], b[1]) > 0)
    const expectBlockers = boxes.map((b, i) => (hits(b, slack) ? i : -1)).filter((i) => i >= 0)
    const out = new Int32Array(64)
    const blocked = grid.blocked(q[0], q[1], q[2], q[3], slack)
    const free = grid.free(q[0], q[1], q[2], q[3], room)
    const count = grid.blockers(q[0], q[1], q[2], q[3], slack, out)
    const got = [...out.subarray(0, count)].sort((a, b) => a - b)
    trials++
    if ((blocked >= 0) === expectBlocked && (blocked < 0 || hits(boxes[blocked], slack)) && free === expectFree && JSON.stringify(got) === JSON.stringify(expectBlockers)) agree++
  }
  check(agree === trials, `the grid agrees with a search over every box on ${agree} of ${trials} random sets`)
}

const PAGE: Moment = { now: 1000, k: 1, x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, zoom: -5 }
const NO_WAIT: Params = { slack: 0, room: 0, yield: 0, dwell: 0, free: 0, back: 0, band: 0, evictDelay: 0, margin: 12, pad: 0.6, width: 24 }
const LIVE: Params = { ...NAMES.LIVE, margin: NAMES.LIVE.clamp.margin, pad: NAMES.LIVE.clamp.pad, width: NAMES.LIVE.clamp.width }

/** An entry drawn at its first candidate, with the others as offsets from it. */
function named(candidates: Rect[], rank: number, fields: Partial<Entry> = {}): Entry {
  const first = candidates[0]
  const spots = new Float64Array(candidates.length * 2)
  candidates.forEach((c, i) => {
    spots[2 * i] = c.x - first.x
    spots[2 * i + 1] = c.y - first.y
  })
  return entry({ ax: first.x + first.width / 2, ay: first.y + first.height / 2, bx: first.x, by: first.y, bw: first.width, bh: first.height, spots, rank, ...fields })
}

const byRank = (entries: Entry[]) => entries.map((_, i) => i).sort((a, b) => entries[a].rank - entries[b].rank)

// With no hysteresis, everything hidden and the boxes frozen, the pass places exactly what the plan's placer would.
{
  let same = 0
  const trials = 300
  for (let trial = 0; trial < trials; trial++) {
    const keeps: Keep[] = []
    for (let i = 0; i < 3 + Math.floor(random() * 6); i++) {
      const x = quarter(random() * 760)
      const y = quarter(random() * 560)
      keeps.push({ ax: x + 10, ay: y + 10, x, y, w: 20, h: 20 })
    }
    const entries: Entry[] = []
    const candidatesOf: Rect[][] = []
    const n = 10 + Math.floor(random() * 50)
    for (let i = 0; i < n; i++) {
      const cx = quarter(random() * 760)
      const cy = quarter(random() * 560)
      const w = quarter(30 + random() * 90)
      const h = quarter(12 + random() * 8)
      const count = 1 + Math.floor(random() * 4)
      const candidates: Rect[] = []
      // Every candidate on the page: a name whose spot is off the page is left as it is by the pass, placed or not.
      for (let c = 0; c < count; c++)
        candidates.push({ x: Math.min(800 - w, Math.max(0, cx + quarter((random() - 0.5) * 2 * w))), y: Math.min(600 - h, Math.max(0, cy + quarter((random() - 0.5) * 3 * h))), width: w, height: h })
      candidatesOf.push(candidates)
      entries.push(named(candidates, i, { drawnHidden: true, shown: false }))
    }
    const placer = new LabelPlacer()
    for (const keep of keeps) placer.claim({ x: keep.x, y: keep.y, width: keep.w, height: keep.h })
    const expected = candidatesOf.map((candidates) => {
      const spot = placer.tryPlace(candidates)
      return spot ? candidates.indexOf(spot) : -1
    })
    decide(entries, byRank(entries), keeps, new Grid(), PAGE, NO_WAIT)
    const got = entries.map((e) => (e.shown ? e.spot : -1))
    const changes = entries.every((e) => (e.shown ? e.change === SHOW : e.change === NONE))
    if (JSON.stringify(got) === JSON.stringify(expected) && changes) same++
  }
  check(same === trials, `the pass with no hysteresis places what the placer places, on ${same} of ${trials} random plans`)
}

// A shown name keeps its spot against a lower-ranked overlapper, which steps aside or goes.
{
  const box = (x: number, y: number): Rect => ({ x, y, width: 100, height: 20 })
  const first = named([box(100, 100), box(100, 130)], 0)
  const second = named([box(150, 105), box(150, 200)], 1)
  const third = named([box(120, 95)], 2)
  const entries = [first, second, third]
  const grid = new Grid()
  // The first frame: the yield hasn't run, so the lesser two hold where they are.
  decide(entries, byRank(entries), [], grid, { ...PAGE, now: 1000 }, LIVE)
  check(first.change === NONE && second.change === NONE && third.change === NONE && entries.every((e) => e.shown), 'blocked names hold their spots until the yield is up')
  decide(entries, byRank(entries), [], grid, { ...PAGE, now: 1000 + LIVE.yield + LIVE.dwell + 1 }, LIVE)
  check(first.change === NONE && first.shown && first.spot === 0, 'the first name keeps its spot')
  check(second.shown && second.spot === 1, 'the second, blocked by the first, steps to its other spot')
  check(!third.shown && third.change === HIDE, 'the third, with nowhere free, gives way')
}

// A hidden name never enters with less than 4 px of room; with room it enters once the spot has been free long enough.
{
  const box = (x: number, y: number): Rect => ({ x, y, width: 100, height: 20 })
  const shown = named([box(100, 100)], 0)
  const tight = named([box(203, 100)], 1, { drawnHidden: true, shown: false })
  const roomy = named([box(205, 100)], 2, { drawnHidden: true, shown: false })
  const entries = [shown, tight, roomy]
  const grid = new Grid()
  decide(entries, byRank(entries), [], grid, { ...PAGE, now: 1000 }, LIVE)
  check(!tight.shown && !roomy.shown, 'a hidden name waits for its spot to have been free a while')
  decide(entries, byRank(entries), [], grid, { ...PAGE, now: 1000 + LIVE.free }, LIVE)
  check(!tight.shown, 'a hidden name with 3 px of room never enters')
  check(roomy.shown && roomy.change === SHOW, 'one with 5 px of room enters once the spot has been free long enough')
}

// A name that gave way comes back only once its spot has been free a good while longer than a reserve needs.
{
  const box = (x: number, y: number): Rect => ({ x, y, width: 100, height: 20 })
  const gone = named([box(100, 100)], 0, { shown: false, changedAt: 0 })
  const reserve = named([box(300, 100)], 1, { drawnHidden: true, shown: false, changedAt: 0 })
  const entries = [gone, reserve]
  const grid = new Grid()
  decide(entries, byRank(entries), [], grid, { ...PAGE, now: 1000 }, LIVE)
  decide(entries, byRank(entries), [], grid, { ...PAGE, now: 1000 + LIVE.free }, LIVE)
  check(reserve.shown && !gone.shown, 'the reserve is in once its spot has been free a while; the name that gave way waits on')
  decide(entries, byRank(entries), [], grid, { ...PAGE, now: 1000 + LIVE.back }, LIVE)
  check(gone.shown && gone.change === SHOW, `and comes back once it has been free ${LIVE.back} ms`)
}

// A name that has only just come in stays its dwell, though the zoom slips past its band meanwhile.
{
  const box = (x: number, y: number): Rect => ({ x, y, width: 100, height: 20 })
  const nation = named([box(100, 100)], 0, { from: -5.5, until: -3.25, drawnHidden: true, shown: false, changedAt: 0 })
  const entries = [nation]
  const grid = new Grid()
  decide(entries, [0], [], grid, { ...PAGE, now: 1000, zoom: -5.3 }, LIVE)
  decide(entries, [0], [], grid, { ...PAGE, now: 1000 + LIVE.free, zoom: -5.3 }, LIVE)
  check(nation.shown, 'a reserve whose zoom has come comes in')
  decide(entries, [0], [], grid, { ...PAGE, now: 1000 + LIVE.free + 50, zoom: -5.7 }, LIVE)
  check(nation.shown, 'and stays a moment though the zoom has slipped back past its band')
  decide(entries, [0], [], grid, { ...PAGE, now: 1000 + LIVE.free + LIVE.dwell, zoom: -5.7 }, LIVE)
  check(!nation.shown && nation.change === HIDE, 'then goes, its dwell up')
}

// A hidden name never comes in where a name the plan placed above it stands as drawn, though it has stepped aside.
{
  const box = (x: number, y: number): Rect => ({ x, y, width: 100, height: 20 })
  // The first name was drawn at its first spot and has stepped to its second; the second name's only spot is the
  // room the first was given; the third's is where the first stands now; the fourth's is free of both.
  const first = named([box(100, 100), box(100, 200)], 0, { spot: 1, changedAt: 0 })
  const second = named([box(110, 102)], 1, { drawnHidden: true, shown: false })
  const third = named([box(110, 202)], 2, { drawnHidden: true, shown: false })
  const fourth = named([box(400, 400)], 3, { drawnHidden: true, shown: false })
  const entries = [first, second, third, fourth]
  decide(entries, byRank(entries), [], new Grid(), PAGE, NO_WAIT)
  check(first.shown && first.spot === 1 && first.change === NONE, 'a name that stepped aside stays where it is')
  check(!second.shown, 'a hidden name takes no room the plan gave a name above it, though that name has stepped aside')
  check(!third.shown, 'nor the room a name above it stands in now')
  check(fourth.shown && fourth.change === SHOW, 'and comes in where neither is')
  // A reserve above it claims nothing: the plan drew it hidden.
  const held = named([box(100, 300)], 0, { drawnHidden: true, shown: false })
  const under = named([box(110, 302)], 1, { drawnHidden: true, shown: false })
  const pair = [held, under]
  decide(pair, byRank(pair), [], new Grid(), PAGE, NO_WAIT)
  check(held.shown && !under.shown, 'a reserve above it claims nothing of its own; the two are placed by rank as the placer would')
}

// A zoom wobbling ±0.05 about a tier flips nothing; one swinging ±0.2 flips once each way, no more.
{
  const run = (amp: number) => {
    const box = (x: number, y: number): Rect => ({ x, y, width: 100, height: 20 })
    const nation = named([box(100, 100)], 0, { from: -5.5, until: -3.25 })
    const entries = [nation]
    const grid = new Grid()
    let flips = 0
    let was = nation.shown
    for (let f = 0; f < 600; f++) {
      const now = 1000 + f * 16
      const zoom = -5.5 + amp * Math.sin((f / 600) * 4 * Math.PI)
      decide(entries, [0], [], grid, { ...PAGE, now, zoom }, LIVE)
      if (nation.shown !== was) {
        flips++
        was = nation.shown
      }
    }
    return flips
  }
  check(run(0.05) === 0, 'a zoom wobbling ±0.05 about a tier flips nothing')
  const wide = run(0.2)
  check(wide >= 2 && wide <= 4, `a zoom swinging ±0.2 about a tier twice flips at most once each way (${wide})`)
}

// A zoom wobbling ±0.25 about a level twice a second, two names crowding at its far end: after the first half
// second each flips at most once more, since a name that gave way waits longer than a wobble to come back.
{
  const box = (x: number, y: number, w = 100): Rect => ({ x, y, width: w, height: 20 })
  // Their anchors 110 px apart about the page's middle: at a fifth smaller the boxes meet by a dozen px.
  const left = named([box(345, 290)], 0)
  const right = named([box(455, 290)], 1)
  const entries = [left, right]
  for (const e of entries) {
    e.ax = 400
    e.ay = 300
  }
  const grid = new Grid()
  let flips = 0
  let was = right.shown
  for (let f = 0; f < 180; f++) {
    const now = 1000 + f * 16.7
    const dz = 0.25 * Math.sin(4 * Math.PI * (f * 16.7) / 1000)
    const k = 2 ** dz
    // The ground scaled about the page's middle, as a zoom there would: the names' anchors carried with it.
    decide(entries, byRank(entries), [], grid, { ...PAGE, now, k, x: 400 - 400 * k, y: 300 - 300 * k, zoom: -6 + dz }, LIVE)
    if (f * 16.7 >= 500 && right.shown !== was) flips++
    was = right.shown
  }
  check(left.shown && flips <= 1, `the lesser of two names crowding in a wobble flips at most once after the first half second (${flips})`)
}

// A nation's name is kept on the page: its correction follows its heart as the page moves.
{
  const box = (x: number, y: number): Rect => ({ x, y, width: 100, height: 20 })
  const nation = named([box(50, 100)], 0, { hx: 100, hy: 110 })
  const entries = [nation]
  const grid = new Grid()
  decide(entries, [0], [], grid, { ...PAGE, x: -70 }, LIVE)
  // The heart at 30 on the page: the name's middle is held 12 + 50 from the left edge, at 62, rather than at 30.
  check(near(nation.left + nation.cx + nation.bw / 2, 62, 1e-9), `a name whose heart is near the edge keeps its distance from it (middle at ${(nation.left + nation.cx + nation.bw / 2).toFixed(1)})`)
  decide(entries, [0], [], grid, { ...PAGE, x: 0 }, LIVE)
  check(nation.cx === 0, 'and needs no correction where the plan put it')
}

// Ten thousand passes over a hundred names, and the heap is as it was.
{
  const entries: Entry[] = []
  for (let i = 0; i < 100; i++) {
    const cx = quarter(random() * 760)
    const cy = quarter(random() * 560)
    const candidates: Rect[] = [0, 1, 2, 3].map((c) => ({ x: cx + (c % 2) * 60, y: cy + Math.floor(c / 2) * 24, width: 90, height: 18 }))
    entries.push(named(candidates, i, { drawnHidden: i % 3 === 0, shown: i % 3 !== 0, hx: i % 5 === 0 ? cx : NaN, hy: i % 5 === 0 ? cy : NaN }))
  }
  const keeps: Keep[] = []
  for (let i = 0; i < 20; i++) keeps.push({ ax: i * 37, ay: i * 23, x: i * 37 - 10, y: i * 23 - 10, w: 20, h: 20 })
  const order = byRank(entries)
  const grid = new Grid()
  const gc = (globalThis as { gc?: () => void }).gc
  for (let f = 0; f < 200; f++) decide(entries, order, keeps, grid, { ...PAGE, now: 1000 + f * 16, k: 1 + (f % 50) / 100, x: -f, y: -f / 2 }, LIVE)
  gc?.()
  const before = process.memoryUsage().heapUsed
  for (let f = 0; f < 10000; f++) decide(entries, order, keeps, grid, { ...PAGE, now: 5000 + f * 16, k: 1 + (f % 50) / 100, x: -(f % 300), y: -(f % 200) / 2 }, LIVE)
  gc?.()
  const grown = process.memoryUsage().heapUsed - before
  check(gc !== undefined, 'the heap can be collected on demand (NODE_OPTIONS=--expose-gc)')
  check(grown <= 256 * 1024, `ten thousand passes grow the heap by ${(grown / 1024).toFixed(0)} kB, within 256`)
}

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
