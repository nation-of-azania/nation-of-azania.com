/*
 * Where the names at a point stand while the map moves (./names.ts): the
 * plan decides which names fit, and where, once per drawn view
 * (layers/labels.ts), but a zoom carries the names apart and together
 * between one plan and the next, so mid-gesture the names are placed
 * again every frame, by the plan's own rank, with hysteresis so that
 * nothing twitches. A name that is shown keeps its spot while nothing
 * truly needs the room; blocked for a while, it steps to another of its
 * spots, or gives way; a name held in reserve comes in once a spot has
 * been free for a while; and a name of a better class (Azania's before
 * the world's, the real world's before an echo's) may send a worse one
 * away, which fades out as the better one fades in. Every change waits a
 * moment after the last, so a name settles rather than hops.
 *
 * Pure arithmetic over plain records and typed arrays, with no DOM, so
 * it runs in Node for the tests (scripts/test-names.ts) as in the
 * browser. Nothing here allocates per frame: the grid is rebuilt in
 * place, a box is reckoned into scratch numbers, and a decision is a flag
 * on its entry that the caller reads and clears.
 */

/** A grid cell's side, in px: a name is a cell or two across, so a query touches a few cells. */
export const CELL = 64

/**
 * A spatial grid of boxes, rebuilt each frame: the page cut into cells,
 * each a chain of the boxes that touch it, so a name's box is tested
 * against its neighbours alone. A box is known by the index its owner
 * gives it, and is visited once per query however many cells it spans.
 */
export class Grid {
  private cell: number
  private left = 0
  private top = 0
  private cols = 0
  private rows = 0
  /** The first link of each cell's chain, or −1. */
  private heads = new Int32Array(0)
  /** Per link: the box it names, and the next link in its cell. */
  private links = new Int32Array(256)
  private next = new Int32Array(256)
  private count = 0
  /** Per box index: its edges, and the query that last visited it. */
  private boxes = new Float64Array(4 * 128)
  private stamps = new Uint32Array(128)
  private query = 0

  constructor(cell = CELL) {
    this.cell = cell
  }

  /** Empties the grid and lays it over the rectangle, in px. */
  reset(left: number, top: number, right: number, bottom: number): void {
    this.left = left
    this.top = top
    this.cols = Math.max(1, Math.ceil((right - left) / this.cell) + 1)
    this.rows = Math.max(1, Math.ceil((bottom - top) / this.cell) + 1)
    const cells = this.cols * this.rows
    if (this.heads.length < cells) this.heads = new Int32Array(cells)
    this.heads.fill(-1, 0, cells)
    this.count = 0
  }

  private col(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.left) / this.cell)))
  }

  private row(y: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.top) / this.cell)))
  }

  /** Puts box `i` in: every cell it touches gets a link to it. */
  add(i: number, x0: number, y0: number, x1: number, y1: number): void {
    if (i * 4 + 4 > this.boxes.length) {
      const boxes = new Float64Array(Math.max(this.boxes.length * 2, i * 4 + 4))
      boxes.set(this.boxes)
      this.boxes = boxes
      const stamps = new Uint32Array(boxes.length / 4)
      stamps.set(this.stamps)
      this.stamps = stamps
    }
    this.boxes[i * 4] = x0
    this.boxes[i * 4 + 1] = y0
    this.boxes[i * 4 + 2] = x1
    this.boxes[i * 4 + 3] = y1
    const c0 = this.col(x0)
    const c1 = this.col(x1)
    const r0 = this.row(y0)
    const r1 = this.row(y1)
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        if (this.count >= this.links.length) {
          const links = new Int32Array(this.links.length * 2)
          links.set(this.links)
          this.links = links
          const next = new Int32Array(this.next.length * 2)
          next.set(this.next)
          this.next = next
        }
        const cell = r * this.cols + c
        this.links[this.count] = i
        this.next[this.count] = this.heads[cell]
        this.heads[cell] = this.count++
      }
  }

  /** A fresh query, each box seen once in it. */
  private begin(): number {
    if (++this.query === 0xffffffff) {
      this.stamps.fill(0)
      this.query = 1
    }
    return this.query
  }

  /** Whether box `i` overlaps the rectangle by more than `slack` on both axes. */
  private hits(i: number, x0: number, y0: number, x1: number, y1: number, slack: number): boolean {
    const b = this.boxes
    const j = i * 4
    return (
      Math.min(x1, b[j + 2]) - Math.max(x0, b[j]) > slack && Math.min(y1, b[j + 3]) - Math.max(y0, b[j + 1]) > slack
    )
  }

  /** The first box overlapping the rectangle by more than `slack` on both axes, or −1. */
  blocked(x0: number, y0: number, x1: number, y1: number, slack: number): number {
    const q = this.begin()
    const c0 = this.col(x0)
    const c1 = this.col(x1)
    const r0 = this.row(y0)
    const r1 = this.row(y1)
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        for (let link = this.heads[r * this.cols + c]; link >= 0; link = this.next[link]) {
          const i = this.links[link]
          if (this.stamps[i] === q) continue
          this.stamps[i] = q
          if (this.hits(i, x0, y0, x1, y1, slack)) return i
        }
    return -1
  }

  /** Whether the rectangle, grown by `room` on each side, touches nothing at all. */
  free(x0: number, y0: number, x1: number, y1: number, room: number): boolean {
    return this.blocked(x0 - room, y0 - room, x1 + room, y1 + room, 0) < 0
  }

  /**
   * Every box overlapping the rectangle by more than `slack` on both axes,
   * the first of them written into `out`; returns how many there are,
   * which may be more than `out` holds.
   */
  blockers(x0: number, y0: number, x1: number, y1: number, slack: number, out: Int32Array): number {
    const q = this.begin()
    let n = 0
    const c0 = this.col(x0)
    const c1 = this.col(x1)
    const r0 = this.row(y0)
    const r1 = this.row(y1)
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        for (let link = this.heads[r * this.cols + c]; link >= 0; link = this.next[link]) {
          const i = this.links[link]
          if (this.stamps[i] === q) continue
          this.stamps[i] = q
          if (!this.hits(i, x0, y0, x1, y1, slack)) continue
          if (n < out.length) out[n] = i
          n++
        }
    return n
  }
}

/** How a name may yield: its class, 0 first. Forced names and the home name far out are 0, Azania's other names 1, the world's 2. */
export type Klass = 0 | 1 | 2

/** What a decision did to an entry this pass, for the caller to act on: nothing, hidden, shown, or moved. */
export const NONE = 0
export const HIDE = 1
export const SHOW = 2
export const MOVE = 3

/**
 * A name at a point, as the plan drew it and as the pass has it now. The
 * drawn facts come from the attributes the plan writes (layers/projection.ts
 * → named); the decision is the pass's own, kept across frames and reset
 * at each drawing.
 */
export type Entry = {
  /** The point it's held upright about, in the drawn frame's px. */
  ax: number
  ay: number
  /** The box the plan drew it in, in the drawn frame's px. */
  bx: number
  by: number
  bw: number
  bh: number
  /** Each candidate box's offset from the drawn one, two numbers a spot, in candidate order. */
  spots: Float64Array
  /** Which candidate the plan drew. */
  drawnSpot: number
  /** The live zooms it may show in: after `from`, up to `until`. */
  from: number
  until: number
  klass: Klass
  /** The home name alone: at live zooms up to this it's class 0, else its own class. NaN for none. */
  lead: number
  /** Kept whatever the crowd: Azania's sieges, the chosen place or event. */
  force: boolean
  /** A nation's heart, in the drawn frame's px, for keeping its name on the page; NaN for none. */
  hx: number
  hy: number
  /** Drawn in reserve, hidden, for the pass to bring in. */
  drawnHidden: boolean
  /** Whether it stands in an echo of the world, which ranks after the real one. */
  echo: boolean
  rank: number

  // The decision, kept across frames.
  shown: boolean
  spot: number
  changedAt: number
  blockedSince: number
  freeSince: number

  // This pass's reckoning.
  /** The drawn box's corner on the page this frame. */
  left: number
  top: number
  /** The shift that keeps a nation's name on the page, added to wherever it stands, never tweened. */
  cx: number
  cy: number
  onPage: boolean
  cls: number
  /** What this pass did (NONE, HIDE, SHOW or MOVE), and the delay before a fade-in. */
  change: number
  delay: number
}

/** An obstacle names keep off: a pin, a mark, a highlight; its point and its box, in the drawn frame's px. */
export type Keep = { ax: number; ay: number; x: number; y: number; w: number; h: number }

/** The page as the pass sees it this frame: the time, the move the marks are shown by, the page in the shown px, and the live zoom. */
export type Moment = {
  now: number
  k: number
  x: number
  y: number
  left: number
  top: number
  right: number
  bottom: number
  zoom: number
}

/** The hysteresis and the clamp, as ./names.ts → NAMES.LIVE sets them; the tests set the debounces to 0. */
export type Params = {
  slack: number
  room: number
  yield: number
  dwell: number
  free: number
  /** A name that gave way comes back only once its spot has been free this long: longer than `free`, and than a wobble of the fingers. */
  back: number
  band: number
  evictDelay: number
  /** A nation's name kept on the page: the margin from the edge, how far off the page its heart may be, and the room the page must have. */
  margin: number
  pad: number
  width: number
}

/** An entry with its drawn facts filled in and its decision at rest. */
export function entry(fields: Partial<Entry> = {}): Entry {
  return {
    ax: 0,
    ay: 0,
    bx: 0,
    by: 0,
    bw: 0,
    bh: 0,
    spots: new Float64Array([0, 0]),
    drawnSpot: 0,
    from: -99,
    until: 99,
    klass: 2,
    lead: NaN,
    force: false,
    hx: NaN,
    hy: NaN,
    drawnHidden: false,
    echo: false,
    rank: 0,
    shown: true,
    spot: 0,
    changedAt: -1,
    blockedSince: -1,
    freeSince: -1,
    left: 0,
    top: 0,
    cx: 0,
    cy: 0,
    onPage: false,
    cls: 2,
    change: NONE,
    delay: 0,
    ...fields,
  }
}

// The box last reckoned, as scratch: its edges on the page.
let qx0 = 0
let qy0 = 0
let qx1 = 0
let qy1 = 0

/** Reckons entry `e`'s box at spot `s` on the page into the scratch edges. */
function boxOf(e: Entry, s: number): void {
  qx0 = e.left + e.spots[2 * s] - e.spots[2 * e.drawnSpot] + e.cx
  qy0 = e.top + e.spots[2 * s + 1] - e.spots[2 * e.drawnSpot + 1] + e.cy
  qx1 = qx0 + e.bw
  qy1 = qy0 + e.bh
}

const hide = (e: Entry, now: number) => {
  e.shown = false
  e.changedAt = now
  e.blockedSince = e.freeSince = -1
  e.change = HIDE
}

const show = (e: Entry, s: number, delay: number, now: number) => {
  e.shown = true
  e.spot = s
  e.changedAt = now
  e.blockedSince = e.freeSince = -1
  e.change = SHOW
  e.delay = delay
}

const move = (e: Entry, s: number, now: number) => {
  e.spot = s
  e.changedAt = now
  e.blockedSince = e.freeSince = -1
  e.change = MOVE
}

/** Whether `a` ranks below `b` outright: an echo's name below the real world's, else by class. */
const worse = (a: Entry, b: Entry): boolean => (a.echo !== b.echo ? a.echo : a.cls > b.cls)

/** Whether `a` goes before `b` in the pass: the real world's names before an echo's, then by class, then by rank. */
const before = (a: Entry, b: Entry): boolean => (a.echo !== b.echo ? !a.echo : a.cls !== b.cls ? a.cls < b.cls : a.rank < b.rank)

// The blockers of a box, up to this many; more than this and nothing is evicted.
const blockers = new Int32Array(24)

// The plan's claims, when the caller keeps no grid for them.
const spare = new Grid()

/**
 * One pass over the names on the page: which stay, which step aside,
 * which come in. `order` is every entry's index by rank; the grid is
 * rebuilt here from the keeps and the shown names, in the order they
 * take their room, and `claims` from the boxes the plan drew, so a name
 * coming in takes no room the plan gave a name above it. Returns whether
 * any name is waiting on a timer, so the caller keeps passing while the
 * map rests mid-gesture.
 *
 * The first pass goes over the shown names, the real world's before the
 * echoes', class by class, then by rank: a name that's no longer within
 * its zooms goes, once it has had its dwell; one with its spot free of
 * the keeps and of every name before it, or kept whatever the crowd,
 * takes it; one blocked holds for a while (YIELD), and for a while after
 * its last change (DWELL), then steps to its first spot clear of everyone
 * (so that no lesser name has to step aside for it in turn), else to its
 * first spot clear of those before it, or goes. The second pass goes over the hidden
 * names the same way: one that has waited its dwell and found a spot
 * free, with room to spare, for long enough (FREE for a reserve; BACK,
 * longer than a wobble of the fingers, for a name that gave way, which
 * would otherwise come and go with every wobble) comes in; one with no free spot comes in anyway
 * where every name in its way is of a worse class and has had its
 * dwell, sending them away, its fade-in trailing theirs. Either way it
 * comes in only where no name the plan placed above it stands as drawn,
 * though that name may have stepped aside for now: the plan has the last
 * word at the settle, and a name that came in where a better one will go
 * back would only go again. A name that stands off the page is left as
 * it is, in the grid or out of it, until it comes back.
 */
export function decide(entries: Entry[], order: number[], keeps: Keep[], grid: Grid, m: Moment, p: Params, claims: Grid = spare): boolean {
  const { k, x, y, now } = m
  const width = m.right - m.left
  const height = m.bottom - m.top
  grid.reset(m.left - CELL, m.top - CELL, m.right + CELL, m.bottom + CELL)
  claims.reset(m.left - CELL, m.top - CELL, m.right + CELL, m.bottom + CELL)
  const K = keeps.length
  for (let i = 0; i < K; i++) {
    const keep = keeps[i]
    const x0 = keep.x + (k - 1) * keep.ax + x
    const y0 = keep.y + (k - 1) * keep.ay + y
    const x1 = x0 + keep.w
    const y1 = y0 + keep.h
    if (x1 > m.left && x0 < m.right && y1 > m.top && y0 < m.bottom) grid.add(i, x0, y0, x1, y1)
  }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    e.change = NONE
    e.left = e.bx + (k - 1) * e.ax + x
    e.top = e.by + (k - 1) * e.ay + y
    e.cx = 0
    e.cy = 0
    if (!Number.isNaN(e.hx)) {
      // A nation's name, which the plan set about its heart, or kept on the page when the heart's near the
      // edge: the same rule, each frame, about where the heart has got to.
      const hx = k * e.hx + x
      const hy = k * e.hy + y
      const padX = width * p.pad
      const padY = height * p.pad
      const near =
        hx >= m.left - padX && hx <= m.right + padX && hy >= m.top - padY && hy <= m.bottom + padY && width > e.bw + p.width
      const half = e.bw / 2
      const middle = near ? Math.min(m.right - p.margin - half, Math.max(m.left + p.margin + half, hx)) : hx
      e.cx = middle - (k * e.ax + x)
    }
    e.cls = !Number.isNaN(e.lead) && m.zoom <= e.lead ? 0 : e.klass
    boxOf(e, e.spot)
    e.onPage = qx1 > m.left && qx0 < m.right && qy1 > m.top && qy0 < m.bottom
    // Every shown name as it stands, so a name stepping aside can see the lesser names too; one that steps is
    // put in again where it goes, and one that goes keeps its room for this frame, which is conservative.
    if (e.shown && e.onPage) grid.add(K + i, qx0, qy0, qx1, qy1)
    // What the plan drew, as drawn, moved with the ground: the room it gave this name.
    if (!e.drawnHidden) {
      const cx = e.cx
      const cy = e.cy
      e.cx = e.cy = 0
      boxOf(e, e.drawnSpot)
      e.cx = cx
      e.cy = cy
      claims.add(i, qx0, qy0, qx1, qy1)
    }
  }
  /** Whether the scratch box takes room the plan gave a name ranked above `e`. */
  const claimedAbove = (e: Entry): boolean => {
    const n = claims.blockers(qx0, qy0, qx1, qy1, p.slack, blockers)
    if (n > blockers.length) return true
    for (let j = 0; j < n; j++) if (entries[blockers[j]].rank < e.rank) return true
    return false
  }
  /**
   * What's in the scratch box's way, for entry `i`: nothing (0), only names
   * that come after it (1), or a keep or a name before it (2). Its own box
   * doesn't count; more blockers than can be looked at count as a keep.
   */
  const inTheWay = (i: number): 0 | 1 | 2 => {
    const e = entries[i]
    const n = grid.blockers(qx0, qy0, qx1, qy1, p.slack, blockers)
    if (n > blockers.length) return 2
    let way: 0 | 1 | 2 = 0
    for (let j = 0; j < n; j++) {
      const b = blockers[j]
      if (b === K + i) continue
      if (b < K || before(entries[b - K], e)) return 2
      way = 1
    }
    return way
  }

  let pending = false
  // Pass A: the names shown.
  for (let echo = 0; echo < 2; echo++)
    for (let cls = 0; cls < 3; cls++)
      for (let o = 0; o < order.length; o++) {
        const i = order[o]
        const e = entries[i]
        if (e.echo !== (echo === 1) || e.cls !== cls || !e.shown || !e.onPage) continue
        boxOf(e, e.spot)
        if (!(e.from - p.band < m.zoom && m.zoom <= e.until + p.band)) {
          // Out of its zooms it goes, once it has had its dwell: a name that has only just come in stays a moment.
          if (now - e.changedAt >= p.dwell) hide(e, now)
          else pending = true
          continue
        }
        if (e.force || inTheWay(i) < 2) {
          e.blockedSince = -1
          continue
        }
        if (e.blockedSince < 0) e.blockedSince = now
        if (now - e.blockedSince < p.yield || now - e.changedAt < p.dwell) {
          pending = true
          continue
        }
        // Its first spot clear of everyone; failing that, its first spot clear of those before it.
        let s = -1
        let lesser = -1
        for (let c = 0; c < e.spots.length / 2 && s < 0; c++) {
          if (c === e.spot) continue
          boxOf(e, c)
          const way = inTheWay(i)
          if (way === 0) s = c
          else if (way === 1 && lesser < 0) lesser = c
        }
        if (s < 0) s = lesser
        if (s < 0) {
          hide(e, now)
          continue
        }
        move(e, s, now)
        boxOf(e, s)
        grid.add(K + i, qx0, qy0, qx1, qy1)
      }

  // Pass B: the names hidden.
  for (let echo = 0; echo < 2; echo++)
    for (let cls = 0; cls < 3; cls++)
      for (let o = 0; o < order.length; o++) {
        const i = order[o]
        const e = entries[i]
        if (e.echo !== (echo === 1) || e.cls !== cls || e.shown || !e.onPage) continue
        if (!(e.from + p.band < m.zoom && m.zoom <= e.until - p.band)) {
          // Out of its zooms, a free spot it found before counts for nothing once it's back in them.
          e.freeSince = -1
          continue
        }
        if (now - e.changedAt < p.dwell) {
          pending = true
          continue
        }
        let s = -1
        boxOf(e, e.spot)
        if (grid.free(qx0, qy0, qx1, qy1, p.room) && !claimedAbove(e)) s = e.spot
        else
          for (let c = 0; c < e.spots.length / 2; c++) {
            if (c === e.spot) continue
            boxOf(e, c)
            if (grid.free(qx0, qy0, qx1, qy1, p.room) && !claimedAbove(e)) {
              s = c
              break
            }
          }
        if (s >= 0) {
          if (e.freeSince < 0) e.freeSince = now
          // A reserve comes in once the spot has been free a while; a name that gave way, only after a good while longer.
          if (now - e.freeSince >= (e.drawnHidden ? p.free : p.back)) {
            show(e, s, 0, now)
            boxOf(e, s)
            grid.add(K + i, qx0, qy0, qx1, qy1)
          } else pending = true
          continue
        }
        e.freeSince = -1
        // No spot free: a spot whose every blocker is a name of a worse class, at rest, is taken from them.
        const spots = e.spots.length / 2
        for (let c = -1; c < spots; c++) {
          const candidate = c < 0 ? e.spot : c
          if (c >= 0 && c === e.spot) continue
          boxOf(e, candidate)
          if (claimedAbove(e)) continue
          const n = grid.blockers(qx0, qy0, qx1, qy1, p.slack, blockers)
          if (n < 1 || n > blockers.length) continue
          let evictable = true
          for (let j = 0; j < n; j++) {
            const b = blockers[j]
            if (b < K) {
              evictable = false
              break
            }
            const other = entries[b - K]
            if (!other.shown || !worse(other, e) || now - other.changedAt < p.dwell) {
              evictable = false
              break
            }
          }
          if (!evictable) continue
          for (let j = 0; j < n; j++) hide(entries[blockers[j] - K], now)
          show(e, candidate, p.evictDelay, now)
          grid.add(K + i, qx0, qy0, qx1, qy1)
          break
        }
      }
  return pending
}
