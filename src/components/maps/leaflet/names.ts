'use client'

import type L from 'leaflet'

import { alignment, placementOf, type Frame, type Layer, type Placement, type Shown } from './overlay'
import { decide, Grid, HIDE, MOVE, SHOW, type Entry as Placed, type Keep, type Klass, type Moment, type Params } from './placing'
import { done, EASE_OUT, GLIDE_EASE, valueAt, type Ease, type Tween } from './tweens'

/*
 * The names' hand-over from one plan to the next. Which names fit, and
 * where, is decided once per drawn view (layers/labels.ts), so when the
 * marks are drawn again — the view settled or held still mid-gesture, a
 * layer toggled, a place chosen, the world arrived — some names stay, some
 * take a better spot, some go and some come; swapped all at once, the page
 * jumps. So just before React changes the marks, where each name stands is
 * noted, and once the new drawing is in, a name still there glides from
 * where it stood to its new spot, one gone fades out where it was (the very
 * element React let go of, in a group of its own beside the marks), and one
 * new fades in. A name is known as itself across two drawings by its
 * element first, and by its key (layers/projection.ts → named) when React
 * replaced the element; a re-basing across the world's seam re-keys every
 * name but keeps its element, so nothing cuts across the seam. Text set
 * along a road never glides, since a glide would lift it off the road: a
 * name whose place along its road changed cross-fades instead. Readers who
 * ask for less motion get the swap, and so does the map under the globe's
 * veil, where nothing is painted.
 *
 * Where a name stands is computed, never measured: the point it belongs to
 * (`data-az-at`), its box about that point (`data-az-box`), the move the
 * marks are shown by (./overlay.ts → placementOf) and its own shift, if a
 * glide is under way. Noting and playing run inside one commit, before
 * anything is painted, so the first frame after any commit shows every
 * name exactly where the frame before did, and nothing reads layout. The
 * marks are read once per commit, after React has drawn them, into a
 * registry of the names as drawn; noting the next time is arithmetic over
 * it, and a change to the marks that came some other way marks it stale.
 *
 * On the map's own canvas (`live`) the names at a point are placed again
 * every frame of a gesture besides, far out where the nations' names jump
 * most (./placing.ts): as the ground carries them together a name blocked
 * for a while steps to another of its spots or gives way, and as it
 * carries them apart a name the plan held in reserve, drawn hidden, comes
 * in once there's room, Azania's names before the world's; every change
 * waits a moment after the last, so nothing twitches. The registry holds
 * what the plan said of each such name, and what the pass has decided
 * since; at the next drawing the plan's word is final, and each name hands
 * over from exactly where the pass left it. A pass that runs long twice is
 * stopped until the next drawing, and tweens alone go on.
 *
 * Who writes what: this module alone writes a name's inline `translate`,
 * `opacity` and `visibility`, and a ghost's wrapper's, and removes each at
 * rest rather than setting a default. The steady layer (./steady.ts) owns
 * `transform` and is not touched; nothing here scales a name, nor writes
 * its type, nor moves the map. No named element carries a React style prop,
 * so React never fights these writes.
 */

/** Whether a map's names animate: not at all, when the drawing settles, or every frame mid-gesture too. */
export type NamesMode = 'off' | 'settle' | 'live'

export type Names = {
  /** Just before React changes the marks: notes each name as it's shown now. */
  note: () => void
  /** The marks have been drawn again, for `drawn`: the names glide, go and come. */
  play: (drawn: Frame) => void
  /** The map is shown somewhere new: the names still fading where they stood move with it, and mid-gesture the names are placed again. */
  show: (shown: Shown) => void
  /**
   * The map's pixel origin moved by `shift` at `zoom`, nothing on the page
   * with it (./home.ts): the frame the names still fading were drawn for
   * moves the same way, so they stay where they are.
   */
  rebase: (shift: L.Point, zoom: number) => void
  dispose: () => void
}

type Fade = { duration: number; ease: Ease; delay?: number }

/** How the names move when the drawing changes: quick, and calm. */
export const NAMES = {
  /** A kept name slides from where it stood to the plan's spot, easing in to land. */
  GLIDE: { duration: 260, ease: GLIDE_EASE } satisfies Fade,
  /** A name that goes fades out where it stood. */
  LEAVE: { duration: 160, ease: EASE_OUT } satisfies Fade,
  /** A name that comes fades in once those going have mostly gone. */
  ARRIVE: { duration: 220, delay: 70, ease: EASE_OUT } satisfies Fade,
  /** Further than this, in px, a name doesn't glide but goes and comes again: a glide that far reads as a fling. */
  FARTHEST: 140,
  /** A move smaller than this, in px, is no move. */
  STILL: 0.75,
  /** A name shown fainter than this isn't there. */
  ABSENT: 0.02,
  /** The echoes' opacity (maps.css → .az-world[data-echo]); a ghost of an echo's name starts this faint. */
  ECHO: 0.55,
  /** A fade that sets off part-way is shortened in proportion, but never under this, in ms. */
  LEAST: 40,
  /** A frame this long after the last, in ms, was a stall of the page: the tweens are held back by it rather than leaping ahead. */
  STALL: 40,
  /** A frame's own length, in ms, which a stall is reckoned over and above. */
  FRAME: 16.7,
  /** Mid-gesture, the names at a point are placed every frame (./placing.ts): how they move, and how long each waits. */
  LIVE: {
    /** A shown name steps to another of its spots. */
    glide: { duration: 200, ease: GLIDE_EASE } satisfies Fade,
    /** A name gives way, or leaves its zooms. */
    leave: { duration: 160, ease: EASE_OUT } satisfies Fade,
    /** A name comes in. */
    arrive: { duration: 220, ease: EASE_OUT } satisfies Fade,
    /** A name that sent others away comes in this long after they set off, in ms. */
    evictDelay: 70,
    /** Blocked means overlapping by more than this, in px, on both axes. */
    slack: 2,
    /** A name coming in needs this much room, in px, on every side. */
    room: 4,
    /** A shown name holds this long, in ms, blocked, before it steps aside or goes. */
    yield: 80,
    /** At least this long, in ms, between one change to a name and the next. */
    dwell: 240,
    /** A hidden name's spot must have been free this long, in ms, before it comes in. */
    free: 120,
    /** A name that gave way comes back only once its spot has been free this long, in ms: longer than a wobble of the fingers, which would otherwise bring it and send it with every turn. */
    back: 320,
    /** The hysteresis on every zoom gate, in levels. */
    band: 0.1,
    /** A pass longer than this, in ms, twice in a row, stops the passes until the next drawing; a hiccup alone doesn't. */
    governor: 4,
    /**
     * The passes run only while the drawn or the live zoom is at or beyond
     * this: at the scale of the world, where only the greatest nations are
     * named and their names jump most. Nearer in, where the middle tier of
     * nations and Azania's towns are named, a phone's pinch measured a third
     * slower with the passes on; there the names wait for the settle.
     */
    gate: -5.75,
    /** Fingers that have sent nothing for this long, in ms, are resting: the module's own frames then run the passes, so a wait runs out. */
    resting: 40,
    /** A nation's name kept on the page, as the plan keeps it (layers/AbroadLayer.tsx → nationName). */
    clamp: { margin: 12, pad: 0.6, width: 24 },
  },
} as const

type XY = { x: number; y: number }
const ZERO: XY = { x: 0, y: 0 }

/**
 * Where a name's box's middle stands in the marks' pixels: its anchor moved
 * by `placement`, its box about the anchor as drawn, and its own shift.
 */
export function spotOf(anchor: XY, centre: XY, placement: Placement, offset: XY = ZERO): XY {
  return {
    x: placement.k * anchor.x + placement.x + (centre.x - anchor.x) + offset.x,
    y: placement.k * anchor.y + placement.y + (centre.y - anchor.y) + offset.y,
  }
}

const numbers = (value: string): number[] => value.split(' ').map(Number)

/** A point as `upright` writes it. */
const pointOf = (at: string): XY => {
  const [x, y] = numbers(at)
  return { x, y }
}

/** An element's state as this module knows it; kept by the element, so a name is itself across drawings. */
type State = {
  key: string
  /** Its opacity on the way somewhere; null means at rest. */
  opacity: Tween | null
  /** Its opacity at rest: 1 as drawn, 0 when the pass has it hidden or the plan holds it in reserve. */
  o: number
  /** Its shift from where it's drawn, in px, on the way somewhere; null means at rest. */
  offset: { x: Tween; y: Tween } | null
  /** Its shift at rest: none as drawn, or to the spot the pass gave it. */
  ox: number
  oy: number
  /** The shift that keeps a nation's name on the page mid-gesture, added as it is, never tweened. */
  cx: number
  cy: number
  /** What follows once the opacity lands: a name gone far comes back where it's drawn. */
  then: ((now: number) => void) | null
  /** A ghost: the wrapper of a name that left, removed once faded. */
  ghost: boolean
  /** A ghost faded to nothing, shown so for one frame and then removed: never a frame with it still faintly there. */
  gone: boolean
  /** Drawn in reserve, hidden by its own attribute (layers/projection.ts → named): shown only with an inline visibility. */
  reserve: boolean
  /** What was last written, so nothing is written that hasn't changed: whether a shift is, and which; the opacity; the visibility. */
  tr: boolean
  wx: number
  wy: number
  wo: number
  vis: '' | 'hidden' | 'visible'
  /** The pass's record of it (./placing.ts), kept across drawings for when it last changed. */
  live: Placed | null
}

/**
 * Text on a path as it was drawn: where along the path it was set
 * (`startOffset`), where along it the layer says it sits when the path
 * itself is cut anew for each view (`data-az-along`, the reach's ring), and
 * the path's own `d`.
 */
type Path = { offset: string | null; along: string | null; d: string | null }

/**
 * A name as drawn, read from the marks once per commit: the registry's
 * entry. A point name has an anchor and a box; text on a path has neither,
 * and says where along its path it was set instead.
 */
type Entry = {
  element: SVGElement
  key: string
  /** The point it's held upright about and its box, in the drawn frame's px; null for text on a path. */
  anchor: XY | null
  box: number[] | null
  centre: XY | null
  /** The anchor as written, and whether on the element itself rather than a group around it. */
  at: string | null
  own: boolean
  /** Whether it stands in an echo of the world, which is washed. */
  echo: boolean
  path: Path | null
}

/** The marks as read after a commit: every name, and the names the pass places with their elements beside them, by rank, and the obstacles they keep off. */
type Registry = {
  entries: Entry[]
  placed: Placed[]
  elements: SVGElement[]
  order: number[]
  keeps: Keep[]
}

const EMPTY: Registry = { entries: [], placed: [], elements: [], order: [], keeps: [] }

/** A name as it stood when the drawing was about to change. */
type Noted = {
  entry: Entry
  /** Where its box's middle stood, in the marks' pixels; null for text on a path, which has no box. */
  spot: XY | null
  /** How faint it was shown, 1 for fully. */
  op: number
}

const SVG = 'http://www.w3.org/2000/svg'

/**
 * The attributes a change to which, or to what the marks hold, makes the
 * registry stale: what names a name and places it, and what the pass goes
 * by. Not a path's `d`, which every glyph is drawn afresh with at each
 * settle and the hand-over ignores, nor `startOffset`, which no drawing
 * changes on its own, nor any style, which this module writes itself.
 */
const READ = [
  'data-az-name',
  'data-az-at',
  'data-az-box',
  'data-az-along',
  'data-az-rank',
  'data-az-spots',
  'data-az-spot',
  'data-az-zooms',
  'data-az-class',
  'data-az-lead',
  'data-az-force',
  'data-az-clamp',
  'data-az-reserve',
  'data-az-keep',
]

/** A fade of no length: for readers who ask for less motion, whose names switch to their new state. */
const INSTANT: Fade = { duration: 0, ease: EASE_OUT }

const tween = (from: number, to: number, start: number, fade: Fade, duration = fade.duration): Tween => ({
  from,
  to,
  start,
  duration,
  delay: fade.delay ?? 0,
  ease: fade.ease,
})

/** A fade from `from` to `to` that takes its time in proportion to how far it has to go; one of no length stays so. */
const partFade = (from: number, to: number, start: number, fade: Fade, delay = 0): Tween =>
  tween(from, to, start, { ...fade, delay }, fade.duration ? Math.max(NAMES.LEAST, fade.duration * Math.abs(to - from)) : 0)

/** Every id in a ghost renamed, and every reference to one with it, so its text follows its own path and never a live one's. */
function renameIds(root: Element): void {
  for (const element of root.querySelectorAll('[id]')) element.id = `${element.id}~gone`
  for (const element of root.querySelectorAll('[href]')) {
    const href = element.getAttribute('href')!
    if (href.startsWith('#')) element.setAttribute('href', `${href}~gone`)
  }
}

/** The path text is set along, which the layers draw inside the named element (RoadsLayer, ReachLayer). */
const lineOf = (element: Element) => element.querySelector('path[id]')

/**
 * Text on a path as it was drawn before this commit: a copy of the element
 * as it is now, set back along the path it had and to its old place along
 * it. Taken only when a cross-fade needs it, rather than copied for every
 * road at every note, since the element React keeps shows the new drawing.
 */
function asDrawn(element: SVGElement, path: Path): SVGElement {
  const copy = element.cloneNode(true) as SVGElement
  const textPath = copy.querySelector('textPath')
  if (textPath && path.offset !== null) textPath.setAttribute('startOffset', path.offset)
  const line = lineOf(copy)
  if (line && path.d !== null) line.setAttribute('d', path.d)
  return copy
}

/** The names in `group` as drawn just now. Inside a commit the lookups may walk the tree; nothing here reads layout. */
function scan(group: SVGGElement): Entry[] {
  const entries: Entry[] = []
  for (const element of group.querySelectorAll<SVGElement>('[data-az-name]')) {
    // Most names are held upright themselves; a place's or an event's sits in the group its pin or mark is held in.
    const own = element.hasAttribute('data-az-at')
    const holder = own ? element : element.closest<SVGElement>('[data-az-at]')
    const at = holder?.getAttribute('data-az-at') ?? null
    const drawn = element.getAttribute('data-az-box')
    let anchor: XY | null = null
    let box: number[] | null = null
    let centre: XY | null = null
    let path: Path | null = null
    if (at && drawn) {
      anchor = pointOf(at)
      box = numbers(drawn)
      centre = { x: box[0] + box[2] / 2, y: box[1] + box[3] / 2 }
    } else {
      const textPath = element.querySelector('textPath')
      if (textPath)
        path = {
          offset: textPath.getAttribute('startOffset'),
          along: element.getAttribute('data-az-along'),
          d: lineOf(element)?.getAttribute('d') ?? null,
        }
    }
    entries.push({
      element,
      key: element.getAttribute('data-az-name')!,
      anchor,
      box,
      centre,
      at,
      own,
      echo: element.closest('[data-echo]') !== null,
      path,
    })
  }
  return entries
}

/**
 * What the plan said of a name the pass may place (layers/projection.ts →
 * named), read off its element, with its decision at the drawn state: shown
 * unless in reserve, at the drawn spot, nothing waiting. When it last
 * changed is this drawing's time if the drawing shows it other than the
 * pass had it (`previous`), else as it was, so a name the plan has just
 * moved or brought in rests a while before the pass may change it again.
 */
function placedOf(element: SVGElement, entry: Entry, previous: Placed | null, now: number): Placed {
  const anchor = entry.anchor!
  const box = entry.box!
  const [from, until] = numbers(element.getAttribute('data-az-zooms') ?? '-99 99')
  const lead = element.getAttribute('data-az-lead')
  const clamp = element.getAttribute('data-az-clamp')
  const [hx, hy] = clamp ? numbers(clamp) : [NaN, NaN]
  const drawnSpot = Number(element.getAttribute('data-az-spot'))
  const drawnHidden = element.hasAttribute('data-az-reserve')
  const shown = !drawnHidden
  // Written out whole rather than spread over a fresh record: this runs for every name at every commit.
  return {
    ax: anchor.x,
    ay: anchor.y,
    bx: box[0],
    by: box[1],
    bw: box[2],
    bh: box[3],
    spots: Float64Array.from(numbers(element.getAttribute('data-az-spots') ?? '0 0')),
    drawnSpot,
    from,
    until,
    klass: Number(element.getAttribute('data-az-class')) as Klass,
    lead: lead ? Number(lead) : NaN,
    force: element.hasAttribute('data-az-force'),
    hx,
    hy,
    drawnHidden,
    echo: entry.echo,
    rank: Number(element.getAttribute('data-az-rank')),
    shown,
    spot: drawnSpot,
    changedAt: previous && previous.shown === shown && previous.spot === drawnSpot ? previous.changedAt : now,
    blockedSince: -1,
    freeSince: -1,
    left: 0,
    top: 0,
    cx: 0,
    cy: 0,
    onPage: false,
    cls: 2,
    change: 0,
    delay: 0,
  }
}

/** The obstacles the names keep off (layers/projection.ts → kept): each on the holder that keeps its size, about the holder's own point. */
function keepsOf(group: SVGGElement): Keep[] {
  const keeps: Keep[] = []
  for (const element of group.querySelectorAll<SVGElement>('[data-az-keep]')) {
    const at = element.getAttribute('data-az-at')
    if (!at) continue
    const [ax, ay] = numbers(at)
    const [x, y, w, h] = numbers(element.getAttribute('data-az-keep')!)
    keeps.push({ ax, ay, x, y, w, h })
  }
  return keeps
}

/** Where the map's pane stands, as Leaflet keeps it (L.DomUtil.getPosition reads the same, and nothing is laid out for it). */
const positionOf = (pane: HTMLElement): XY => (pane as HTMLElement & { _leaflet_pos?: XY })._leaflet_pos ?? ZERO

export function createNames({
  map,
  container,
  group,
  leaving,
  drawn,
  shown,
  mode,
}: {
  /** The map: for the page's rectangle in the marks' pixels, and to know a gesture is under way. */
  map: L.Map
  /** The map's container, which wears `.az-veiled` while the globe covers the map. */
  container: HTMLElement
  /** The marks' group, which React draws into. */
  group: SVGGElement
  /** A layer beside it, for the names going: moved like the marks, from the frame they were drawn for. */
  leaving: Layer
  /** The frame the marks are drawn for just now, already shifted by a re-basing. */
  drawn: () => Frame | null
  /** Where the map is shown just now. */
  shown: () => Shown
  /** Whether the names move only as the drawing settles, or every frame mid-gesture too. */
  mode: Exclude<NamesMode, 'off'>
}): Names {
  const live = mode === 'live'
  // Read once; asked through .matches, never through getComputedStyle.
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const veiled = () => container.classList.contains('az-veiled')
  const states = new WeakMap<Element, State>()
  // The elements with a tween under way: what each step goes through.
  const active = new Set<SVGElement>()
  let noted: { names: Noted[]; frame: Frame } | null = null
  // The frame the names fading out were drawn for.
  let leavingFrame: Frame | null = null
  let frame = 0
  let lastNow = -1

  // The marks as drawn, read after each commit; a change to the marks that didn't come through play (none
  // does today: the layers are pure, and every commit passes the boundary) would make it stale, and it is read
  // again at the next note. Records of a commit play has just read are taken, so that commit doesn't stale it.
  let registry: Registry = EMPTY
  let stale = true
  const watcher = new MutationObserver(() => {
    stale = true
  })
  watcher.observe(group, { childList: true, subtree: true, attributes: true, attributeFilter: READ })

  const stateOf = (element: SVGElement, key: string): State => {
    let state = states.get(element)
    if (!state) {
      state = {
        key,
        opacity: null,
        o: 1,
        offset: null,
        ox: 0,
        oy: 0,
        cx: 0,
        cy: 0,
        then: null,
        ghost: false,
        gone: false,
        reserve: false,
        tr: false,
        wx: 0,
        wy: 0,
        wo: 1,
        vis: '',
        live: null,
      }
      states.set(element, state)
    }
    state.key = key
    return state
  }

  const read = (now: number): Registry => {
    const entries = scan(group)
    const placed: Placed[] = []
    const elements: SVGElement[] = []
    if (live)
      for (const entry of entries) {
        const { element } = entry
        if (!entry.anchor || !entry.box || !element.hasAttribute('data-az-rank')) continue
        const state = stateOf(element, entry.key)
        const record = placedOf(element, entry, state.live, now)
        state.live = record
        state.reserve = record.drawnHidden
        placed.push(record)
        elements.push(element)
      }
    const order = placed.map((_, i) => i).sort((a, b) => placed[a].rank - placed[b].rank)
    registry = { entries, placed, elements, order, keeps: live ? keepsOf(group) : [] }
    watcher.takeRecords()
    stale = false
    return registry
  }
  const current = (now: number): Registry => (stale ? read(now) : registry)

  const shownOpacity = (state: State | undefined, now: number) => (state ? (state.opacity ? valueAt(state.opacity, now) : state.o) : 1)
  /** A name's own shift just now, without the clamp's. */
  const shownOffset = (state: State, now: number): XY =>
    state.offset ? { x: valueAt(state.offset.x, now), y: valueAt(state.offset.y, now) } : { x: state.ox, y: state.oy }
  /** A name's whole shift just now: its own, and the clamp's. */
  const shownShift = (state: State | undefined, now: number): XY => {
    if (!state) return ZERO
    const own = shownOffset(state, now)
    return { x: own.x + state.cx, y: own.y + state.cy }
  }

  /** Writes the name's shift as it is just now: its own, on its way or at rest, and the clamp's; none at all when there's none. */
  const writeTranslate = (element: SVGElement, state: State, now: number) => {
    const moving = state.offset !== null
    const x = (moving ? valueAt(state.offset!.x, now) : state.ox) + state.cx
    const y = (moving ? valueAt(state.offset!.y, now) : state.oy) + state.cy
    if (!moving && x === 0 && y === 0) {
      if (!state.tr) return
      element.style.removeProperty('translate')
      state.tr = false
      state.wx = state.wy = 0
      return
    }
    // A quarter-pixel is let be, on its way or as the clamp slides it; the first write is exact.
    if (state.tr && Math.abs(x - state.wx) < 0.25 && Math.abs(y - state.wy) < 0.25) return
    element.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`
    state.tr = true
    state.wx = x
    state.wy = y
  }
  const clearOffset = (element: SVGElement, state: State) => {
    state.offset = null
    state.ox = state.oy = state.cx = state.cy = 0
    writeTranslate(element, state, 0)
  }
  const writeOpacity = (element: SVGElement, state: State, value: number) => {
    if (value === state.wo) return
    element.style.opacity = value.toFixed(3)
    state.wo = value
  }
  const clearOpacity = (element: SVGElement, state: State) => {
    if (state.wo !== 1) element.style.removeProperty('opacity')
    state.wo = 1
  }
  /**
   * Lands the opacity where its tween was going: at 1, as drawn, the
   * property goes; at nothing, it's written so, unless the name is in
   * reserve, whose own attribute hides it once its inline visibility goes.
   */
  const landOpacity = (element: SVGElement, state: State, to: number) => {
    state.opacity = null
    state.o = to
    if (to === 1 || state.reserve) clearOpacity(element, state)
    else writeOpacity(element, state, 0)
  }
  /**
   * The inline visibility a name needs just now: hidden while shown at
   * nothing and going nowhere, so an invisible name costs no paint; a
   * reserve the other way about, visible only while it's brought in, since
   * its own attribute hides it. Never written for a ghost.
   */
  const syncVisibility = (element: SVGElement, state: State) => {
    const hidden = state.o === 0 && state.opacity === null
    const want = state.reserve ? (hidden ? '' : 'visible') : hidden ? 'hidden' : ''
    if (want === state.vis) return
    state.vis = want
    if (want) element.style.visibility = want
    else element.style.removeProperty('visibility')
  }
  /** A name at rest as drawn: shown, or hidden by its own attribute, with nothing of this module's on it. */
  const atRest = (element: SVGElement, state: State, shown: boolean) => {
    state.then = null
    state.opacity = null
    state.o = shown ? 1 : 0
    if (shown || state.reserve) clearOpacity(element, state)
    else writeOpacity(element, state, 0)
    clearOffset(element, state)
    syncVisibility(element, state)
    active.delete(element)
  }

  // Mid-gesture (live): the pass over the names at a point, and what it needs between frames: a grid of the
  // names as they stand and one of the room the plan gave them.
  const grid = new Grid()
  const claims = new Grid()
  const moment: Moment = { now: 0, k: 1, x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, zoom: 0 }
  const params: Params = {
    slack: NAMES.LIVE.slack,
    room: NAMES.LIVE.room,
    yield: NAMES.LIVE.yield,
    dwell: NAMES.LIVE.dwell,
    free: NAMES.LIVE.free,
    back: NAMES.LIVE.back,
    band: NAMES.LIVE.band,
    evictDelay: NAMES.LIVE.evictDelay,
    margin: NAMES.LIVE.clamp.margin,
    pad: NAMES.LIVE.clamp.pad,
    width: NAMES.LIVE.clamp.width,
  }
  // Between movestart and moveend: the passes run only then, and never between a gesture's end and its drawing.
  let moving = false
  // Whether some name is waiting on a timer, so the passes go on while the fingers rest; and when they last moved the map.
  let pending = false
  let lastShown = -Infinity
  // The move the marks were last passed at: a pass is skipped while nothing has moved and nothing waits.
  let lastK = NaN
  let lastX = NaN
  let lastY = NaN
  // The governor: passes over its limit in a row, and whether it has tripped.
  let slow = 0
  let tripped = false
  /** A fade as the reader has it: as given, or of no length for a reader who asks for less motion. */
  const liveFade = (fade: Fade): Fade => (motion.matches ? INSTANT : fade)

  /**
   * A stretch of time no frame was painted in (a long task: the drawing's
   * own render before a commit, say): every tween under way is set back
   * by it, so each goes on from the value last painted rather than
   * leaping ahead by what it would have shown meanwhile. A stalled page
   * stalls the names; it never rushes them.
   */
  const holdBack = (lost: number) => {
    if (lost <= 0) return
    for (const element of active) {
      const state = states.get(element)!
      if (state.opacity) state.opacity.start += lost
      if (state.offset) {
        state.offset.x.start += lost
        state.offset.y.start += lost
      }
    }
  }

  /** Everything lands at once: each name as drawn, every ghost gone, every decision the drawn one. For readers who ask for less motion, and under the veil. */
  const finish = () => {
    for (const element of active) {
      const state = states.get(element)!
      if (state.ghost) element.remove()
      else atRest(element, state, !state.reserve)
    }
    active.clear()
    for (let i = 0; i < registry.placed.length; i++) {
      const record = registry.placed[i]
      const state = states.get(registry.elements[i])
      if (state) atRest(registry.elements[i], state, !state.reserve)
      record.shown = !record.drawnHidden
      record.spot = record.drawnSpot
      record.blockedSince = record.freeSince = -1
    }
    pending = false
    lastK = NaN
    leaving.element.replaceChildren()
    leavingFrame = null
    cancelAnimationFrame(frame)
    frame = 0
  }

  // The live verbs, each from where the name is just now.

  /** A shown name gives way, or has left its zooms: it fades out where it stands. */
  const hideLive = (element: SVGElement, state: State, now: number) => {
    state.then = null
    state.opacity = partFade(shownOpacity(state, now), 0, now, liveFade(NAMES.LIVE.leave))
    active.add(element)
  }
  /** A hidden name comes in at the spot the pass found it: there at once (nothing glides unseen), fading in, after `delay` ms. */
  const showLive = (element: SVGElement, state: State, record: Placed, now: number) => {
    state.then = null
    state.offset = null
    state.ox = record.spots[2 * record.spot] - record.spots[2 * record.drawnSpot]
    state.oy = record.spots[2 * record.spot + 1] - record.spots[2 * record.drawnSpot + 1]
    const op = shownOpacity(state, now)
    const fade = liveFade(NAMES.LIVE.arrive)
    state.opacity = partFade(op, 1, now, fade, fade.duration ? record.delay : 0)
    // Written as it is before its first paint shown, so a reserve never shows whole for a frame.
    writeOpacity(element, state, op)
    writeTranslate(element, state, now)
    syncVisibility(element, state)
    active.add(element)
  }
  /** A shown name steps to another of its spots, from wherever it has got to. */
  const moveLive = (element: SVGElement, state: State, record: Placed, now: number) => {
    const from = shownOffset(state, now)
    state.ox = record.spots[2 * record.spot] - record.spots[2 * record.drawnSpot]
    state.oy = record.spots[2 * record.spot + 1] - record.spots[2 * record.drawnSpot + 1]
    const fade = liveFade(NAMES.LIVE.glide)
    state.offset = fade.duration ? { x: tween(from.x, state.ox, now, fade), y: tween(from.y, state.oy, now, fade) } : null
    writeTranslate(element, state, now)
    active.add(element)
  }

  /**
   * One pass over the names on the page, for the map shown at `at`: only
   * mid-gesture, with the marks moved from where they were drawn, far
   * enough out, with the governor untripped, and with something to decide
   * (the marks moved on, or a name is waiting). Each decision becomes a
   * tween from where the name is; a nation's clamp is written as it is.
   */
  const pass = (at: Shown, now: number) => {
    const frameDrawn = drawn()
    if (!frameDrawn || !moving || tripped || veiled()) return
    const placement = placementOf(frameDrawn, at)
    if (placement.k === 1 && placement.x === 0 && placement.y === 0) return
    const zoom = frameDrawn.zoom + Math.log2(placement.k)
    if (Math.min(frameDrawn.zoom, zoom) > NAMES.LIVE.gate) return
    if (!pending && placement.k === lastK && placement.x === lastX && placement.y === lastY) return
    lastK = placement.k
    lastX = placement.x
    lastY = placement.y
    const began = performance.now()
    const { placed, elements, order, keeps } = current(now)
    const pane = positionOf(map.getPanes().mapPane)
    const size = map.getSize()
    moment.now = now
    moment.k = placement.k
    moment.x = placement.x
    moment.y = placement.y
    moment.left = -pane.x
    moment.top = -pane.y
    moment.right = -pane.x + size.x
    moment.bottom = -pane.y + size.y
    moment.zoom = zoom
    pending = decide(placed, order, keeps, grid, moment, params, claims)
    for (let i = 0; i < placed.length; i++) {
      const record = placed[i]
      // Off the page a name is left as it is, until it comes back.
      if (!record.onPage) continue
      const element = elements[i]
      const state = states.get(element)!
      if (record.change === HIDE) hideLive(element, state, now)
      else if (record.change === SHOW) showLive(element, state, record, now)
      else if (record.change === MOVE) moveLive(element, state, record, now)
      if (record.cx !== state.cx || record.cy !== state.cy) {
        state.cx = record.cx
        state.cy = record.cy
        writeTranslate(element, state, now)
      }
    }
    // The governor: a pass that runs long twice in a row is the page's warning, a single long one its hiccup.
    if (performance.now() - began > NAMES.LIVE.governor) {
      if (++slow >= 2) tripped = true
    } else slow = 0
    start()
  }

  /** One frame of every tween under way. */
  const step = (now: number) => {
    frame = 0
    if (now === lastNow) {
      if (active.size || (pending && moving)) frame = requestAnimationFrame(step)
      return
    }
    // A frame long after the last was a stall: the tweens pick up where they were painted.
    if (lastNow > 0 && now - lastNow > NAMES.STALL) holdBack(now - lastNow - NAMES.FRAME)
    lastNow = now
    if (veiled()) {
      finish()
      return
    }
    for (const element of active) {
      const state = states.get(element)!
      if (state.gone) {
        element.remove()
        active.delete(element)
        continue
      }
      if (state.opacity) {
        const value = valueAt(state.opacity, now)
        if (done(state.opacity, now)) {
          if (state.ghost) {
            writeOpacity(element, state, 0)
            state.gone = true
            continue
          }
          landOpacity(element, state, state.opacity.to)
          if (state.then) {
            const then = state.then
            state.then = null
            then(now)
          }
        } else if (Math.abs(value - state.wo) >= 0.01) writeOpacity(element, state, value)
      }
      if (!state.ghost) syncVisibility(element, state)
      if (state.offset) {
        if (done(state.offset.x, now) && done(state.offset.y, now)) state.offset = null
        writeTranslate(element, state, now)
      }
      if (!state.opacity && !state.offset && !state.then) active.delete(element)
    }
    if (leavingFrame && !leaving.element.childElementCount) leavingFrame = null
    // The fingers resting mid-gesture, a name waiting: the pass runs on this module's own frames, so the wait runs out.
    if (pending && moving && now - lastShown > NAMES.LIVE.resting) pass(shown(), now)
    if (active.size || (pending && moving)) frame = requestAnimationFrame(step)
    // The loop stops: its clock means nothing until it runs again, so no stall is reckoned from here.
    else lastNow = -1
  }
  const start = () => {
    if (!frame && (active.size || (pending && moving))) frame = requestAnimationFrame(step)
  }

  /** A name new to the drawing fades in, from nothing: written as nothing now, so its first paint never shows it whole. */
  const arrive = (element: SVGElement, state: State, now: number, fade: Fade = NAMES.ARRIVE) => {
    clearOffset(element, state)
    state.then = null
    state.opacity = tween(0, 1, now, fade)
    writeOpacity(element, state, 0)
    syncVisibility(element, state)
    active.add(element)
  }

  /** A kept name, shown fainter than drawn (a fade cut short by this drawing), finishes coming in. */
  const complete = (element: SVGElement, state: State, op: number, now: number) => {
    state.then = null
    if (op >= 1) {
      landOpacity(element, state, 1)
      return
    }
    state.opacity = partFade(op, 1, now, NAMES.ARRIVE)
    writeOpacity(element, state, op)
    active.add(element)
  }

  /** A kept name slides from where it stood (`d` away) to where it's drawn. */
  const glide = (element: SVGElement, state: State, d: XY, now: number) => {
    state.offset = { x: tween(d.x, 0, now, NAMES.GLIDE), y: tween(d.y, 0, now, NAMES.GLIDE) }
    writeTranslate(element, state, now)
    active.add(element)
  }

  /** A kept name held `d` from where it's drawn, where it stood, while its opacity goes somewhere. */
  const hold = (element: SVGElement, state: State, d: XY, now: number) => {
    state.offset = null
    state.ox = d.x
    state.oy = d.y
    writeTranslate(element, state, now)
  }

  /** A kept name drawn too far away to glide: it fades out where it stood, then comes in where it's drawn. */
  const outThenIn = (element: SVGElement, state: State, d: XY, op: number, now: number) => {
    hold(element, state, d, now)
    state.opacity = partFade(op, 0, now, NAMES.LEAVE)
    writeOpacity(element, state, op)
    state.then = (at) => {
      clearOffset(element, state)
      state.opacity = tween(0, 1, at, { ...NAMES.ARRIVE, delay: 0 })
    }
    active.add(element)
  }

  /** A name the pass had shown, which the plan now holds in reserve: it fades out where it stood, and then its own attribute hides it. */
  const leaveInPlace = (element: SVGElement, state: State, d: XY, op: number, now: number) => {
    hold(element, state, d, now)
    state.opacity = partFade(op, 0, now, NAMES.LEAVE)
    writeOpacity(element, state, op)
    state.then = () => clearOffset(element, state)
    syncVisibility(element, state)
    active.add(element)
  }

  /**
   * A name gone from the drawing fades where it stood: the element React let
   * go of (or, for text on a path React kept but moved along its road, a
   * copy set as it was: `copy`) in a wrapper of its own in the leaving
   * layer, held upright about the name's own point so it moves with the
   * ground meanwhile. Text on a path has no point, and its wrapper none:
   * the text is scaled with the ground there as it is in the marks.
   */
  const ghost = (was: Noted, now: number, copy: SVGElement | null = null): SVGGElement => {
    const { entry } = was
    const wrap = document.createElementNS(SVG, 'g')
    const content = copy ?? entry.element
    if (content === entry.element) {
      const old = states.get(content)
      if (old) {
        old.opacity = old.offset = old.then = null
        active.delete(content)
      }
    }
    // The wrapper alone fades it; a fade of its own still written on it (or copied with it) would dim it twice.
    content.style.removeProperty('opacity')
    content.style.removeProperty('visibility')
    // A reserve the pass had brought in is hidden by its own attribute once its inline visibility goes: not as a ghost.
    if (content.hasAttribute('data-az-reserve')) content.removeAttribute('visibility')
    if (entry.path) renameIds(content)
    else {
      // Only the wrapper is moved from here on; the element keeps the shift it had, frozen where it stood.
      if (entry.own) content.removeAttribute('data-az-at')
      content.style.removeProperty('transform')
      if (entry.at) wrap.setAttribute('data-az-at', entry.at)
    }
    wrap.appendChild(content)
    const from = was.op * (entry.echo ? NAMES.ECHO : 1)
    const state = stateOf(wrap, entry.key)
    state.ghost = true
    state.opacity = partFade(from, 0, now, NAMES.LEAVE)
    writeOpacity(wrap, state, from)
    active.add(wrap)
    return wrap
  }

  /**
   * Ghosts still fading from an earlier hand-over are drawn for an older
   * frame; moved into the new leaving frame, each stays exactly where it is:
   * its anchor is re-aligned, and the difference is put in its own
   * transform, which steady composes after its shift (./steady.ts). Ghosts
   * of text on a path have no anchor to re-align about, and go.
   */
  const rebaseGhosts = (from: Frame, to: Frame) => {
    const A = alignment(from, to)
    if (A.k === 1 && A.x === 0 && A.y === 0) return
    for (const wrap of [...leaving.element.children] as SVGGElement[]) {
      const at = wrap.getAttribute('data-az-at')
      if (!at) {
        wrap.remove()
        active.delete(wrap)
        continue
      }
      const a = pointOf(at)
      const moved = { x: A.k * a.x + A.x, y: A.k * a.y + A.y }
      wrap.setAttribute('data-az-at', `${moved.x} ${moved.y}`)
      const own = wrap.getAttribute('transform')
      wrap.setAttribute('transform', `translate(${moved.x - a.x} ${moved.y - a.y})${own ? ` ${own}` : ''}`)
    }
  }

  const onMoveStart = () => {
    moving = true
  }
  const onMoveEnd = () => {
    moving = false
    pending = false
  }
  if (live) {
    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
  }

  return {
    note: () => {
      noted = null
      const frameDrawn = drawn()
      if (!frameDrawn) return
      if (motion.matches || veiled()) {
        finish()
        return
      }
      const now = performance.now()
      // The drawing's render ran before this, in one task: the tweens are noted as last painted, not as the clock has them.
      if (lastNow > 0 && active.size) holdBack(now - lastNow)
      const placement = placementOf(frameDrawn, shown())
      const names: Noted[] = []
      // Arithmetic over the names as drawn: the marks are read again only if something changed them meanwhile.
      for (const entry of current(now).entries) {
        const state = states.get(entry.element)
        const op = shownOpacity(state, now)
        if (op < NAMES.ABSENT) continue
        // Where it's shown: where it's drawn, moved on by the pass and by the clamp, which the next drawing has clamped anew.
        const spot = entry.anchor && entry.centre ? spotOf(entry.anchor, entry.centre, placement, shownShift(state, now)) : null
        names.push({ entry, spot, op })
      }
      noted = { names, frame: frameDrawn }
    },

    play: (frameDrawn) => {
      const before = noted
      noted = null
      const now = performance.now()
      // The marks as drawn now, every decision the drawn one; the governor is let go of.
      const { entries, placed, elements } = read(now)
      pending = false
      slow = 0
      tripped = false
      lastK = NaN
      if (!before) {
        // Nothing to hand over (the first drawing, less motion asked for, the veil): a name comes to rest as drawn.
        for (let i = 0; i < placed.length; i++) {
          const state = states.get(elements[i])!
          const resting = state.o === (state.reserve ? 0 : 1) && !state.opacity && !state.offset
          if (!resting) atRest(elements[i], state, !state.reserve)
        }
        return
      }
      const placement = placementOf(frameDrawn, shown())
      const byElement = new Map<Element, Noted>()
      const byKey = new Map<string, Noted>()
      for (const was of before.names) {
        byElement.set(was.entry.element, was)
        byKey.set(was.entry.key, was)
      }
      const kept = new Set<Noted>()
      const ghosts: SVGGElement[] = []
      for (const entry of entries) {
        const { element, key } = entry
        // The same element first; else the same name on an element React has let go of.
        let was = byElement.get(element) ?? null
        if (!was) {
          const named = byKey.get(key)
          if (named && !named.entry.element.isConnected) was = named
        }
        const state = stateOf(element, key)
        // The plan has placed it anew, and clamped it anew: no shift of the pass's. Where it stood is in `was`.
        state.ox = state.oy = state.cx = state.cy = 0
        if (!was) {
          if (state.reserve) atRest(element, state, false)
          else arrive(element, state, now)
          continue
        }
        kept.add(was)
        if (state.reserve) {
          // Shown by the pass, now held in reserve by the plan: it fades out where it stood.
          const spot = entry.anchor && entry.centre ? spotOf(entry.anchor, entry.centre, placement) : null
          const d = spot && was.spot ? { x: was.spot.x - spot.x, y: was.spot.y - spot.y } : ZERO
          leaveInPlace(element, state, d, was.op, now)
          continue
        }
        if (!(entry.anchor && entry.centre && was.spot)) {
          // Text on a path: still, if it's the same text at the same place along it (the path itself is drawn
          // afresh at every zoom, and ignored); else a cross-fade, never a glide, which would lift it off its road.
          if (!entry.path) continue
          const same = was.entry.element === element
          const old = was.entry.path
          if (same && old && old.offset === entry.path.offset && old.along === entry.path.along) continue
          if (was.entry.path) ghosts.push(ghost(was, now, same ? asDrawn(element, was.entry.path) : null))
          arrive(element, state, now)
          continue
        }
        const spot = spotOf(entry.anchor, entry.centre, placement)
        const d = { x: was.spot.x - spot.x, y: was.spot.y - spot.y }
        const far = Math.hypot(d.x, d.y)
        if (far > NAMES.FARTHEST) {
          if (was.entry.element === element) outThenIn(element, state, d, was.op, now)
          else {
            ghosts.push(ghost(was, now))
            arrive(element, state, now)
          }
          continue
        }
        if (far < NAMES.STILL) clearOffset(element, state)
        else glide(element, state, d, now)
        complete(element, state, was.op, now)
        syncVisibility(element, state)
      }
      for (const was of before.names) if (!kept.has(was) && !was.entry.element.isConnected) ghosts.push(ghost(was, now))
      if (ghosts.length) {
        if (leavingFrame && leavingFrame !== before.frame) rebaseGhosts(leavingFrame, before.frame)
        leavingFrame = before.frame
        for (const wrap of ghosts) leaving.element.appendChild(wrap)
        leaving.place(placementOf(leavingFrame, shown()))
      }
      start()
    },

    show: (at) => {
      if (leavingFrame) {
        if (!leaving.element.childElementCount) leavingFrame = null
        else leaving.place(placementOf(leavingFrame, at))
      }
      if (!live) return
      const now = performance.now()
      lastShown = now
      pass(at, now)
    },

    rebase: (shift, zoom) => {
      if (!leavingFrame) return
      // In the leaving frame's own pixels, as the canvas moves the drawn frame.
      leavingFrame = { zoom: leavingFrame.zoom, origin: leavingFrame.origin.add(shift.divideBy(2 ** (zoom - leavingFrame.zoom))) }
    },

    dispose: () => {
      if (live) {
        map.off('movestart', onMoveStart)
        map.off('moveend', onMoveEnd)
      }
      watcher.disconnect()
      finish()
      noted = null
      registry = EMPTY
    },
  }
}
