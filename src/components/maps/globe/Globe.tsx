'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'

import { abroadHomeBounds, homeNationOf, nationFit, sameNation, type Abroad, type AbroadTown } from '@/maps/abroad'
import { partAt, partFocus } from '@/maps/claims'
import { heartland, spoken, townFit, type MapTown } from '@/maps/data'
import { inOutlines, type Point } from '@/maps/geo'
import {
  between,
  BLOCKS_PER_RADIAN,
  curlPoint,
  faceable,
  faceOfFlat,
  GLOBE,
  pickAt,
  pickLonLat,
  PULL,
  radiusAt,
  restFrame,
  slerp,
  TILT,
  toBlock,
  toLonLat,
  wrapAngle,
  zoomAround,
  zoomForRadius,
  type GlobeView,
  type Insets,
  type LonLat,
  type RestFrame,
} from '@/maps/globe'
import { pixelsPerBlock } from '@/maps/palette'
import { azaniaMask, nationNumbering, NUMBER, numberAt, paintAzania, paintWorld, type Numbers } from '@/maps/raster'
import { SHEET_URL } from '@/maps/sheet'
import { siegesOnMap } from '@/maps/besieged'
import type { MapPosition, MapSelection } from '@/maps/url'
import { boundsCentre, FLAT_MIN_ZOOM, WHEEL } from '@/maps/view'

import { useMaps, type MapsActions } from '../context'
import { useLatest } from '../hooks'
import type { Rect } from '../layers/projection'
import type { LookTarget } from '../MapScene'
import { attachControls, type Controls } from './controls'
import { createEngine, type Engine, type Look, type Picture } from './engine'
import { createNames, type NameMarks, type Names } from './labels'
import { buildMarks, buildPlayers, NO_MARKS, playerHits, type MarkHit, type PlayerHit } from './marks'
import { reachRing } from './reach'
import { createMotion, ease, lessMotion, mix, smoothstep } from './motion'
import { nameStyle, paletteBytes } from './palette'
import { releaseSheet, warmSheet } from './sheet'
import type { GlobeEntry, GlobePhase, GlobePick, GlobeProps, GlobePull, LeaveRequest } from './types'

/**
 * The world as a globe: the flat map's own picture of the world wrapped
 * round a ball, every nation edged and washed in its colour on it, Azania
 * in saffron and glowing, the nations named, the server's trading outposts,
 * the sieges and the players online as dots, a lagoon light about its
 * limb. It turns under the hand and zooms like the flat map; a click lands
 * on the flat map there, and opens what was clicked; zoomed in close it
 * hands back to the flat map where the reader is. Opened by the shell
 * (../MapsShell.tsx) in front of the flat map, which stays underneath,
 * never unmounted, ready to take over.
 *
 * It comes and goes as the flat map itself, curling up. Pulled out past
 * its farthest zoom, the flat map is drawn here as its own twin, to the
 * pixel, and the original veiled beneath; the twin then rolls round a ball
 * that tightens as the pull goes on, its edges rolling back and its poles
 * gathering, and let go far enough it closes into the globe, which
 * settles in the middle of the page as the deep comes up behind it. Going
 * back, the globe unrolls into the flat map where the reader was looking,
 * the flat map under it standing just so, and the veil lifts. A reader
 * who asks for less motion has the globe fade in and out instead.
 *
 * The React here only mounts the elements and passes changes on; the
 * globe itself is a stage of plain objects (createStage, below) with a
 * frame loop that draws only when something has changed, and nothing at
 * all while it's closed, hidden or out of sight.
 */
export function Globe(props: GlobeProps) {
  const maps = useMaps()
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)
  const deepRef = useRef<HTMLDivElement>(null)
  const compassRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const hintId = useId()
  const [facing, setFacing] = useState('')
  const latest = useLatest(props)
  const context = useLatest(maps)

  useLayoutEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const svg = svgRef.current
    const chip = chipRef.current
    const deep = deepRef.current
    const compass = compassRef.current
    if (!root || !canvas || !svg || !chip || !deep || !compass) return
    const stage = createStage({ root, canvas, svg, chip, deep, compass }, { props: latest, maps: context, say: setFacing })
    stageRef.current = stage
    if (stage.alive) latest.current.onApi(stage.api)
    return () => {
      stage.dispose()
      stageRef.current = null
    }
    // Made once; what changes reaches it through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data, world, war, extras, selection } = maps
  useEffect(() => stageRef.current?.setGround(data.towns, world), [data.towns, world])
  useEffect(
    () => stageRef.current?.setInks(world, extras.world || extras.diplomacy, extras.diplomacy ? data.relations : null),
    [world, extras.world, extras.diplomacy, data.relations],
  )
  useEffect(
    () => stageRef.current?.setMarks(data.towns, world, siegesOnMap(war.sieges, data, world), selection, extras.world || extras.diplomacy),
    [data, world, war.sieges, selection, extras.world, extras.diplomacy],
  )
  useEffect(() => stageRef.current?.setPlayers(extras.players), [extras.players])
  useEffect(() => stageRef.current?.setReach(extras.reach, war.radius), [extras.reach, war.radius, war.capitals, data.towns, world])
  useEffect(() => stageRef.current?.setInsets(props.insets), [props.insets])
  useEffect(() => stageRef.current?.setHidden(props.hidden), [props.hidden])
  // Last, once the ground and the marks are in: open as asked.
  useEffect(() => {
    stageRef.current?.open(latest.current.entry)
    // On mounting only; opening again goes through the api's enter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      aria-describedby={hintId}
      aria-label="The world as a globe"
      aria-roledescription="globe"
      className="az-globe absolute inset-0 z-[5]"
      data-phase="closed"
      ref={rootRef}
      role="application"
      tabIndex={0}
    >
      <div aria-hidden="true" className="az-globe-deep absolute inset-0" ref={deepRef} />
      <canvas aria-hidden="true" className="absolute inset-0 h-full w-full" ref={canvasRef} />
      <svg aria-hidden="true" className="az-globe-names pointer-events-none absolute inset-0 h-full w-full" ref={svgRef} />
      <div
        aria-hidden="true"
        className="az-globe-chip pointer-events-none absolute left-0 top-0 border border-sand-300 bg-sand-50 px-2 py-1 leading-tight text-ink-900 shadow-[0_2px_8px_rgba(22,25,31,0.16)]"
        ref={chipRef}
      >
        <span className="block font-display text-[14px]" />
        <span className="mt-0.5 block font-label text-[12px] text-ink-700" hidden />
      </div>
      {/* Azania, when it's round the back: a way to it on the limb. The Home key does the same, so it's not read out. */}
      <div
        aria-hidden="true"
        className="az-globe-compass absolute left-0 top-0 flex items-center gap-1 px-2 py-1.5 font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron-300"
        ref={compassRef}
      >
        {/* An arrow with a shaft, which reads as an arrow at any angle it's turned to, where a bare chevron reads as a letter. */}
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16">
          <path d="M2.5 8h10M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
        <span />
      </div>
      <p className="sr-only" id={hintId}>
        Arrow keys turn it, plus and minus zoom, Enter opens the flat map at the middle, Home turns to Azania, Escape goes
        back to the flat map.
      </p>
      <p aria-live="polite" className="sr-only" role="status">
        {facing}
      </p>
    </div>
  )
}

/** The globe's workings: what the component passes on, and what it asks of the globe. */
type Stage = {
  /** False when the globe couldn't be made here (it has said so through onFail). */
  alive: boolean
  api: Parameters<GlobeProps['onApi']>[0]
  open: (entry: GlobeEntry) => void
  setGround: (towns: MapTown[], world: Abroad | null) => void
  setInks: (world: Abroad | null, showWorld: boolean, relations: MapsActions['data']['relations'] | null) => void
  setMarks: (
    towns: MapTown[],
    world: Abroad | null,
    sieges: ReturnType<typeof siegesOnMap>,
    selection: MapSelection | null,
    showWorld: boolean,
  ) => void
  setPlayers: (on: boolean) => void
  /** The reach of Azania's war, shown or not, and how far it goes in blocks. */
  setReach: (on: boolean, radius: number) => void
  setInsets: (insets: Insets) => void
  setHidden: (hidden: boolean) => void
  dispose: () => void
}

type Elements = {
  root: HTMLDivElement
  canvas: HTMLCanvasElement
  svg: SVGSVGElement
  chip: HTMLDivElement
  deep: HTMLDivElement
  compass: HTMLDivElement
}

type Hooks = {
  props: RefObject<GlobeProps>
  maps: RefObject<MapsActions>
  say: (words: string) => void
}

/** How long the globe takes to come and go by fading: its zoom settling from a little closer as it comes. */
const FADE_IN_MS = 220
const FADE_OUT_MS = 200
const FADE_PLAIN_MS = 150
const FADE_GROW = 1.06
/** An eased turn or zoom by the keyboard or the buttons, and the lift as a phone's sheet comes up. */
const EASED_MS = 250
const LIFT_MS = 300
/** A turn towards something takes longer the further it goes, within these. */
const TURN_MS = { least: 250, most: 600 }
/**
 * How near a mark a click must be to be on it, in px: further for a finger,
 * though only over open ground and the sea; over a claim a finger must come
 * as near as a pointer, so a tap on a nation beside a mark opens the nation.
 * And how near a player the pointer must pass to be told who.
 */
const MARK_REACH = { mouse: 12, touch: 22 }
const PLAYER_REACH = 8
/** A battle's ring swells once every so often, drawn no more often than this. */
const PULSE_MS = 1600
const PULSE_FRAME_MS = 33
/** Turning to Azania from its compass on the limb. */
const COMPASS_TURN_MS = 900
/** The compass shows while Azania's heart faces the reader less than this (its name is faint at best until then), or while its name finds no room. */
const COMPASS_FACING = 0.2
/** While the flat map's own picture is a canvas still filling with tiles, it's taken up again this often, for at most this long. */
const PICTURE_REFRESH_MS = 1000
const PICTURE_REFRESH_FOR_MS = 20_000
const PICTURE_RETRY_MS = 30_000
/** The nation numbers are painted in slices of the browser's idle time no longer than this. */
const SLICE_MS = 8
/** Frames slower than this on average, while moving, draw with fewer pixels. */
const SLOW_FRAME_MS = 28
/** Facing is said this long after the keyboard's last turn. */
const SAY_AFTER_MS = 600

/**
 * The curl up into the globe, in ms from the moment it's asked for: the
 * sheet rolls into a ball over CURL_MS (less, by as far as a pull has
 * already curled it); a little after it starts, the ball eases to its
 * resting size and place; the deep comes up behind it; and last of all
 * the names come in, and the globe is open.
 */
const CURL_MS = 750
const CURL_GROW = { delay: 250, ms: 800 }
const CURL_DEEP = { delay: 300, ms: 600 }
const CURL_NAMES = { delay: 900, ms: 250 }
/** The ball tips to face the reader's latitude only as it all but closes: from this share of the way through the curl, over this long. */
const CURL_TILT = { after: 0.85, ms: 350 }
/**
 * And back: the names go at once, the deep and the glow soon after, the
 * ball unrolls into the flat map over UNCURL_MS, and once it lies flat the
 * flat map's veil lifts and the twin over it fades away.
 */
const UNCURL_NAMES_MS = 120
const UNCURL_DEEP_MS = 300
const UNCURL_MS = 650
const UNCURL_TILT_MS = 250
const CANVAS_OUT_MS = 160
/** The button curls the flat map up from this zoom out; closer in, where the curl would start from a sliver of the world, the globe fades in. */
const CURL_FROM_ZOOM = -5.5
/** The latitude the globe faces when the flat map curls up, held this side of the poles; and, unrolling, the most it ever faces. */
const HOLD_FLAT = (70 * Math.PI) / 180
/** A pull that falls short tells the reader to keep going, unless the globe's code came so long after that it's no longer news. */
const HINT_WITHIN_MS = 2000
/** A pull that opened the globe this long before its code came is let go: too late to follow. */
const PULL_STALE_MS = 3000
/** A pull that says nothing more for this long has been let go of somewhere the map didn't hear. */
const PULL_LOST_MS = 4000
/** The world's picture, fetched for the globe rather than borrowed from the flat map, comes up over this long. */
const SHEET_IN_MS = 400
/** The longest the first frame waits for the world's picture to be decoded off the main thread (./sheet.ts). */
const SHEET_WAIT_MS = 400
/** An address's zoom this near the globe's resting zoom is taken for it: the address keeps zooms only to a quarter. */
const REST_SNAP = 0.125
/** How far round the limb Azania's compass may slide, either way, in search of room beside the globe. */
const COMPASS_SLIDE = { most: Math.PI / 2, step: Math.PI / 60 }

const ZERO_LOOK: Look = { overlay: 1, glow: 1, marks: 1, sheet: 1, selected: -1, hover: -1, flatX: 0, pulse: 0 }

/** Where something to look at is: its middle. */
const centreOf = (target: LookTarget): Point => ('bounds' in target ? boundsCentre(target.bounds) : target.centre)

/** Where to look for a town abroad: the claim holding its home, else its home up close (as layers/AbroadLayer.tsx → abroadTownTarget). */
const townTarget = (town: AbroadTown): LookTarget | null => {
  const bounds = abroadHomeBounds(town)
  if (bounds) return { bounds }
  return town.home ? { centre: town.home, zoom: 0 } : null
}

/**
 * Where idle time is to be had: the browser's own, else a moment's pause.
 * A browser never idle (a slow device, the globe turning) is taken a slice
 * of SLICE_MS anyway after a tenth of a second, so the work still gets done.
 */
function whenIdle(run: (deadline: () => number) => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(
      (deadline) => run(() => (deadline.didTimeout ? SLICE_MS : deadline.timeRemaining())),
      { timeout: 100 },
    )
    return () => window.cancelIdleCallback(handle)
  }
  const handle = window.setTimeout(() => {
    const start = performance.now()
    run(() => SLICE_MS - (performance.now() - start))
  }, 16)
  return () => window.clearTimeout(handle)
}

function createStage(elements: Elements, hooks: Hooks): Stage {
  const { root, canvas, svg, chip, deep: deepElement, compass } = elements
  const props = () => hooks.props.current
  const maps = () => hooks.maps.current

  let phase: GlobePhase = 'closed'
  let disposed = false
  const setPhase = (next: GlobePhase) => {
    phase = next
    root.dataset.phase = next
    props().onPhase(next)
  }

  let engine: Engine | null = null
  try {
    engine = createEngine(canvas, {
      onFail: (reason) => {
        if (!disposed) props().onFail(reason)
      },
      onRestored: () => invalidate(),
      // Lost while closed, lingering only so as to open again at once, it's let go of quietly, to be made
      // afresh when next wanted. Open, it waits a moment for the context to come back; so it does mid-way in
      // or out while the page is out of sight (a phone's tab put away), where nothing shows until the reader
      // is back. Lost mid-way in sight, with the flat map veiled beneath it, it isn't waited for: the flat map
      // comes back at once.
      onLost: () => {
        if (disposed) return false
        if (phase === 'closed') {
          props().onGone()
          return false
        }
        if (phase === 'open' || document.visibilityState !== 'visible') return true
        props().onFail('lost')
        return false
      },
    })
  } catch {
    // createEngine has said why through onFail.
  }

  const dead: Stage = {
    alive: false,
    api: { enter: () => {}, leave: () => {}, face: () => {}, zoomBy: () => {} },
    open: () => {},
    setGround: () => {},
    setInks: () => {},
    setMarks: () => {},
    setPlayers: () => {},
    setReach: () => {},
    setInsets: () => {},
    setHidden: () => {},
    dispose: () => {
      disposed = true
    },
  }
  if (!engine) return dead
  const gl = engine

  const motion = createMotion()
  const names: Names = createNames(svg)
  let size = { width: root.clientWidth || 1, height: root.clientHeight || 1 }
  let insets: Insets = props().insets
  let frame: RestFrame = restFrame(size.width, size.height, insets)
  let view: GlobeView = { lon: 0, lat: 0, zoom: frame.zoomRest, t: 1, cx: frame.cx, cy: frame.cy }
  const look: Look = { ...ZERO_LOOK }
  let namesShown = 1
  // The deep behind the globe and the canvas itself, each faded on its own as the flat map curls up and back.
  let deep = 1
  let canvasShown = 1
  let hidden = props().hidden
  let showWorld = true
  let frames = 0
  let raf = 0
  // Where the flat map's zoom was as the globe opened by hand, and whether the reader has turned or zoomed the
  // globe since: a globe left as it opened goes back to that zoom, so a look at the globe and back leaves the
  // flat map just as it was.
  let cameFrom: number | null = null
  let handled = false
  // The zoom buttons pressed while the globe hands back: given to the flat map once the globe has gone. And
  // those pressed to zoom out while it opens: the globe's own, once it's open.
  let owedZoom = 0
  let heldZoom = 0

  const placeBackdrop = () => {
    root.style.setProperty('--az-globe-cx', `${view.cx.toFixed(1)}px`)
    root.style.setProperty('--az-globe-cy', `${view.cy.toFixed(1)}px`)
  }
  const shownAs = new WeakMap<HTMLElement, string>()
  const fadeTo = (element: HTMLElement, opacity: number) => {
    const value = opacity >= 0.999 ? '' : opacity.toFixed(3)
    if (shownAs.get(element) === value) return
    shownAs.set(element, value)
    element.style.opacity = value
  }

  let pulseTimer = 0

  /**
   * Azania's way home, when it's round the back: on the limb, the short
   * way round to it, an arrow pointing on and its name; a click turns
   * the globe to it. Only while the globe is open and Azania faces away,
   * or faces the reader but its name finds no room (crowded out, or cut
   * by the limb or the page), when the arrow points back in at it: Azania
   * is always named or pointed to while any of it is in sight.
   */
  let homeHeart: LonLat | null = null
  let compassShown = false
  const [compassArrow, compassName] = compass.children as unknown as [SVGSVGElement, HTMLSpanElement]
  const placeCompass = () => {
    const spot = homeHeart && phase === 'open' ? curlPoint(homeHeart, view) : null
    const shown = Boolean(spot && (spot.facing < COMPASS_FACING || names.wanting()))
    if (shown !== compassShown) {
      compassShown = shown
      compass.toggleAttribute('data-shown', shown)
    }
    if (!spot || !shown) return
    // Just beyond the limb, the short way round to Azania. Where the page has no room for it there (a phone's
    // narrow sides), it slides round the limb to the nearest place that has, its arrow still pointing the short
    // way; for a globe bigger than the page, it keeps to the page's edge, clear of the readouts at its foot.
    const R = radiusAt(view.zoom)
    const w = compass.offsetWidth
    const h = compass.offsetHeight
    const foot = insets.bottom ? insets.bottom + 12 : 64
    const along = (angle: number) => {
      const ux = Math.cos(angle)
      const uy = Math.sin(angle)
      const room = Math.min(
        ux > 0 ? (size.width - 12 - w / 2 - view.cx) / ux : ux < 0 ? (12 + w / 2 - view.cx) / ux : Infinity,
        uy > 0 ? (size.height - foot - h / 2 - view.cy) / uy : uy < 0 ? (insets.top + 12 + h / 2 - view.cy) / uy : Infinity,
      )
      return { ux, uy, room, reach: R + 8 + (Math.abs(ux) * w + Math.abs(uy) * h) / 2 }
    }
    const dx = spot.x - view.cx
    const dy = spot.y - view.cy
    const towards = Math.hypot(dx, dy) < 1e-3 ? Math.PI / 2 : Math.atan2(dy, dx)
    let at = along(towards)
    for (let turn = COMPASS_SLIDE.step; at.reach > at.room && turn <= COMPASS_SLIDE.most; turn += COMPASS_SLIDE.step)
      at = [along(towards - turn), along(towards + turn)].find((each) => each.reach <= each.room) ?? at
    if (at.reach > at.room) at = along(towards)
    const reach = Math.max(0, Math.min(at.reach, at.room))
    const x = view.cx + at.ux * reach - w / 2
    const y = view.cy + at.uy * reach - h / 2
    compass.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    // On round the back; back in, at Azania in sight.
    const pointing = spot.facing < 0 ? towards : towards + Math.PI
    compassArrow.style.transform = `rotate(${((pointing * 180) / Math.PI).toFixed(1)}deg)`
  }
  const onCompassDown = (event: PointerEvent) => event.stopPropagation()
  const onCompass = () => {
    if (phase !== 'open') return
    controls?.halt()
    handled = true
    turnTo(faceable(azaniaFace()), view.zoom, settle, COMPASS_TURN_MS)
  }
  compass.addEventListener('pointerdown', onCompassDown)
  compass.addEventListener('click', onCompass)

  /**
   * The flat map as it stands this moment, as the globe's view of it: the
   * spot under a point of the page (`at`; the middle, if null) faced, its
   * latitude held within `hold` and drawn where that latitude lies on the
   * flat map, at the flat map's own zoom, and the spot's x as the flat map
   * has it, past the world's edge in an echo. Drawn flat, this is the flat
   * map to the pixel; curled, the same sheet rolled up.
   */
  const planeOf = (at: [number, number] | null, hold: number): (Omit<GlobeView, 't'> & { flatX: number }) | null => {
    const flat = props().flat.current?.view()
    if (!flat) return null
    const point: [number, number] = at ?? [flat.width / 2, flat.height / 2]
    const { face, rawX } = faceOfFlat(flat, point)
    const ppb = pixelsPerBlock(flat.zoom)
    const z = flat.centre[1] + (point[1] - flat.height / 2) / ppb
    const lat = Math.max(-hold, Math.min(hold, face.lat))
    return { lon: face.lon, lat, zoom: flat.zoom, cx: point[0], cy: point[1] + (-lat * BLOCKS_PER_RADIAN - z) * ppb, flatX: rawX }
  }
  /**
   * The point of the page the flat map curls up about, and the globe
   * opens facing: where the globe rests, so the spot there stays where it
   * is through the curl, and is where the globe hands back to. (The middle
   * of the page, where the rest is a little above it, clear of the map's
   * foot, would walk the flat map down the world a little each time.)
   */
  const twinAt = (): [number, number] => [frame.cx, frame.cy]
  // While the globe follows the flat map (pulled, or unrolling into it), each frame stands it where the flat map is.
  // Unrolling about a spot off the middle, it turns as it goes from the face it had (`from`) to the flat map's, a share
  // `turned` of the way, the flat map's spot held all the while where the flat map has it.
  let follow: { at: [number, number] | null; hold: number; from?: LonLat; turned?: number } | null = null
  const followFlat = (): boolean => {
    if (!follow) return false
    const plane = planeOf(follow.at, follow.hold)
    if (!plane) return false
    const { flatX, ...where } = plane
    const turned = follow.turned ?? 1
    if (!follow.from || turned >= 1) {
      view = { ...view, ...where }
      look.flatX = flatX
      return true
    }
    const face = slerp(follow.from, where, turned)
    const facing: GlobeView = { ...view, zoom: where.zoom, lon: face.lon, lat: face.lat, cx: 0, cy: 0 }
    const spot = curlPoint(where, facing)
    view = { ...facing, cx: where.cx - spot.x, cy: where.cy - spot.y }
    look.flatX = flatX + wrapAngle(face.lon - where.lon) * BLOCKS_PER_RADIAN
    return true
  }

  /**
   * The veil over the flat map's own picture (../MapScene.tsx → veil):
   * asked for, it falls only once a frame of the twin has been drawn, the
   * frame after, so the reader never sees the map missing, even should
   * the first frame be slow in coming.
   */
  let veilWanted = false
  let veiled = false
  let veilFrame = 0
  const setVeil = (on: boolean) => {
    veilWanted = on
    if (on) return invalidate()
    cancelAnimationFrame(veilFrame)
    veilFrame = 0
    if (!veiled) return
    veiled = false
    props().flat.current?.veil(false)
  }

  // A pull being followed: how far the sheet is to curl, eased after as the wheel's zoom is.
  let scrubTo = 0
  let pullLost = 0
  const scrubOf = (levels: number) => PULL.scrubMax * (1 - Math.exp(-Math.max(0, levels) / PULL.scrubScale))
  const scrub = (dt: number): boolean => {
    if (motion.running('curl')) return false
    const k = 1 - Math.exp(-dt / WHEEL.ease)
    let t = view.t + (scrubTo - view.t) * k
    if (Math.abs(scrubTo - t) < 0.002) t = scrubTo
    view = { ...view, t }
    return t !== scrubTo
  }

  // The frame loop: one frame when something changes, frames on while anything moves.
  let slowFrames: number[] = []
  let lastFrameAt = 0
  let lastStep = 0
  let settled: GlobeView | null = null
  let controls: Controls | null = null
  const draw = (now: number) => {
    raf = 0
    // Nothing yet, not even the clock of what moves, until the world's picture is in.
    if (disposed || waiting) return
    const dt = lastStep ? Math.min(64, now - lastStep) : 16
    lastStep = now
    let moving = motion.step(now)
    const turning = controls?.step(now) ?? false
    if (sheetSince) {
      const k = (now - sheetSince) / SHEET_IN_MS
      look.sheet = ease.outCubic(Math.min(1, Math.max(0, k)))
      if (k >= 1) sheetSince = 0
      else moving = true
    }
    // Followed, a pull curls the sheet only once the flat map is veiled: until then it lies flat, the flat map's twin.
    if (phase === 'pulling' && veiled) moving = scrub(dt) || moving
    followFlat()
    if (phase === 'pulling') deep = smoothstep(0.1, 0.6, view.t)
    if (phase === 'closed' || hidden || document.visibilityState !== 'visible') {
      // Out of sight, what moves still moves, so a way back started under a phone's sheet still ends.
      if ((moving || turning) && phase !== 'closed' && document.visibilityState === 'visible') invalidate()
      else lastStep = 0
      return
    }
    // A battle facing the reader swells its ring, at no more than thirty frames a second; nothing swells unseen.
    const swelling = phase === 'open' && battles.length > 0 && !lessMotion() && battles.some((spot) => curlPoint(spot, view).facing > 0.2)
    look.pulse = swelling ? Math.max(0.001, (now % PULSE_MS) / PULSE_MS) : 0
    gl.draw(view, look)
    const lifted = selection?.kind === 'nation' ? selection.slug : null
    const namesNext = names.place(view, marksForNames(), namesShown, showWorld, lifted, now)
    placeCompass()
    placeBackdrop()
    fadeTo(deepElement, deep)
    fadeTo(canvas, canvasShown)
    frames++
    root.dataset.frames = String(frames)
    root.dataset.curl = view.t.toFixed(2)
    if (swelling && !pulseTimer)
      pulseTimer = window.setTimeout(() => {
        pulseTimer = 0
        invalidate()
      }, PULSE_FRAME_MS)
    // The twin is on the page: the flat map can be veiled beneath it, next frame.
    if (veilWanted && !veiled && !veilFrame)
      veilFrame = requestAnimationFrame(() => {
        veilFrame = 0
        if (!veilWanted || disposed) return
        veiled = true
        props().flat.current?.veil(true)
        invalidate()
      })
    if (moving || turning) {
      // A device that can't keep up while the globe moves draws it with fewer pixels.
      if (lastFrameAt) slowFrames.push(now - lastFrameAt)
      lastFrameAt = now
      if (slowFrames.length >= 20) {
        const average = slowFrames.reduce((sum, ms) => sum + ms, 0) / slowFrames.length
        slowFrames = []
        if (average > SLOW_FRAME_MS && gl.coarsen()) gl.resize(size.width, size.height)
      }
      invalidate()
    } else {
      lastFrameAt = 0
      lastStep = 0
      slowFrames = []
      settle()
      // Names placed afresh though the globe is still (settled by rank, or come back) may now lie under the pointer, or the
      // middle the keys aim at, or no longer: where the name there isn't the one last asked about, what's there is asked
      // again, so the chip and the lift say what a click or Enter would open.
      const point = hoverAt ?? (aimed ? ([view.cx, view.cy] as const) : null)
      if (phase === 'open' && point && !hoverFrame && names.at(point[0], point[1]) !== hoverNamed) hoverFrame = requestAnimationFrame(hover)
      // The names, with more to do, are drawn on though the globe is still: at once while one fades or glides, and a frame
      // later on for one kept waiting, or to settle them by rank once the globe has come to rest.
      if (namesNext <= 0) invalidate()
      else if (Number.isFinite(namesNext)) wakeIn(namesNext)
    }
  }
  function invalidate() {
    if (!raf && !disposed) raf = requestAnimationFrame(draw)
  }
  let wakeTimer = 0
  const wakeIn = (ms: number) => {
    window.clearTimeout(wakeTimer)
    wakeTimer = window.setTimeout(() => {
      wakeTimer = 0
      invalidate()
    }, ms + 1)
  }

  /** Come to rest: the shell is told where, as the flat map would say it. */
  const settle = () => {
    if (phase !== 'open') return
    if (settled && settled.lon === view.lon && settled.lat === view.lat && settled.zoom === view.zoom) return
    settled = { ...view }
    measureFloating()
    props().onSettle({ centre: toBlock({ lon: view.lon, lat: view.lat }), zoom: Math.max(-8, view.zoom) })
    // Turned under a pointer at rest (by the keys, home, to a page from the search), or by the keys alone,
    // what lies under the pointer, or at the middle, is asked again now the globe is still.
    if ((hoverAt || aimed) && !hoverFrame) hoverFrame = requestAnimationFrame(hover)
  }

  const set = (next: Partial<GlobeView>, how: 'eased' | 'now' = 'now') => {
    handled = true
    if (how === 'now' || lessMotion()) {
      // The hand overrules any turn under way.
      motion.stop('ease')
      motion.stop('turn')
      view = { ...view, ...next, lon: wrapAngle(next.lon ?? view.lon) }
      return invalidate()
    }
    const from = { ...view }
    const to = { ...view, ...next }
    motion.run('ease', {
      ms: EASED_MS,
      ease: ease.outCubic,
      step: (k) => {
        view = {
          ...view,
          lon: wrapAngle(from.lon + wrapAngle(to.lon - from.lon) * k),
          lat: mix(from.lat, to.lat, k),
          zoom: mix(from.zoom, to.zoom, k),
        }
      },
    })
    invalidate()
  }

  // The world's picture: decoded off the main thread as the globe's code came (./sheet.ts), and kept for a context
  // that's lost and given back. Until it has come, a moment at most, the first frame waits for it; should it be
  // longer, or not come, the flat map's own picture stands in, else one fetched for the globe; while the flat map's
  // is a canvas still filling with tiles, it's taken up again every second until it's whole.
  // A picture that comes once the globe is drawn comes up over the plain sea rather than all at once.
  const decoding = warmSheet(true)
  let waiting = false
  let waited = false
  let waitTimer = 0
  let pictureTimer = 0
  let pictureRetry = 0
  let pictureFrom = 0
  let pictured = false
  let fetched: HTMLImageElement | null = null
  let sheetSince = 0
  const showPicture = (picture: Picture, gently = false) => {
    gl.setPicture(picture)
    if (gently && !pictured && !lessMotion() && phase !== 'closed') {
      look.sheet = 0
      sheetSince = performance.now()
    } else if (!sheetSince) look.sheet = 1
    pictured = true
  }
  const stopWaiting = () => {
    window.clearTimeout(waitTimer)
    waitTimer = 0
    waiting = false
    waited = true
  }
  decoding?.coming.then((bitmap) => {
    if (disposed) return
    const wasWaiting = waiting
    stopWaiting()
    if (bitmap) {
      // Awaited by the first frame, it's there from the first; else, over a globe drawn without it, it comes up.
      window.clearInterval(pictureTimer)
      showPicture(bitmap, !wasWaiting)
    } else if (wasWaiting) takePicture()
    invalidate()
  })
  const takePicture = () => {
    window.clearInterval(pictureTimer)
    if (decoding?.bitmap) return showPicture(decoding.bitmap)
    if (decoding && !pictured && !waited) {
      waiting = true
      if (!waitTimer)
        waitTimer = window.setTimeout(() => {
          stopWaiting()
          takePicture()
          invalidate()
        }, SHEET_WAIT_MS)
      return
    }
    const own = props().flat.current?.picture() ?? null
    if (own instanceof HTMLImageElement) return showPicture(own)
    if (fetched) return showPicture(fetched)
    if (own instanceof HTMLCanvasElement) {
      showPicture(own)
      pictureFrom = performance.now()
      pictureTimer = window.setInterval(() => {
        if (phase === 'closed') return
        const now = props().flat.current?.picture() ?? null
        if (now instanceof HTMLImageElement) {
          window.clearInterval(pictureTimer)
          showPicture(now)
        } else gl.refreshPicture()
        if (performance.now() - pictureFrom > PICTURE_REFRESH_FOR_MS) window.clearInterval(pictureTimer)
        invalidate()
      }, PICTURE_REFRESH_MS)
      return
    }
    const image = new Image()
    image.decoding = 'async'
    // Ahead of the flat map's tiles, which may be queued for the same connection.
    image.fetchPriority = 'high'
    image.src = SHEET_URL
    image
      .decode()
      .then(() => {
        if (disposed) return
        fetched = image
        showPicture(image, true)
        invalidate()
      })
      .catch(() => {
        // The sea and the borders stand meanwhile; one more try a while later, should the globe still be open.
        if (pictureRetry || disposed) return
        pictureRetry = window.setTimeout(() => {
          if (!disposed && phase !== 'closed') takePicture()
        }, PICTURE_RETRY_MS)
      })
  }

  // The nation numbers: Azania's at once, the world's in idle slices once it has come, Azania's again over it.
  let numbers: Numbers = { ids: new Uint8Array(gl.numbers.width * gl.numbers.height), width: gl.numbers.width, height: gl.numbers.height, nations: [] }
  let numbering = nationNumbering(null)
  let towns: MapTown[] = []
  let world: Abroad | null = null
  let painting: (() => void) | null = null
  let builds = 0
  const azaniaBounds = (list: MapTown[]) =>
    list.reduce<{ minX: number; maxX: number; minZ: number; maxZ: number } | null>(
      (all, town) =>
        town.bounds
          ? all
            ? { minX: Math.min(all.minX, town.bounds.minX), maxX: Math.max(all.maxX, town.bounds.maxX), minZ: Math.min(all.minZ, town.bounds.minZ), maxZ: Math.max(all.maxZ, town.bounds.maxZ) }
            : { ...town.bounds }
          : all,
      null,
    )
  // Azania's glow comes from its own claims alone, painted the same whatever the world around them: worked out once for its towns.
  let masked: MapTown[] | null = null
  const swapIn = (next: Numbers, ours: MapTown[]) => {
    numbers = next
    gl.setNumbers(next)
    if (ours !== masked) {
      masked = ours
      gl.setMask(azaniaMask(next, 1024, 512, azaniaBounds(ours)), 1024, 512)
    }
    builds++
    root.dataset.raster = String(builds)
    invalidate()
  }
  const paint = () => {
    painting?.()
    painting = null
    const { width, height } = gl.numbers
    const ours = towns
    const reading = world
    const order = nationNumbering(reading)
    // Nothing drawn yet, or no world to draw: Azania at once, alone.
    if (!reading || !builds) {
      const alone = new Uint8Array(width * height)
      paintAzania(alone, width, height, ours)
      if (!reading) numbering = order
      swapIn({ ids: alone, width, height, nations: numbering.nations }, ours)
      if (!reading) return
    }
    const ids = new Uint8Array(width * height)
    const steps = paintWorld(ids, width, height, reading, order.numberOf)
    // The world painted, Azania over it and the swap, in a slice of their own.
    const finish = () => {
      painting = null
      paintAzania(ids, width, height, ours)
      numbering = order
      // The open nation, by its number in this reading.
      look.selected = selectedNumber()
      swapIn({ ids, width, height, nations: order.nations }, ours)
      applyInks()
    }
    const slice = (left: () => number) => {
      const start = performance.now()
      while (performance.now() - start < Math.min(SLICE_MS, Math.max(1, left()))) {
        if (steps.next().done) {
          painting = whenIdle(finish)
          return
        }
      }
      painting = whenIdle(slice)
    }
    painting = whenIdle(slice)
  }

  // The inks: the palette's bytes and the names' colours.
  let inks: { world: Abroad | null; showWorld: boolean; relations: MapsActions['data']['relations'] | null } = {
    world: null,
    showWorld: true,
    relations: null,
  }
  const applyInks = () => {
    // The palette follows the numbering that's drawn, which may be a reading behind while the next is painted.
    gl.setPalette(paletteBytes({ nations: numbering.nations, showWorld: inks.showWorld, relations: inks.relations }))
    const bySlug = new Map((inks.world?.nations ?? []).map((nation) => [nation.slug, nation]))
    names.colour((slug) => {
      const nation = bySlug.get(slug)
      return nameStyle(nation?.name ?? '', nation?.colour ?? null, inks.relations)
    })
    showWorld = inks.showWorld
    invalidate()
  }

  // The map's own controls and notes floating over the globe (its buttons, top right, and the notes of Azania's sieges and
  // its diplomacy, top left), as boxes on it: no name goes under them. Read off the page as the globe comes to rest and as
  // the page changes, never while it moves.
  let floating: Rect[] = []
  // The map's box, which the columns hang in; the notes' column is there only while it has a note to hold.
  const mapBox = document.querySelector('[data-globe-notes]')?.parentElement?.parentElement ?? null
  const floatingColumns = () => [
    (mapBox ?? document).querySelector('[data-globe-notes]')?.parentElement ?? null,
    (mapBox ?? document).querySelector('.az-siege-alert, .az-diplomacy-key')?.parentElement ?? null,
  ]
  const measureFloating = () => {
    const box = root.getBoundingClientRect()
    const next = floatingColumns()
      .flatMap((column) => (column ? [...column.children] : []))
      .map((each) => each.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height }))
    if (JSON.stringify(next) === JSON.stringify(floating)) return
    floating = next
    invalidate()
  }
  // The notes come and go while the globe is still too (the diplomacy layer switched on, a siege beginning), and their
  // column with them: the map's box is watched for the columns, and the columns for their notes, and the names are given
  // the boxes afresh, in a frame of their own, as they change.
  let watchedColumns: (Element | null)[] = []
  const notesWatch = new MutationObserver(() => {
    if (phase === 'open') measureFloating()
  })
  const watchFloating = () => {
    const columns = floatingColumns()
    if (columns.every((column, i) => column === watchedColumns[i])) return
    watchedColumns = columns
    notesWatch.disconnect()
    for (const column of columns) if (column) notesWatch.observe(column, { childList: true, subtree: true, characterData: true })
    if (phase === 'open') measureFloating()
  }
  const boxWatch = new MutationObserver(watchFloating)
  if (mapBox) boxWatch.observe(mapBox, { childList: true })
  watchFloating()

  // The marks and what's open.
  let hits: MarkHit[] = []
  let battles: LonLat[] = []
  let playersHere: PlayerHit[] = []
  let sieges: ReturnType<typeof siegesOnMap> = []
  let selection: MapSelection | null = null
  let players = false
  let unsubscribePlayers: (() => void) | null = null
  // What the names keep off, as boxes on the page: the sieges' marks and the map's controls without fail, the server's
  // places and Azania's towns where they can; and the page the reader sees the globe in, clear of its bars and sheet,
  // within which each lies whole.
  const marksForNames = (): NameMarks => {
    const page = { x: 4, y: insets.top + 4, width: size.width - 8, height: size.height - insets.top - insets.bottom - 8 }
    const marks: NameMarks = { sieges: [], places: [], towns: [], controls: floating, page }
    for (const hit of hits) {
      const spot = curlPoint(hit.spot, view)
      if (spot.facing <= 0.2) continue
      if (hit.pick.kind === 'siege') marks.sieges.push({ x: spot.x - 9, y: spot.y - 9, width: 18, height: 18 })
      else {
        const reach = hit.radius + 1
        const box = { x: spot.x - reach, y: spot.y - reach, width: 2 * reach, height: 2 * reach }
        if (hit.pick.kind === 'town') marks.towns.push(box)
        else marks.places.push(box)
      }
    }
    return marks
  }
  const selectedNumber = () => {
    if (selection?.kind !== 'nation') return -1
    const slug = selection.slug
    return numbering.nations.findIndex((nation) => nation?.slug === slug)
  }
  const showPlayers = () => {
    const live = props().liveStore.get()
    gl.setMarks('players', players ? buildPlayers(live.players, towns) : NO_MARKS)
    playersHere = players ? playerHits(live.players) : []
    invalidate()
  }

  // What's under a point: a nation's name, a mark, the ground and who holds it.
  const azaniaFace = (): LonLat => {
    const home = homeNationOf(towns)
    const capital = maps().war.capitals.find((each) => sameNation(each.nation, home))
    if (capital) return toLonLat(capital.home)
    const heart = heartland(towns)
    return heart ? toLonLat(boundsCentre(heart)) : { lon: 0, lat: 0 }
  }
  const nearestMark = (x: number, y: number, touch: boolean): MarkHit | null => nearest(hits, x, y, touch ? MARK_REACH.touch : MARK_REACH.mouse)
  const nearest = <T extends { spot: LonLat; radius: number }>(among: T[], x: number, y: number, reach: number): T | null => {
    let best: T | null = null
    let bestDistance = Infinity
    for (const hit of among) {
      const spot = curlPoint(hit.spot, view)
      if (spot.facing < 0.2) continue
      const distance = Math.hypot(spot.x - x, spot.y - y)
      if (distance <= Math.max(reach, hit.radius) && distance < bestDistance) {
        best = hit
        bestDistance = distance
      }
    }
    return best
  }
  /** The town abroad of no nation, or one of the server's places, holding a block. */
  const townAt = (block: Point, kind: 'stateless' | 'server' | 'any'): AbroadTown | null => {
    for (const town of world?.towns ?? []) {
      const b = town.bounds
      if (!b || block[0] < b.minX || block[0] > b.maxX || block[1] < b.minZ || block[1] > b.maxZ) continue
      if (kind === 'stateless' && town.nation) continue
      if (inOutlines(block, town.claims)) return town
    }
    return null
  }
  const shownNumber = (number: number) => (number >= NUMBER.stateless && !showWorld ? NUMBER.none : number)
  const heartTarget = (): LookTarget => {
    const heart = heartland(towns)
    return heart ? { bounds: heart } : { centre: toBlock(azaniaFace()), zoom: -3 }
  }
  const pick = (x: number, y: number, touch: boolean): GlobePick | null => {
    const named = names.at(x, y)
    if (named === 'home') return { selection: null, target: heartTarget() }
    if (named) {
      const nation = world?.nationBySlug.get(named)
      const fit = nation ? nationFit(nation) : null
      if (nation && fit) return { selection: { kind: 'nation', slug: nation.slug }, target: { bounds: fit } }
    }
    const block = pickAt(x, y, view)
    const number = block ? shownNumber(numberAt(numbers, block)) : NUMBER.none
    const mark = nearestMark(x, y, touch && number === NUMBER.none)
    const what = mark?.pick
    if (mark && what?.kind === 'siege') {
      const townId = what.townId
      const siege = sieges.find((each) => each.siege.townId === townId)
      if (siege) return { siege: townId, target: { centre: siege.siege.at, zoom: -1.5, minZoom: true } }
    } else if (what?.kind === 'abroad') {
      const town = world?.townBySlug.get(what.slug)
      const target = town ? townTarget(town) : null
      if (town && target) return { selection: { kind: 'abroad', slug: town.slug }, target }
    } else if (mark && what?.kind === 'town') {
      const slug = what.slug
      const town = towns.find((each) => each.slug === slug)
      const bounds = town ? townFit(town) : null
      if (town) return { selection: { kind: 'town', slug }, target: bounds ? { bounds } : { centre: town.home ?? toBlock(mark.spot), zoom: 0 } }
    }
    if (!block) return null
    if (number === NUMBER.azania) return { selection: null, target: heartTarget() }
    const nation = number >= NUMBER.first && number < NUMBER.past ? numbering.nations[number] : null
    const fit = nation ? nationFit(nation) : null
    if (nation && fit) return { selection: { kind: 'nation', slug: nation.slug }, target: { bounds: fit } }
    if (number !== NUMBER.none) {
      const town = townAt(block, number === NUMBER.stateless ? 'stateless' : 'any')
      // An outpost of the town, claims detached from it or a site's piece apart from its mark: what was clicked is looked at.
      const part = town ? partAt(town.parts, town.claims, block) : null
      const focus = town && part ? partFocus(town.parts, town.parts.indexOf(part)) : undefined
      const target = focus ? { bounds: focus } : town ? townTarget(town) : null
      if (town && target) return { selection: { kind: 'abroad', slug: town.slug }, target, focus }
    }
    return { target: { centre: block, zoom: -4 } }
  }

  // The pointer passing over: the nation beneath it lifted, its name in a chip by the pointer. Turned by
  // the keys with no pointer over it (`aimed`), the same at its middle, where Enter opens the flat map, so a
  // reader at the keyboard sees what Enter would open; the pointer coming over the globe again takes over.
  let hoverAt: [number, number] | null = null
  let hoverFrame = 0
  let aimed = false
  // The name that lay under the pointer, or the middle, when it was last asked: its address, 'home', or null.
  let hoverNamed: string | null = null
  /** Nothing named or lifted for now; the pointer may still be over the globe, to be asked again. */
  const unlift = () => {
    chip.style.opacity = '0'
    delete root.dataset.over
    if (look.hover !== -1) {
      look.hover = -1
      invalidate()
    }
  }
  const hover = () => {
    hoverFrame = 0
    const at = hoverAt ?? (aimed ? ([view.cx, view.cy] as const) : null)
    if (phase !== 'open' || !at) {
      unlift()
      if (!at) props().onPointer(null)
      return
    }
    const [x, y] = at
    const block = pickAt(x, y, view)
    props().onPointer(block)
    const mark = nearestMark(x, y, false)
    const named = names.at(x, y)
    hoverNamed = named
    const number = block ? shownNumber(numberAt(numbers, block)) : NUMBER.none
    const nation = number >= NUMBER.first && number < NUMBER.past ? numbering.nations[number] : null
    const lifted = named === 'home' ? NUMBER.azania : named ? numbering.nations.findIndex((each) => each?.slug === named) : nation || number === NUMBER.azania ? number : -1
    const words =
      lifted === NUMBER.azania
        ? spoken(homeNationOf(towns) ?? 'Azania')
        : lifted > 0
          ? spoken(numbering.nations[lifted]?.name ?? '')
          : ''
    root.toggleAttribute('data-over', Boolean(mark || named || lifted > 0 || (block && number !== NUMBER.none)))
    // A mark says what it is, a player who; else the nation underneath its name.
    const about = mark ?? nearest(playersHere, x, y, PLAYER_REACH)
    if (about || words) {
      const [nameLine, subLine] = chip.children as unknown as [HTMLElement, HTMLElement]
      nameLine.textContent = about ? about.name : words
      subLine.textContent = about ? about.line : ''
      subLine.hidden = !about
      const left = Math.min(x + 14, size.width - chip.offsetWidth - 8)
      const top = Math.min(y + 16, size.height - chip.offsetHeight - 8)
      chip.style.transform = `translate(${Math.max(8, left).toFixed(0)}px, ${Math.max(8, top).toFixed(0)}px)`
      chip.style.opacity = '1'
    } else chip.style.opacity = '0'
    if (look.hover !== lifted) {
      look.hover = lifted
      invalidate()
    }
  }

  // Said after the keyboard turns the globe: what faces the reader now.
  let sayTimer = 0
  const sayFacing = () => {
    window.clearTimeout(sayTimer)
    sayTimer = window.setTimeout(() => {
      const block = toBlock({ lon: view.lon, lat: view.lat })
      const number = shownNumber(numberAt(numbers, block))
      const nation = number >= NUMBER.first && number < NUMBER.past ? numbering.nations[number] : null
      hooks.say(
        number === NUMBER.azania
          ? `Facing ${spoken(homeNationOf(towns) ?? 'Azania')}`
          : nation
            ? `Facing ${spoken(nation.name)}`
            : `Facing unclaimed ground at ${Math.round(block[0])}, ${Math.round(block[1])}`,
      )
    }, SAY_AFTER_MS)
  }
  const onKeyTurn = (event: KeyboardEvent) => {
    if (event.target !== root || phase !== 'open' || event.metaKey || event.ctrlKey || event.altKey) return
    const turns = /^Arrow|^Home$/.test(event.key)
    if (turns) sayFacing()
    // Turned or zoomed by the keys: what was named goes as the globe moves, and is asked again once it's still,
    // under the pointer resting over it, or else at its middle.
    if (turns || /^[-+=_]$/.test(event.key)) {
      if (!hoverAt) aimed = true
      unlift()
    }
  }
  // Away from the globe, the keyboard's aim goes with it.
  const onBlur = () => {
    if (!aimed) return
    aimed = false
    hover()
  }
  root.addEventListener('keydown', onKeyTurn)
  root.addEventListener('blur', onBlur)

  // Turning towards a spot, at the zoom it has or the one asked for; with nothing to turn, still coming in to that zoom.
  const turnTo = (to: LonLat, zoom: number, done?: () => void, ms?: number) => {
    const from = { lon: view.lon, lat: view.lat }
    const z0 = view.zoom
    const angle = between(from, to)
    if (lessMotion() || (angle < 1e-4 && Math.abs(zoom - z0) < 1e-3)) {
      view = { ...view, lon: to.lon, lat: to.lat, zoom }
      invalidate()
      motion.stop('turn')
      return done?.()
    }
    motion.run('turn', {
      ms: ms ?? Math.min(TURN_MS.most, Math.max(TURN_MS.least, TURN_MS.least + (350 * angle) / Math.PI)),
      ease: ease.inOutCubic,
      step: (k) => {
        const spot = slerp(from, to, k)
        view = { ...view, lon: spot.lon, lat: spot.lat, zoom: mix(z0, zoom, k) }
      },
      done,
    })
    invalidate()
  }

  // Open: told where it rests, and turned to whatever was asked for while it opened.
  let heldFace: LookTarget | null = null
  const opened = () => {
    props().onCover(true)
    setPhase('open')
    // However it came, the flat map stands aside under its veil while the globe covers it, so the globe can unroll over plain ground.
    if (canCurl()) setVeil(true)
    settle()
    const held = heldFace
    const zoom = heldZoom
    heldFace = null
    heldZoom = 0
    if (held) face_(held)
    else if (zoom) zoomBy(zoom)
  }
  /** On the way in, the address and the readout follow the globe already: where it will rest. */
  const settleAhead = (face: LonLat, zoom: number) => {
    settled = null
    props().onSettle({ centre: toBlock(face), zoom: Math.max(-8, zoom) })
  }
  /** Focus follows the reader in only when it was on the flat map, which is about to step aside. */
  const takeFocus = () => {
    if (document.activeElement?.closest('.leaflet-container')) root.focus({ preventScroll: true })
  }
  /** Everything the globe shows, shown: what a fade brings in at once, and the curl over its course. */
  const showAll = () => {
    look.overlay = 1
    look.glow = 1
    look.marks = 1
    namesShown = 1
    deep = 1
    canvasShown = 1
  }

  // Opening, by fading in: from a little closer, settling to its zoom, facing the spot asked for, or from the hold
  // a spot nearer a pole. `back` is the flat map's zoom, to go back to, when opened by hand.
  const fadeIn = (spot: LonLat, zoom: number, back: number | null) => {
    motion.stopAll()
    controls?.halt()
    window.clearTimeout(pullLost)
    follow = null
    setVeil(false)
    cameFrom = back
    handled = false
    owedZoom = 0
    heldZoom = 0
    const face = faceable(spot)
    const plain = lessMotion()
    view = { ...view, lon: face.lon, lat: face.lat, t: 1, tilt: 1, cx: frame.cx, cy: frame.cy, zoom: plain ? zoom : zoomForRadius(FADE_GROW * radiusAt(zoom)) }
    showAll()
    settleAhead(face, zoom)
    const from = Number(root.style.opacity || '0')
    root.style.opacity = String(from)
    setPhase('opening')
    takeFocus()
    takePicture()
    motion.run('fade', {
      ms: plain ? FADE_PLAIN_MS : FADE_IN_MS,
      ease: ease.outCubic,
      step: (k) => {
        root.style.opacity = String(mix(from, 1, k))
        if (!plain) view = { ...view, zoom: zoomForRadius(mix(FADE_GROW, 1, k) * radiusAt(zoom)) }
      },
      done: () => {
        root.style.opacity = '1'
        opened()
      },
    })
    invalidate()
  }

  /** Whether the flat map may curl up into the globe and back: not for a reader who asks for less motion, nor with the curl switched off. */
  const canCurl = () => GLOBE.curl && !lessMotion() && Boolean(props().flat.current?.view())
  /** How an entry opens: a pull or the zoom out at the floor curls the map up; so does the button, unless from too close in. */
  const curls = (entry: GlobeEntry) =>
    entry !== 'fade' && canCurl() && (entry !== 'curl' || (props().flat.current?.view()?.zoom ?? 0) <= CURL_FROM_ZOOM)

  /**
   * The flat map's twin laid over it, flat, faced where the globe will
   * rest (twinAt): the start of every curl. False when there's no flat map
   * to copy.
   */
  const layTwin = (): boolean => {
    follow = { at: twinAt(), hold: HOLD_FLAT }
    if (!followFlat()) {
      follow = null
      return false
    }
    view = { ...view, t: 0, tilt: 0 }
    look.overlay = 1
    look.glow = 1
    look.marks = 1
    namesShown = 0
    deep = 0
    canvasShown = 1
    // Shown at once, before the first frame: no deep behind the twin, and no frame left from before on the canvas.
    fadeTo(deepElement, 0)
    fadeTo(canvas, 0)
    root.style.opacity = '1'
    takePicture()
    return true
  }

  // Pulled: the twin follows the pull, curling as far as the pull asks, and the flat map as it moves.
  const watchPull = () => {
    window.clearTimeout(pullLost)
    pullLost = window.setTimeout(() => {
      if (phase === 'pulling') springBack()
    }, PULL_LOST_MS)
  }
  const beginPull = (): boolean => {
    if (!GLOBE.curl || lessMotion() || hidden) return false
    motion.stopAll()
    controls?.halt()
    if (!layTwin()) return false
    scrubTo = scrubOf(props().pull.get()?.levels ?? 0)
    setPhase('pulling')
    setVeil(true)
    watchPull()
    invalidate()
    return true
  }
  /** A pull let go short of the globe: the sheet springs back flat over the flat map, as it now stands, and goes. */
  const springBack = () => {
    window.clearTimeout(pullLost)
    follow = null
    const from = { ...view }
    const fromX = look.flatX
    motion.run('curl', {
      ms: lessMotion() ? 0 : PULL.springMs,
      ease: ease.outCubic,
      step: (k) => {
        // Towards the flat map wherever it's going: a pinch past the floor springs back as the sheet does.
        const to = planeOf(twinAt(), HOLD_FLAT) ?? { ...from, flatX: fromX }
        view = {
          lon: wrapAngle(from.lon + wrapAngle(to.lon - from.lon) * k),
          lat: mix(from.lat, to.lat, k),
          zoom: mix(from.zoom, to.zoom, k),
          cx: mix(from.cx, to.cx, k),
          cy: mix(from.cy, to.cy, k),
          t: mix(from.t, 0, k),
        }
        look.flatX = mix(fromX, to.flatX, k)
      },
      done: () => {
        follow = { at: twinAt(), hold: HOLD_FLAT }
        lay()
      },
    })
    invalidate()
  }
  /** The twin lies flat over the flat map: the veil lifts, and the twin fades away over the original. */
  const lay = () => {
    setVeil(false)
    motion.run('canvas', {
      ms: lessMotion() ? 0 : CANVAS_OUT_MS,
      step: (k) => {
        canvasShown = 1 - k
      },
      done: close,
    })
    invalidate()
  }
  /** Tells the reader to keep pulling, if the pull that fell short was just now. */
  const hintIfShort = (pull: GlobePull) => {
    if (pull.levels > 0.05 && performance.now() - pull.at < HINT_WITHIN_MS) props().onHint()
  }
  const onPull = () => {
    const pull = props().pull.get()
    if (!pull || disposed) return
    if (pull.phase === 'move') {
      if (phase === 'closed' && pull.levels > 0) beginPull()
      if (phase !== 'pulling') return
      if (motion.running('curl') || motion.running('canvas')) {
        // Pulled again as it sprang back: it follows the pull once more from where it stands.
        motion.stop('curl')
        motion.stop('canvas')
        canvasShown = 1
        follow = { at: twinAt(), hold: HOLD_FLAT }
        setVeil(true)
      }
      scrubTo = scrubOf(pull.levels)
      watchPull()
      return invalidate()
    }
    // Let go: far enough, the shell has opened the globe by the time this runs (through enter);
    // short of that, the sheet springs back, and the reader is told to keep going.
    queueMicrotask(() => {
      if (disposed || (phase !== 'pulling' && phase !== 'closed')) return
      if (phase === 'pulling') springBack()
      hintIfShort(pull)
    })
  }
  const unsubscribePull = props().pull.subscribe(onPull)

  /**
   * The curl up into the globe, from the twin as it lies (a pull's, part
   * curled already; an uncurl's, turned back) or laid flat over the flat
   * map just now: the flat map steps aside under its veil, the sheet rolls
   * up into a ball facing what the flat map had where the globe rests, the
   * ball eases to its resting size and place, the deep comes up, the names
   * come in.
   */
  const curlIn = () => {
    window.clearTimeout(pullLost)
    controls?.halt()
    const onPage = phase === 'pulling' || phase === 'leaving'
    motion.stopAll()
    if (!onPage && !layTwin()) {
      const { face, zoom, from } = openingFace(false)
      return fadeIn(face, zoom, from)
    }
    // The twin is the flat map as it stands: its zoom is the one to go back to.
    cameFrom = view.zoom
    handled = false
    owedZoom = 0
    heldZoom = 0
    follow = null
    canvasShown = 1
    look.glow = 1
    root.style.opacity = '1'
    setVeil(true)
    setPhase('opening')
    settleAhead({ lon: view.lon, lat: view.lat }, frame.zoomRest)
    props().onCover(true)
    takeFocus()
    const from = { ...view }
    const fromDeep = deep
    const fromNames = namesShown
    motion.run('curl', {
      ms: CURL_MS * (1 - from.t),
      ease: from.t > 0 ? ease.outCubic : ease.inOutCubic,
      step: (k) => {
        view = { ...view, t: mix(from.t, 1, k) }
      },
    })
    // Upright while it rolls, so its open poles and the gap at its back stay out of sight; tipped to the facing latitude as it closes.
    const fromTilt = from.tilt ?? 1
    motion.run('tilt', {
      delay: CURL_MS * (1 - from.t) * CURL_TILT.after,
      ms: CURL_TILT.ms,
      ease: ease.inOutCubic,
      step: (k) => {
        view = { ...view, tilt: mix(fromTilt, 1, k) }
      },
    })
    motion.run('grow', {
      ...CURL_GROW,
      ease: ease.outCubic,
      step: (k) => {
        view = { ...view, zoom: mix(from.zoom, frame.zoomRest, k), cx: mix(from.cx, frame.cx, k), cy: mix(from.cy, frame.cy, k) }
      },
    })
    motion.run('deep', {
      ...CURL_DEEP,
      ease: ease.inOutCubic,
      step: (k) => {
        deep = mix(fromDeep, 1, k)
      },
    })
    motion.run('names', {
      ...CURL_NAMES,
      step: (k) => {
        namesShown = mix(fromNames, 1, k)
      },
      done: opened,
    })
    invalidate()
  }
  /**
   * Back into the flat map, which already stands beneath just so, `spot`
   * under the point `at`: the names go, the deep and the glow after them,
   * and the ball unrolls, each frame met by the flat map as it then stands,
   * so one that a gesture carries on zooming is met wherever it has got to.
   * Unrolled about a spot off the middle, the ball turns as it goes from
   * the face it had to that spot, which stays where it is drawn. It faces
   * no nearer a pole as it goes than it, or the spot, already does.
   */
  const uncurl = (at: [number, number], spot: LonLat) => {
    // A globe that faded in over a flat map not yet there to veil: veiled now, under the deep, still whole.
    if (!veiled) {
      veilWanted = true
      veiled = true
      props().flat.current?.veil(true)
    }
    const hold = Math.max(TILT.give, Math.abs(view.lat), Math.abs(spot.lat))
    follow = { at, hold, from: { lon: view.lon, lat: view.lat }, turned: 0 }
    followFlat()
    const from = view.t
    const fromNames = namesShown
    const fromDeep = deep
    const fromGlow = look.glow
    motion.run('names', {
      ms: UNCURL_NAMES_MS,
      step: (k) => {
        namesShown = mix(fromNames, 0, k)
      },
    })
    motion.run('deep', {
      ms: UNCURL_DEEP_MS,
      step: (k) => {
        deep = mix(fromDeep, 0, k)
        look.glow = mix(fromGlow, 0, k)
      },
    })
    motion.run('curl', {
      ms: Math.max(200, UNCURL_MS * from),
      ease: ease.inOutCubic,
      step: (k) => {
        view = { ...view, t: mix(from, 0, k) }
        if (follow) follow.turned = k
      },
      done: lay,
    })
    // Tipped upright as it starts to open, before the gap at its back can show over a pole.
    const fromTilt = view.tilt ?? 1
    motion.run('tilt', {
      ms: UNCURL_TILT_MS,
      ease: ease.outCubic,
      step: (k) => {
        view = { ...view, tilt: mix(fromTilt, 0, k) }
      },
    })
    invalidate()
  }

  /**
   * Where the globe opens: facing the flat map's own spot where the globe
   * rests (twinAt), as it stands, or on arrival the address's, at the zoom
   * it names within the globe's (or its own, which the address can only
   * come near); failing both, Azania; a spot nearer a pole than the hold,
   * from the hold. By hand it rests at its own zoom, and remembers the flat
   * map's (`from`).
   */
  const openingFace = (arrival: boolean): { face: LonLat; zoom: number; from: number | null } => {
    const initial: MapPosition | null = props().initial
    const flat = arrival ? null : props().flat.current?.view()
    const spot = flat ? faceOfFlat(flat, twinAt()).face : initial ? toLonLat(initial.centre) : azaniaFace()
    const asked = arrival && initial ? Math.min(frame.zoomHand - 0.25, Math.max(frame.zoomMin, initial.zoom)) : null
    const zoom = asked === null || Math.abs(asked - frame.zoomRest) <= REST_SNAP ? frame.zoomRest : asked
    return { face: faceable(spot), zoom, from: flat ? flat.zoom : null }
  }
  /**
   * Mounted: open as asked. Mounted by a pull not yet asked to open, only
   * follow it, if it still goes on. Asked to open by a pull that ended a
   * while before the globe's code came, let it go quietly: the reader has
   * moved on.
   */
  const open = (entry: GlobeEntry) => {
    const pull = entry === 'pull' ? props().pull.get() : null
    if (entry === 'pull' && !props().wanted) {
      if (pull?.phase === 'move' && pull.levels > 0 && beginPull()) return
      if (pull?.phase === 'end') hintIfShort(pull)
      return props().onClosed()
    }
    if (pull?.phase === 'end' && performance.now() - pull.at > PULL_STALE_MS) return props().onLeave({})
    if (curls(entry)) return curlIn()
    const { face, zoom, from } = openingFace(props().arrival)
    fadeIn(face, zoom, from)
  }
  const enter = (entry: GlobeEntry) => {
    if (phase === 'open' || phase === 'opening') return
    if (phase === 'pulling') return curlIn()
    if (phase === 'leaving') {
      // Back again before it had gone: it curls back up from where it stood, or comes back as it went.
      if (view.t < 1 && canCurl()) return curlIn()
      motion.stopAll()
      return fadeIn({ lon: view.lon, lat: view.lat }, Math.min(frame.zoomHand - 0.25, view.zoom), cameFrom)
    }
    if (curls(entry)) return curlIn()
    const { face, zoom, from } = openingFace(false)
    fadeIn(face, zoom, from)
  }

  // Every way back: turn towards where the flat map is to look and come in to the zoom it lands at,
  // stand the flat map there beneath, the same spot under the same pixels, and unroll into it (or,
  // for less motion and for the editor, fade away over it).
  const leave = (request: LeaveRequest = {}) => {
    if (phase === 'closed' || phase === 'leaving') return
    if (phase === 'pulling') return springBack()
    // Still fading in over the flat map, it fades back out rather than unrolling over it.
    const fadingIn = motion.running('fade')
    controls?.halt()
    motion.stopAll()
    hoverAt = null
    aimed = false
    heldZoom = 0
    hover()
    const opening = phase === 'opening'
    setPhase('leaving')
    let face: LonLat = { lon: view.lon, lat: view.lat }
    // Back where it was, untouched, to the flat map's own zoom (as near as the globe comes), else at the globe's.
    const back = handled || cameFrom === null ? view.zoom : cameFrom
    let landing = Math.min(frame.zoomHand, Math.max(FLAT_MIN_ZOOM, back))
    let about: [number, number] | null = null
    if (request.fade || opening) {
      // As it is.
    } else if (request.at && request.zoom != null) {
      const [x, y] = request.at
      landing = request.zoom
      const next = zoomAround(view, x, y, landing)
      face = { lon: next.lon, lat: next.lat }
      about = [x, y]
    } else if (request.to) {
      face = toLonLat(centreOf(request.to))
      landing = frame.zoomHand
    }
    const handOver = () => {
      // The flat map stood beneath the globe as it now faces; zoomed in about a point, with the spot under it
      // kept under it, as a map zooms about the pointer, rather than the spot in the middle.
      face = { lon: view.lon, lat: view.lat }
      const spot = (about && pickLonLat(about[0], about[1], view)) ?? face
      const at: [number, number] = about && spot !== face ? about : [view.cx, view.cy]
      props().flat.current?.place({ centre: toBlock(spot), zoom: landing }, at)
      props().onCover(false)
      if (!request.fade && !fadingIn && canCurl()) return uncurl(at, spot)
      setVeil(false)
      follow = null
      canvasShown = 1
      const from = Number(root.style.opacity || '1')
      motion.run('fade', {
        ms: lessMotion() ? FADE_PLAIN_MS : FADE_OUT_MS,
        step: (k) => {
          root.style.opacity = String(mix(from, 0, k))
        },
        done: close,
      })
      invalidate()
    }
    if (request.fade || opening) return handOver()
    if (about && !lessMotion()) {
      // Zoomed in past its closest: the rest of the way about the pointer, quickly, then over.
      const start = { ...view }
      const [x, y] = about
      motion.run('turn', {
        ms: 150,
        ease: ease.outCubic,
        step: (k) => {
          view = zoomAround(start, x, y, mix(start.zoom, landing, k))
        },
        done: handOver,
      })
      return invalidate()
    }
    turnTo(face, landing, handOver)
  }
  const close = () => {
    root.style.opacity = '0'
    follow = null
    setVeil(false)
    window.clearTimeout(pullLost)
    setPhase('closed')
    window.clearInterval(pictureTimer)
    hoverAt = null
    aimed = false
    chip.style.opacity = '0'
    // Focus that was on the globe goes back to the flat map, and so do the zoom buttons pressed on the way.
    if (root.contains(document.activeElement)) props().flat.current?.focus()
    if (owedZoom) props().flat.current?.zoomBy(owedZoom)
    owedZoom = 0
    props().onPointer(null)
    props().onClosed()
  }

  // Turning to something and staying: a page opened from the search.
  function face_(target: LookTarget) {
    if (phase === 'opening') {
      heldFace = target
      return
    }
    if (phase !== 'open') return
    controls?.halt()
    handled = true
    turnTo(faceable(toLonLat(centreOf(target))), view.zoom, settle)
  }

  const zoomBy = (delta: number) => {
    // Handing back, the press is the flat map's, given to it once the globe has gone: in the meantime the flat map
    // is stood where the globe lands, and the twin unrolls into it as it then stands.
    if (phase === 'leaving') {
      owedZoom += delta
      return
    }
    // On its way up, a step out is the globe's once it's open; a step in turns it back to the flat map, which
    // takes the step once the globe has gone, as Escape would turn it back.
    if (phase === 'opening') {
      if (delta < 0) heldZoom += delta
      else {
        owedZoom += delta
        props().onLeave({})
      }
      return
    }
    if (phase !== 'open') return
    const zoom = view.zoom + delta
    if (zoom >= frame.zoomHand - 0.05) return props().onLeave({ at: [view.cx, view.cy], zoom: frame.zoomHand })
    set({ zoom: Math.max(frame.zoomMin, zoom) }, 'eased')
  }

  controls = attachControls(root, {
    view: () => view,
    frame: () => frame,
    // Whatever the controls set is the reader's doing; the globe's own turns go their own way.
    set: (next, how) => {
      props().onGesture()
      set(next, how)
    },
    enabled: () => phase === 'open',
    tap: (x, y, touch) => {
      const picked = pick(x, y, touch)
      if (picked) props().onPick(picked)
    },
    hover: (x, y) => {
      // The pointer's, from here on: the keyboard's aim at the middle gives way to it.
      aimed = false
      hoverAt = x == null || y == null ? null : [x, y]
      if (!hoverFrame) hoverFrame = requestAnimationFrame(hover)
    },
    key: (action) => {
      if (action === 'home') {
        handled = true
        props().onGesture()
        return turnTo(faceable(azaniaFace()), view.zoom, settle)
      }
      const picked = pick(view.cx, view.cy, false)
      if (picked) props().onPick(picked)
    },
    pastHand: (x, y) => props().onLeave({ at: [x, y], zoom: frame.zoomHand }),
    invalidate,
    grabbing: (on) => root.toggleAttribute('data-grabbing', on),
  })

  // The page's own changes: the map's box, the tab coming back into view.
  // A lift on the way in or out: how far the globe has yet to go to keep up with where it now rests.
  let owed = { x: 0, y: 0 }
  const fit = (lift: boolean) => {
    const before = frame
    frame = restFrame(size.width, size.height, insets)
    const zoom = Math.min(frame.zoomHand - 0.05, Math.max(frame.zoomMin, view.zoom + frame.zoomRest - before.zoomRest))
    if (!lift || lessMotion() || phase === 'closed') {
      view = { ...view, cx: frame.cx, cy: frame.cy, zoom: phase === 'open' ? zoom : view.zoom }
      return invalidate()
    }
    if (phase !== 'open') {
      // On the way in or out the globe is moved by its own motions too: the lift only adds its own way to
      // theirs, from where it rested to where it now rests, its zoom left to them. A curl's growth already
      // heads for wherever it rests as it goes.
      if (motion.running('grow')) return invalidate()
      if (!motion.running('lift')) owed = { x: 0, y: 0 }
      owed = { x: owed.x + frame.cx - before.cx, y: owed.y + frame.cy - before.cy }
      const start = { ...owed }
      motion.run('lift', {
        ms: LIFT_MS,
        ease: ease.outCubic,
        step: (k) => {
          const still = { x: start.x * (1 - k), y: start.y * (1 - k) }
          view = { ...view, cx: view.cx + owed.x - still.x, cy: view.cy + owed.y - still.y }
          owed = still
        },
      })
      return invalidate()
    }
    const from = { ...view }
    motion.run('lift', {
      ms: LIFT_MS,
      ease: ease.outCubic,
      step: (k) => {
        view = { ...view, cx: mix(from.cx, frame.cx, k), cy: mix(from.cy, frame.cy, k), zoom: mix(from.zoom, zoom, k) }
      },
    })
    invalidate()
  }
  const resizer = new ResizeObserver(() => {
    const next = { width: root.clientWidth || 1, height: root.clientHeight || 1 }
    if (next.width === size.width && next.height === size.height) return
    size = next
    gl.resize(size.width, size.height)
    fit(false)
    if (phase === 'open') measureFloating()
  })
  resizer.observe(root)
  gl.resize(size.width, size.height)
  const onVisibility = () => {
    if (document.visibilityState !== 'visible') return controls?.halt()
    // Back in sight mid-way in or out, its context still lost: not waited for any longer, as when lost in sight.
    if (gl.lost() && phase !== 'open' && phase !== 'closed') return props().onFail('lost')
    invalidate()
  }
  document.addEventListener('visibilitychange', onVisibility)

  const api = {
    enter,
    leave,
    face: face_,
    zoomBy,
  }

  return {
    alive: true,
    api,
    open,
    setGround: (nextTowns, nextWorld) => {
      const worldChanged = nextWorld?.at !== world?.at || (nextWorld === null) !== (world === null)
      const townsChanged = nextTowns !== towns
      towns = nextTowns
      world = nextWorld
      if (!worldChanged && !townsChanged) return
      const home = homeNationOf(towns)
      const heart = heartland(towns)
      names.build(world, home && heart ? { name: home, heart: boundsCentre(heart), across: heart.maxX - heart.minX } : null)
      homeHeart = heart ? toLonLat(boundsCentre(heart)) : null
      compassName.textContent = spoken(home ?? 'Azania')
      applyInks()
      paint()
    },
    setInks: (nextWorld, nextShow, relations) => {
      inks = { world: nextWorld, showWorld: nextShow, relations }
      applyInks()
    },
    setMarks: (nextTowns, nextWorld, nextSieges, nextSelection, nextShow) => {
      sieges = nextSieges
      selection = nextSelection
      const built = buildMarks({ towns: nextTowns, world: nextWorld, sieges: nextSieges, selection: nextSelection, showWorld: nextShow })
      hits = built.hits
      battles = built.battles
      gl.setMarks('base', built.base)
      gl.setMarks('sieges', built.sieges)
      look.selected = selectedNumber()
      invalidate()
    },
    setPlayers: (on) => {
      players = on
      unsubscribePlayers?.()
      unsubscribePlayers = on ? props().liveStore.subscribe(showPlayers) : null
      showPlayers()
    },
    setReach: (on, radius) => {
      // Its capital as the war has it, else as the world's reading does, as the flat map finds it (../MapScene.tsx → useReaches).
      const home = homeNationOf(towns)
      const capital =
        maps().war.capitals.find((each) => sameNation(each.nation, home)) ?? (home ? world?.nationByName.get(home)?.capital : null)
      gl.setReach(on && capital ? reachRing(capital.home, radius) : null)
      invalidate()
    },
    setInsets: (next) => {
      if (next.top === insets.top && next.bottom === insets.bottom) return
      insets = next
      fit(true)
      if (phase === 'open') measureFloating()
    },
    setHidden: (next) => {
      hidden = next
      if (!hidden) invalidate()
    },
    dispose: () => {
      // Whatever happened, the flat map is left unveiled.
      setVeil(false)
      props().flat.current?.veil(false)
      disposed = true
      unsubscribePull()
      window.clearTimeout(pullLost)
      window.clearTimeout(pulseTimer)
      window.clearTimeout(wakeTimer)
      compass.removeEventListener('pointerdown', onCompassDown)
      compass.removeEventListener('click', onCompass)
      cancelAnimationFrame(raf)
      cancelAnimationFrame(hoverFrame)
      painting?.()
      window.clearInterval(pictureTimer)
      window.clearTimeout(pictureRetry)
      window.clearTimeout(waitTimer)
      window.clearTimeout(sayTimer)
      unsubscribePlayers?.()
      root.removeEventListener('keydown', onKeyTurn)
      root.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      resizer.disconnect()
      boxWatch.disconnect()
      notesWatch.disconnect()
      controls?.detach()
      names.dispose()
      gl.dispose()
      releaseSheet()
      numbers = { ids: new Uint8Array(0), width: 0, height: 0, nations: [] }
      hits = []
    },
  }
}
