import { namedFrom, nationFontSize, sameNation, type Abroad } from '@/maps/abroad'
import { spoken } from '@/maps/data'
import type { Point } from '@/maps/geo'
import { BLOCKS_PER_RADIAN, curlPoint, radiusAt, toLonLat, type GlobeView, type LonLat } from '@/maps/globe'
import { GROUND } from '@/maps/palette'

import { textWidth, type Rect } from '../layers/projection'
import { lessMotion, mix, smoothstep } from './motion'

/**
 * The nations' names on the globe, set as the flat map sets them far out
 * (src/components/maps/layers/AbroadLayer.tsx): spaced capitals across each
 * heartland, sized by the ground it holds, only the great ones at the scale
 * of the world, Azania's first and bold, underscored in saffron. They are
 * SVG over the globe's canvas, in the flat map's own type and whitewash
 * halo, so they read as its names do. Each is made once, kept from one
 * reading of the world to the next, and measured once as the browser sets
 * it; a frame only moves them and fades them, as they come round the limb
 * and go, and lays them on the curve: towards the limb a name grows a
 * little smaller and is foreshortened along the way to the limb, as if
 * printed on the ground.
 *
 * Where names would meet, the greater keeps its place: Azania's first, then
 * the nation that's open, then the rest by the ground they hold. Every
 * name keeps a clear gap from every other, from the sieges' marks and from
 * the map's own controls floating over the globe, and lies whole on the
 * page the reader sees, never cut by its edge; a name with no room on its
 * heartland, nor a little off it, gives way, fading out rather than
 * vanishing. A name keeps off the server's places and Azania's towns where
 * it can, moving a little off them once the globe is at rest; where every
 * place of its own has marks under it, it takes the one covering the
 * fewest, though a name of no special standing (neither Azania's nor the
 * open nation's) gives way rather than sit over more than one (Azania's
 * own name sits over its towns, which it names). Azania's name, facing the
 * reader but finding no room, says so, and the globe points the way to it
 * instead.
 *
 * So that a turning globe doesn't set names flickering as they trade
 * places, while it moves the names already shown keep their places before
 * any other is given room, and rank has its way only once it has come to
 * rest. On the move, a name holds the place it has as long as a hair's gap
 * remains there and it stays on the ground. One whose place is carried out
 * over the limb, or off the page, as its heart heads that way goes, fading
 * where it stands, rather than step inside for a frame or two; it comes
 * back only once its heart has come back in a little, or the globe has
 * been zoomed or the name been round the back since, so that one carried
 * out as the globe comes to rest isn't back the moment it's still. One
 * crowded out, or met by the limb as the globe zooms or turns aside,
 * glides to another place of its own where there's room to spare, as much
 * as a name coming back needs, so that it isn't sent on again at once, and
 * otherwise goes. A name never glides over another: the room it holds as it glides
 * is the whole of its way there, and its way must be clear of every other
 * name, shown or still fading out; nor does a name come into the room of
 * one still fading out, and one that puts another out, as rank has its way
 * at rest, fades in only once that one has gone. One that gave way comes
 * back only once it has been wholly gone a moment, there is room to spare,
 * and it faces the reader squarely enough, and isn't on its way out over
 * the limb, that it won't be gone again at once; at rest, while it waits
 * for its moment, it keeps the room it will come back to, so that no
 * lesser name comes in only to give it back. At rest, the names settle by
 * rank, off the marks, and back to their heartlands, gliding there where
 * the way is clear. All of it is a few comparisons of boxes a frame, and
 * the page is written only where something changed.
 */

const SVG = 'http://www.w3.org/2000/svg'

/** Azania's name, and where it's set: the middle of its heartland, across its width in blocks. */
export type HomeName = { name: string; heart: Point; across: number }

/**
 * What the names keep off, as boxes on the page: the sieges' marks, which
 * no name covers; the server's places, which names keep off where they
 * can; Azania's towns, which only the other nations' names keep off; and
 * the map's own controls floating over the globe, which no name goes
 * under. And `page`, the part of the page the reader sees the globe in
 * (less what the map's bars and sheet cover), within which a name lies
 * whole; null where it's the whole page.
 */
export type NameMarks = { sieges: Rect[]; places: Rect[]; towns: Rect[]; controls: Rect[]; page: Rect | null }

/**
 * The clear gap kept between any two names, and between a name and a
 * siege, in px; a name already shown keeps its place until the gap closes
 * to HOLD, so two names drifting a little nearer as the globe turns don't
 * part company over a pixel.
 */
const GAP = 4
const HOLD = 1
/**
 * What a name that gave way (or has yet to be shown) needs before it
 * comes: to have been wholly gone a moment, in ms. And while the globe
 * turns, more room, in px all round, than a name already shown needs to
 * stay (as does any place a name shown glides to); to face the reader
 * more squarely (more squarely still on its way out towards the limb);
 * and to stand further inside the limb (as a share of the radius), so
 * that one passing another, or the limb, isn't shown only to go again, or
 * sent on again. One carried out over the limb, or off the page, needs
 * its heart to have come back in a little way since (as a share of the
 * radius), or the globe to have been zoomed a little since (in levels),
 * which moves every name in or out and may give it room where its heart
 * hasn't moved.
 */
const RETURN = { px: 6, ms: 300, facing: 0.3, leaving: 0.75, inside: 0.92, back: 0.02, zoom: 0.1 }
/**
 * How much further from the globe's middle than last frame, as a share of
 * the radius, a heart must be drawn to be on its way out, so that the
 * rounding of a globe that's only zoomed doesn't count.
 */
const OUTWARD = 1e-4
/**
 * How squarely a name must face the reader to be shown at all, and by when
 * it's wholly shown (sooner for Azania's, whose towns are plain by then,
 * and whose compass takes over below it); and how far inside the limb (as
 * a share of the radius) both its ends must stay.
 */
const FACING = 0.15
const SQUARE = { home: 0.3, other: 0.45 }
const INSIDE = 0.97
/** How long a name takes to fade in and out, and to glide to a place nudged off its heartland (the time to come most of the way), in ms. */
const FADE_IN_MS = 220
const FADE_OUT_MS = 160
const GLIDE_MS = 90
/** A frame's worth of time, in ms: what a fade or glide steps by on the frame it begins, whatever pause came before. */
const FRAME_MS = 16
/**
 * Where a name may sit about its heartland, as shares of its own width and
 * height: on it; a little above or below; a little to either side; a little
 * above or below to either side; and, failing all of those, a line above
 * or below, in that order of preference.
 */
const NUDGES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -0.7],
  [0, 0.7],
  [-0.15, 0],
  [0.15, 0],
  [-0.15, -0.7],
  [0.15, -0.7],
  [-0.15, 0.7],
  [0.15, 0.7],
  [0, -1.25],
  [0, 1.25],
]
/**
 * How far a name's way to a new place may run into another name's box, in
 * px: no further than the blank margin about the letters of both, so that
 * it may slide along a name that crowds it, but never pass over one.
 */
const WAY_SLACK = 2
/** How far into a name's box a mark must come before the name moves off it, in px; it moves back only once the mark is as far clear. */
const MARK_GRACE = 2
/** How many marks a name may sit over where no place of its own is clear of them (a mark or two, not a cluster); over more, it gives way, unless it's Azania's or the open nation's. */
const MARKS_BORNE = 2
/** How long the globe must be still before it counts as at rest, and the names are placed by rank, in ms. */
const SETTLE_MS = 250
/** Measuring a name that couldn't be measured (its globe not laid out yet) is tried again no sooner than this, in ms. */
const MEASURE_AGAIN_MS = 500

type Name = {
  /** The nation's address; null for Azania's own. */
  slug: string | null
  text: string
  heart: LonLat
  /** The heartland's width, in blocks. */
  across: number
  chunks: number
  home: boolean
  group: SVGGElement
  label: SVGTextElement
  underline: SVGPathElement | null
  /** Its width per pixel of type, untracked, as the browser sets it; 0 until measured. */
  em: number
  /** What's set on the elements now, so a frame writes only what changed. */
  size: number
  tracking: number
  transform: string
  opacity: string
  visible: boolean
  /** Whether it holds a place on the page, which of NUDGES it holds, and since when it has held it or been without one. */
  placed: boolean
  nudge: number
  since: number
  /** How far it has faded in, 0 to 1, and where it's drawn about its heartland, gliding towards NUDGES[nudge]. */
  shown: number
  at: [number, number]
  /** The place it holds on the page, by which it's picked; null when it holds none. */
  box: Rect | null
  /**
   * The room it took on the page as last drawn: while it holds a place, the whole of its way there from where it's drawn
   * (only its place, once it's there); while it fades out, where it's drawn; null when it's not drawn.
   */
  room: Rect | null
  /** How far its heart was drawn from the globe's middle last frame, as a share of the radius, to tell one on its way to the limb. */
  out: number
  /**
   * How far its heart was from the globe's middle, and the globe's zoom, when it was last carried out over the limb, or
   * off the page; null if it wasn't, or has been shown, or gone round the back, since.
   */
  carried: { out: number; zoom: number } | null
}

export type Names = {
  /** Makes the names for a reading of the world (Azania's alone before one has come). */
  build: (world: Abroad | null, home: HomeName | null) => void
  /** Sets the names' inks, by the nation's address: its own colour's dark shade, or its stance's; and, with the diplomacy on, which are set loud (in bold) and which quiet. */
  colour: (styleOf: (slug: string) => { ink: string; voice: 'loud' | 'quiet' | null }) => void
  /**
   * Places the names for a frame drawn at `now`: each about its heartland,
   * where it faces the reader enough to be read and finds room, clear of
   * the `marks`. `shown` fades them all; `world` says whether the other
   * nations' names show at all; `lifted` is the open nation's address, whose
   * name comes second only to Azania's. Returns how soon, in ms, the names
   * want another frame though nothing else moves: 0 while a name fades or
   * glides, a little later for one kept waiting for its moment or for the
   * globe to come to rest, Infinity when all is settled.
   */
  place: (view: GlobeView, marks: NameMarks, shown: number, world: boolean, lifted: string | null, now: number) => number
  /** Whether Azania's name, facing the reader as last placed, found no room (and isn't merely waiting its moment): the globe may point the way to it instead. */
  wanting: () => boolean
  /** The nation whose name is under a point: its address, 'home' for Azania's, null for none. */
  at: (x: number, y: number) => string | null
  dispose: () => void
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

/** A box grown by `by` px all round (shrunk, for a negative `by`). */
const grown = (rect: Rect, by: number): Rect => ({ x: rect.x - by, y: rect.y - by, width: rect.width + 2 * by, height: rect.height + 2 * by })

const meets = (rect: Rect, others: Rect[]) => others.some((other) => overlaps(rect, other))

/** How many of the others a box overlaps. */
const count = (rect: Rect, others: Rect[]) => others.reduce((n, other) => n + (overlaps(rect, other) ? 1 : 0), 0)

/** The least box that holds both. */
const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}

export function createNames(svg: SVGSVGElement): Names {
  let names: Name[] = []
  // The names in the order they're placed: Azania's, the open nation's, then the rest by the ground they hold.
  let order: Name[] = []
  let orderedFor: string | null | undefined
  let lastFrame = 0
  // The view the names were last placed for, and when it last changed, to tell a globe on the move from one at rest.
  let lastView: GlobeView | null = null
  let movedAt = -Infinity
  let measuredAt = -Infinity
  let homeWanting = false

  const make = (entry: Pick<Name, 'slug' | 'text' | 'heart' | 'across' | 'chunks' | 'home'>): Name => {
    const group = document.createElementNS(SVG, 'g')
    group.setAttribute('visibility', 'hidden')
    const label = document.createElementNS(SVG, 'text')
    label.setAttribute('class', 'font-display')
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('font-weight', entry.home ? '700' : '500')
    label.setAttribute('stroke-width', entry.home ? '3.5' : '2.5')
    if (entry.home) label.setAttribute('fill', GROUND.sea800)
    label.textContent = entry.text
    group.appendChild(label)
    let underline: SVGPathElement | null = null
    if (entry.home) {
      underline = document.createElementNS(SVG, 'path')
      underline.setAttribute('stroke', GROUND.saffron)
      underline.setAttribute('stroke-width', '2')
      underline.setAttribute('stroke-linecap', 'round')
      group.appendChild(underline)
    }
    svg.appendChild(group)
    return {
      ...entry,
      group,
      label,
      underline,
      em: 0,
      size: 0,
      tracking: -1,
      transform: '',
      opacity: '',
      visible: false,
      placed: false,
      nudge: 0,
      since: -Infinity,
      shown: 0,
      at: [0, 0],
      box: null,
      room: null,
      out: 0,
      carried: null,
    }
  }

  /**
   * Each name's width as the browser sets it, at 100 px and untracked, read
   * for every name not yet measured in one go, so the page is laid out once
   * for all of them. A name that reads as nothing (its globe not laid out
   * yet) is tried again later; until then its width is estimated.
   */
  const measure = () => {
    const waiting = names.filter((name) => !name.em)
    for (const name of waiting) {
      name.label.setAttribute('font-size', '100')
      name.label.setAttribute('letter-spacing', '0')
    }
    for (const name of waiting) {
      name.em = name.label.getComputedTextLength() / 100
      // Its own size and spacing are written again when it's next placed.
      name.size = 0
    }
  }
  // Once the display type has come, the names are measured again in it.
  const remeasure = () => {
    for (const name of names) name.em = 0
    measuredAt = -Infinity
  }
  document.fonts?.addEventListener('loadingdone', remeasure)

  /**
   * The order the names are placed in. At rest, by rank: Azania's, the open
   * nation's, then the rest by the ground they hold. On the move, the names
   * already shown keep their places first, by rank, and only then do the
   * others find room, so a turning globe never has two names trade places;
   * once it comes to rest, rank has its way again.
   */
  const orderFor = (lifted: string | null, moving: boolean): Name[] => {
    if (orderedFor !== lifted) {
      const rank = (name: Name) => (name.home ? 0 : lifted !== null && name.slug === lifted ? 1 : 2)
      // The names are made greatest first, and the sort keeps that order within each rank.
      order = [...names].sort((a, b) => rank(a) - rank(b))
      orderedFor = lifted
    }
    if (!moving) return order
    const first = (name: Name) => name.placed || name.home || (lifted !== null && name.slug === lifted)
    return [...order.filter(first), ...order.filter((name) => !first(name))]
  }

  const hide = (name: Name) => {
    name.shown = 0
    if (name.visible) {
      name.visible = false
      name.group.setAttribute('visibility', 'hidden')
    }
  }

  return {
    build: (world, home) => {
      // A name the last reading had too is kept as it stands, elements, place and all, so a fresh reading of the world
      // changes only what it changes, and no name blinks.
      const before = new Map(names.map((name) => [name.slug ?? '', name]))
      const take = (entry: Pick<Name, 'slug' | 'text' | 'heart' | 'across' | 'chunks' | 'home'>): Name => {
        const kept = before.get(entry.slug ?? '')
        if (!kept || kept.home !== entry.home) return make(entry)
        before.delete(entry.slug ?? '')
        if (kept.text !== entry.text) {
          kept.label.textContent = entry.text
          kept.em = 0
        }
        return Object.assign(kept, entry)
      }
      const next: Name[] = []
      if (home)
        next.push(
          take({ slug: null, text: spoken(home.name).toUpperCase(), heart: toLonLat(home.heart), across: home.across, chunks: 0, home: true }),
        )
      // Every nation that might be named at the globe's zooms, the greatest first.
      const least = namedFrom(-5)
      for (const nation of [...(world?.nations ?? [])].sort((a, b) => b.chunks - a.chunks)) {
        if (nation.chunks < least || !nation.heart || !nation.extent) continue
        // Towns of Azania's Towny nation that the map doesn't hold as its own stay abroad, under Azania's name: never named twice.
        if (home && sameNation(nation.name, home.name)) continue
        next.push(
          take({
            slug: nation.slug,
            text: spoken(nation.name).toUpperCase(),
            heart: toLonLat(nation.heart),
            across: nation.extent.maxX - nation.extent.minX,
            chunks: nation.chunks,
            home: false,
          }),
        )
      }
      for (const gone of before.values()) gone.group.remove()
      names = next
      orderedFor = undefined
    },
    colour: (styleOf) => {
      for (const name of names) {
        if (!name.slug) continue
        const { ink, voice } = styleOf(name.slug)
        name.label.setAttribute('fill', ink)
        name.label.setAttribute('font-weight', voice === 'loud' ? '700' : '500')
        name.label.setAttribute('fill-opacity', voice === 'quiet' ? '0.6' : '1')
      }
    },
    place: (view, marks, shown, world, lifted, now) => {
      const dt = lastFrame ? Math.min(64, Math.max(0, now - lastFrame)) : FRAME_MS
      lastFrame = now
      const moved =
        lastView !== null &&
        (view.lon !== lastView.lon ||
          view.lat !== lastView.lat ||
          view.zoom !== lastView.zoom ||
          view.t !== lastView.t ||
          view.cx !== lastView.cx ||
          view.cy !== lastView.cy ||
          view.tilt !== lastView.tilt)
      lastView = { ...view }
      if (moved) movedAt = now
      // The globe is on the move until it has been still a moment (a frame drawn between two of a hand's moves is no rest),
      // and a frame is asked for once it has been, so that the names are placed by rank at rest.
      const moving = now - movedAt < SETTLE_MS
      // How soon the names want another frame, in ms: at once while one fades or glides, later for one kept waiting or a
      // globe not yet at rest, never when all is settled.
      let next = moving ? SETTLE_MS - (now - movedAt) : Infinity
      // A reader who asks for less motion has a name moved to its new place at once.
      const glide = lessMotion() ? 0 : GLIDE_MS
      if (now - measuredAt >= MEASURE_AGAIN_MS && names.some((name) => !name.em)) {
        measuredAt = now
        measure()
      }
      // The rooms taken so far this frame: the sieges' and the map's controls', then each name's as it's placed.
      const taken: Rect[] = [...marks.sieges, ...marks.controls]
      // The rooms spoken for, as each name is reached this frame, which no name comes or moves into though one already there
      // keeps its place: where the names fading out are drawn, and, at rest, the places kept for names waiting to come back.
      // And the rooms the names took last frame, kept for those not yet reached this frame. A name gliding to a new place
      // keeps its way clear of all of them; a name coming, of those spoken for and those fading out.
      const claimed: Rect[] = []
      const before = new Map<Name, Rect>()
      for (const name of names) if (name.room) before.set(name, name.room)
      const R = radiusAt(view.zoom)
      const least = namedFrom(view.zoom)
      const onGlobeOnly = view.t >= 0.999 && (view.tilt ?? 1) >= 0.999
      const page = marks.page
      homeWanting = false
      for (const name of orderFor(lifted, moving)) {
        before.delete(name)
        const spot = curlPoint(name.heart, view)
        const out = Math.hypot(spot.x - view.cx, spot.y - view.cy) / R
        const leaving = moving && out > name.out + OUTWARD
        name.out = out
        // Round the back, or before the names are shown, a name is simply gone (and one carried out over the limb, gone
        // round the back, comes back as any other would).
        if (shown <= 0 || spot.facing < FACING) {
          if (name.placed) name.since = now
          if (spot.facing < FACING) name.carried = null
          name.placed = false
          name.box = null
          name.room = null
          hide(name)
          continue
        }
        const size = nationFontSize(name.chunks, view.zoom, name.home)
        const bare = name.em ? name.em * size : textWidth(name.text, size)
        const across = (name.across / BLOCKS_PER_RADIAN) * R * Math.cos(name.heart.lat)
        const spread = (across * 0.75 - bare) / Math.max(1, name.text.length - 1)
        const tracking = Math.max(size * (name.home ? 0.3 : 0.12), Math.min(size * 0.7, spread))
        // Laid on the curve: a touch smaller towards the limb, and foreshortened along the way to it.
        const facing = Math.min(1, Math.max(0, spot.facing))
        const shrink = 0.8 + 0.2 * facing
        const squash = mix(1, facing, 0.55)
        const radial = Math.atan2(spot.y - view.cy, spot.x - view.cx)
        const angle = (radial * 180) / Math.PI
        const natural = bare + tracking * name.text.length + 6
        // The room it takes on the page, foreshortened: the box the squashed name fits in, square to the page.
        const q = 1 - squash
        const [c, sn] = [Math.cos(radial), Math.sin(radial)]
        const [hw, hh] = [(natural * shrink) / 2, ((size + 6) * shrink) / 2]
        const width = 2 * (Math.abs(1 - q * c * c) * hw + Math.abs(q * c * sn) * hh)
        const height = 2 * (Math.abs(q * c * sn) * hw + Math.abs(1 - q * sn * sn) * hh)
        const boxOf = (at: readonly [number, number]): Rect => ({
          x: spot.x + (at[0] - 0.5) * width,
          y: spot.y + (at[1] - 0.5) * height,
          width,
          height,
        })
        const boxAt = (nudge: number) => boxOf(NUDGES[nudge])
        // A name stays on the ground and on the page: a place that would set either end of it out past the limb, or any of
        // it off the page (or within `spare` px of its edge), isn't tried.
        const inside = (x: number, y: number, within: number) => Math.hypot(x - view.cx, y - view.cy) < R * within
        const onGlobe = (box: Rect, within: number) =>
          !onGlobeOnly || (inside(box.x, box.y + box.height / 2, within) && inside(box.x + box.width, box.y + box.height / 2, within))
        const onPage = (box: Rect, spare: number) =>
          !page ||
          (box.x - spare >= page.x &&
            box.y - spare >= page.y &&
            box.x + box.width + spare <= page.x + page.width &&
            box.y + box.height + spare <= page.y + page.height)
        // Where it's drawn now, if it's shown at all: a name gliding to a new place passes over all that lies between.
        const drawn = name.shown > 0 ? boxOf(name.at) : null
        // Whether a box keeps the gap from the rooms taken so far this frame; and, unless it's the place the name holds, from
        // those spoken for and the names fading out; and, for a name shown gliding to a new place, from every other name,
        // as last drawn.
        const clear = (box: Rect, gap: number, of: 'taken' | 'claimed' | 'all') => {
          const around = grown(box, gap)
          if (meets(around, taken)) return false
          if (of === 'taken') return true
          if (meets(around, claimed)) return false
          for (const [other, room] of before) if ((of === 'all' || !other.placed) && overlaps(around, room)) return false
          return true
        }

        // Its place this frame. A name that holds a place moves off a mark only once the mark is well into it; any other
        // place, and a name coming back, needs the mark well clear.
        let chosen = -1
        // Whether it's carried out over the limb, or off the page, this frame; and whether it's only waiting its moment.
        let carried = false
        let waiting = false
        if (name.home || (world && name.chunks >= least)) {
          const coming = !name.placed
          // A name kept waiting only for its moment is looked at again once the moment has passed. At rest it keeps
          // meanwhile the room it will come back to, so that no lesser name comes into it only to give it back.
          waiting = coming && now - name.since < RETURN.ms
          if (waiting) next = Math.min(next, RETURN.ms - (now - name.since))
          const keeping = waiting && !moving
          const facingEnough = !moving || spot.facing >= (leaving ? RETURN.leaving : RETURN.facing)
          const carriedOut = name.carried
          const backIn = !carriedOut || out <= carriedOut.out - RETURN.back || Math.abs(view.zoom - carriedOut.zoom) >= RETURN.zoom
          if (!coming || (backIn && ((!waiting && facingEnough) || keeping))) {
            // Failing a place clear of the marks, the one covering the fewest.
            let fallback = -1
            let fewest = Infinity
            // On the move, a name already shown tries the place it holds before any other, and keeps it while it has room
            // there, mark or no mark: it moves only when it must, and to a better place only once the globe rests.
            const holding = !coming && moving
            for (let k = holding ? -1 : 0; k < NUDGES.length; k++) {
              const nudge = k < 0 ? name.nudge : k
              if (holding && k >= 0 && nudge === name.nudge) continue
              const box = boxAt(nudge)
              const kept = !coming && nudge === name.nudge
              // The place it holds needs only to keep a hair's gap; any other, the full gap; and while the globe turns, any
              // place a name comes back to, or glides to, needs room to spare as well, and to stand well inside the limb and
              // the page, so that it isn't taken only to close again. On the move, a name whose place goes out over the
              // limb, or off the page, as its heart heads that way is on its way out: it goes, rather than step inside for a
              // frame or two. One made to leave its place otherwise, crowded, or with the limb come to it as the globe zooms
              // or turns aside, tries its others first.
              const strict = moving && !kept
              const gap = kept ? HOLD : strict ? GAP + RETURN.px : GAP
              if (!onGlobe(box, strict ? RETURN.inside : INSIDE) || !onPage(box, strict ? RETURN.px : 0)) {
                if (holding && kept && leaving) {
                  carried = true
                  break
                }
                continue
              }
              const gliding = drawn !== null && !kept && !keeping
              if (!clear(box, gap, kept ? 'taken' : gliding ? 'all' : 'claimed')) continue
              // A name shown glides to a new place only where its way there, from where it's drawn, passes over no other
              // name but for the blank margins about their letters: it slides along one that crowds it, never over one.
              if (gliding && drawn && !clear(union(drawn, box), -WAY_SLACK, 'all')) continue
              if (kept && moving) {
                chosen = nudge
                break
              }
              // The marks well into the place it holds, or well clear of any other: none, and the place is its; else the
              // place covering the fewest is remembered, the one it holds before another covering as many.
              const grace = grown(box, kept ? -MARK_GRACE : MARK_GRACE)
              const covered = count(grace, marks.places) + (name.home ? 0 : count(grace, marks.towns))
              if (covered === 0) {
                chosen = nudge
                break
              }
              if (covered < fewest || (kept && covered === fewest)) {
                fewest = covered
                fallback = nudge
              }
            }
            // Nowhere clear of the marks: the place covering the fewest, which a name of no special standing takes only
            // for a mark or so, giving way rather than sit over more.
            if (chosen < 0 && (fewest <= MARKS_BORNE || name.home || name.slug === lifted)) chosen = fallback
            if (keeping) {
              if (chosen >= 0) claimed.push(boxAt(chosen))
              chosen = -1
            }
          }
        }
        // Azania's name, facing the reader and shown or wanted this frame, found no room: the globe may point the way.
        if (name.home) homeWanting = chosen < 0 && !waiting
        // Whether it was gliding already, before any new place is given it this frame.
        const was = NUDGES[name.nudge]
        const sliding = name.shown > 0 && (name.at[0] !== was[0] || name.at[1] !== was[1])

        if ((chosen >= 0) !== name.placed) name.since = now
        if (chosen >= 0) name.carried = null
        else if (carried) name.carried = { out, zoom: view.zoom }
        if (chosen >= 0) {
          // A name coming in from nothing comes in where it's placed; one already shown glides there.
          if (name.shown <= 0) name.at = [...NUDGES[chosen]]
          name.placed = true
          name.nudge = chosen
          name.box = boxAt(chosen)
        } else {
          name.placed = false
          name.box = null
        }
        // Faded in or out, and glided towards its place. A name come into room another is still drawn in (one it has put out,
        // as rank has its way at rest) waits for that one to fade before it fades in, so the two never show over each other.
        // A fade or glide steps by the frame's own time while it's under way, and by a frame's worth on the frame it begins,
        // whatever pause came before it (a globe at rest draws only when something changes), so none begins with a jump.
        const box = name.box
        let crowded = box !== null && name.shown < 1 && meets(box, claimed)
        if (box && name.shown < 1) for (const room of before.values()) crowded ||= overlaps(box, room)
        const target = name.placed ? 1 : 0
        if (crowded) next = 0
        else if (name.shown !== target) {
          const tick = name.shown > 0 && name.shown < 1 ? dt : FRAME_MS
          name.shown = target
            ? Math.min(1, name.shown + tick / FADE_IN_MS)
            : Math.max(0, name.shown - tick / FADE_OUT_MS)
          if (name.shown !== target) next = 0
          // A name that gave way is gone from when it has faded out, so it's out of sight a moment before it comes back.
          else if (!target) name.since = now
        }
        const goal = NUDGES[name.nudge]
        if (name.at[0] !== goal[0] || name.at[1] !== goal[1]) {
          const k = glide ? 1 - Math.exp(-(sliding ? dt : FRAME_MS) / glide) : 1
          name.at = [name.at[0] + (goal[0] - name.at[0]) * k, name.at[1] + (goal[1] - name.at[1]) * k]
          if (Math.abs(goal[0] - name.at[0]) < 0.003 && Math.abs(goal[1] - name.at[1]) < 0.005) name.at = [...goal]
          else next = 0
        }
        // The room it takes, for the names after it this frame and for all of them next frame: while it holds a place, the
        // whole of its way there from where it's drawn; while it fades out, where it's drawn.
        if (name.box) {
          name.room = union(boxOf(name.at), name.box)
          taken.push(name.room)
        } else {
          name.room = name.shown > 0 ? boxOf(name.at) : null
          if (name.room) claimed.push(name.room)
        }
        if (name.shown <= 0) {
          hide(name)
          continue
        }

        if (size !== name.size || Math.abs(tracking - name.tracking) > 0.25) {
          name.size = size
          name.tracking = tracking
          name.label.setAttribute('font-size', String(size))
          name.label.setAttribute('letter-spacing', tracking.toFixed(2))
          // Spacing follows each letter, the last too: the line is set back by half of it to stay centred.
          name.label.setAttribute('x', (tracking / 2).toFixed(2))
          name.label.setAttribute('y', (size * 0.36).toFixed(2))
          name.underline?.setAttribute('d', `M${(-natural * 0.2).toFixed(1)} ${(size * 0.36 + 5).toFixed(1)}h${(natural * 0.4).toFixed(1)}`)
        }
        const middle = `translate(${(spot.x + name.at[0] * width).toFixed(1)} ${(spot.y + name.at[1] * height).toFixed(1)})`
        const lying = squash > 0.995 ? '' : ` rotate(${angle.toFixed(1)}) scale(${squash.toFixed(3)} 1) rotate(${(-angle).toFixed(1)})`
        const transform = `${middle}${lying} scale(${shrink.toFixed(3)})`
        if (transform !== name.transform) {
          name.transform = transform
          name.group.setAttribute('transform', transform)
        }
        const opacity = ((name.home ? 1 : 0.85) * smoothstep(FACING, name.home ? SQUARE.home : SQUARE.other, spot.facing) * shown * name.shown).toFixed(3)
        if (opacity !== name.opacity) {
          name.opacity = opacity
          name.group.setAttribute('opacity', opacity)
        }
        if (!name.visible) {
          name.visible = true
          name.group.setAttribute('visibility', 'visible')
        }
      }
      return next
    },
    wanting: () => homeWanting,
    at: (x, y) => {
      for (const name of names) {
        const box = name.box
        if (box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return name.slug ?? 'home'
      }
      return null
    },
    dispose: () => {
      document.fonts?.removeEventListener('loadingdone', remeasure)
      for (const name of names) name.group.remove()
      names = []
      order = []
    },
  }
}
