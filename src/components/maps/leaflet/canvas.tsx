'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Component,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { pixelsPerBlock } from '@/maps/palette'
import { WORLD_LIMIT, type Bounds, type Point } from '@/maps/geo'
import type { Insets } from '@/maps/globe'
import { GLOBE } from '@/maps/globe-switches'
import { inWorld } from '@/maps/source'
import { FLAT_MIN_ZOOM, PULL, WHEEL } from '@/maps/view'

import type { GlobePull } from '../globe/types'
import type { Projection } from '../layers/projection'

import { AzaniaCRS, AzaniaWrappingCRS, toLatLng, toLatLngBounds, toPoint } from './crs'
import { createHome } from './home'
import { createNames, type Names, type NamesMode } from './names'
import { createLayer, createZoomEase, placementOf, shownAt, type Frame, type Layer, type Shown } from './overlay'
import { attachSheets } from './sheet'
import { AzaniaTileLayer, MAX_ZOOM, MIN_NATIVE_ZOOM } from './tiles'

/*
 * The map's pieces, each in a module of its own: the projection (./crs.ts),
 * the tiles (./tiles.ts), the world as one picture at the far zooms
 * (./sheet.ts), and the re-basing that keeps the reader in the real world
 * as the map repeats east and west (./home.ts). What the rest of the map
 * needs of them is exported again from here.
 */
export { AzaniaCRS, AzaniaWrappingCRS, toLatLng, toLatLngBounds, toPoint } from './crs'
export { MAX_ZOOM, MIN_NATIVE_ZOOM } from './tiles'

/**
 * Two and a half levels further out than the tiles go: the level-5 tiles
 * drawn smaller down to SHEET_ZOOM, and past that the world as one picture
 * (./sheet.ts). At −7 the whole world is 1,152 px across; at −7.5 it fits
 * beside the panel on a laptop, with its echoes and seams beyond.
 */
export const MIN_ZOOM = FLAT_MIN_ZOOM

export type MapPosition = { centre: Point; zoom: number }

/**
 * How far beyond the page the overlay reaches, as a share of the page's
 * size on each side: Leaflet's SVG renderer draws that far, and the layers
 * draw whatever lies within it, so a pan of up to this much of the page
 * shows the claims and names there before the map settles, not after.
 */
const OVERLAY_PADDING = 0.6

/**
 * The view the overlay is drawn for: taken the moment the map settles, so
 * what React renders and the transform that moves it into place can never
 * disagree, however late the render runs.
 */
type View = Frame & { bounds: L.LatLngBounds }

const takeView = (map: L.Map): View => ({
  zoom: map.getZoom(),
  origin: map.getPixelOrigin(),
  bounds: map.getBounds(),
})

type MapContextValue = {
  map: L.Map
  version: number
  view: View
  /**
   * Which copy of the world the reader is in, counted from where the map
   * opened: +1 after a pan a world east. The map is re-based so that copy
   * is always drawn as the real one (./home.ts); the number tells the
   * layers which copy on the page was which before, so the hand-over can
   * be drawn as one.
   */
  world: number
  /** The group over the ground that OnTop draws into: what keeps its size on the page mid-zoom. */
  marks: SVGGElement | null
  /** The names' hand-over from one drawing of the marks to the next (./names.ts); null when the names don't animate. */
  names: Names | null
  /** How the names animate, which the projection passes on to the layers. */
  mode: NamesMode
}

const MapContext = createContext<MapContextValue | null>(null)

/** The Leaflet map, the view it last settled at, a counter that advances each time, and the world the reader is in. */
export function useLeaflet(): MapContextValue {
  const value = useContext(MapContext)
  if (!value) throw new Error('useLeaflet needs a MapCanvas above it.')
  return value
}

/**
 * Draws its children over the map's ground, in the overlay's second SVG
 * (see MapCanvas): names, pins, marks, anything that keeps its size on the
 * page mid-zoom. Outside a live map (a still, rendered on the server) it
 * draws them where it stands. There is exactly one OnTop in each MapCanvas
 * (the map scene's and the embed's each have theirs): it is the boundary
 * at which the names hand over, and two would note and play twice.
 */
export function OnTop({ children }: { children: ReactNode }) {
  const context = useContext(MapContext)
  if (!context?.marks) return <>{children}</>
  return createPortal(
    <NamesBoundary drawn={context.view} names={context.names}>
      {children}
    </NamesBoundary>,
    context.marks,
  )
}

/**
 * Where the names' hand-over is told of every commit of the marks. React
 * calls getSnapshotBeforeUpdate just before it changes the DOM, which no
 * hook can see, so that is where each name is noted as it stands; the
 * drawing just committed is then played in componentDidUpdate, before
 * anything is painted. Every commit comes through here: a settle, a pause
 * mid-gesture, a selection, a layer toggled, the world arriving, the
 * clock's tick. `drawn` is the frame the children are drawn for.
 */
class NamesBoundary extends Component<{ names: Names | null; drawn: Frame; children: ReactNode }> {
  getSnapshotBeforeUpdate(): null {
    this.props.names?.note()
    return null
  }
  componentDidMount(): void {
    this.props.names?.play(this.props.drawn)
  }
  componentDidUpdate(): void {
    this.props.names?.play(this.props.drawn)
  }
  render(): ReactNode {
    return this.props.children
  }
}

/** The projection for the overlay at the settled view; recomputed when the view settles. */
export function useProjection(id = 'map'): Projection {
  const { map, view, mode } = useLeaflet()
  return useMemo(() => {
    const toBounds = (b: L.LatLngBounds): Bounds => ({
      minX: b.getWest(),
      maxX: b.getEast(),
      minZ: b.getSouth(),
      maxZ: b.getNorth(),
    })
    return {
      project: ([x, z]: Point) => {
        const p = map.project(L.latLng(z, x), view.zoom).subtract(view.origin)
        return [p.x, p.y]
      },
      ppb: pixelsPerBlock(view.zoom),
      zoom: view.zoom,
      bounds: toBounds(view.bounds.pad(OVERLAY_PADDING)),
      view: toBounds(view.bounds),
      id,
      names: mode === 'off' ? undefined : mode,
    }
  }, [map, view, id, mode])
}

/** Leaflet's own workings that a continuous zoom needs; what its pinch handler uses. */
type MapInternals = L.Map & {
  _animatingZoom?: boolean
  _stop: () => L.Map
  _moveStart: (zoomChanged: boolean, noMoveStart: boolean) => L.Map
  _move: (center: L.LatLng, zoom: number, data?: object, supressEvent?: boolean) => L.Map
  _moveEnd: (zoomChanged: boolean) => L.Map
  _limitZoom: (zoom: number) => number
  _getNewPixelOrigin: (center: L.LatLng, zoom?: number) => L.Point
}

/** Leaflet's SVG renderer's own step mid-zoom, which scales the whole SVG; the overlay takes it over. */
type SvgRenderer = { _updateTransform: (center: L.LatLng, zoom: number) => void }

/**
 * How long the map must hold still mid-gesture — fingers on the glass but
 * not moving, a drag held — before the overlay is drawn again for the view
 * as it stands, rather than when the gesture ends.
 */
const PAUSE_MS = 150

/** How many levels a flight must zoom by for the ground's shapes to bow out on the way. */
const FADE_FLIGHTS_FROM = 1.5

/** How far a held drag must have gone, as a share of the map's larger side, for a pause to draw again. */
const PAUSE_PAN = 0.15

/**
 * A frame longer than this, in ms, held the page up: the wheel's gesture
 * isn't taken as over on the frame after it, though on the one after that
 * it may be, so a page that stays slow still lets a zoom settle.
 */
const LONG_FRAME_MS = 100

/** Safari's own pinch event: the scale since the fingers came down (1 at the start), and where. */
type GestureEvent = UIEvent & { scale: number; clientX?: number; clientY?: number }

/**
 * Zooming with the wheel, by hand, the way a map app does it. Leaflet's own
 * handler waits, snaps and animates each step for 250 ms, dropping whatever
 * the wheel sends meanwhile; a trackpad, which sends dozens of small
 * deltas a second, finds that slow and steppy. Here every delta moves a
 * target zoom at once — in proportion for a trackpad, by a fixed step for
 * a click-wheel's notch, by a tighter ratio for a trackpad pinch (which
 * arrives as a wheel with Ctrl held) — and each frame eases the map
 * towards it around the pointer, through Leaflet's pinch path: cheap
 * transforms on the tiles and the overlay, nothing re-rendered, until the
 * gesture ends and the map settles once. Fractional zooms scale the
 * nearest native level's tiles; tiles are only ever asked for at those.
 *
 * Safari sends a trackpad pinch another way: not as a wheel but as gesture
 * events of its own, which the page must refuse, or Safari magnifies the
 * whole page instead (and, pinching out, shows its tabs). Where there are
 * such events, a pinch zooms the map the same way, by its scale — fingers
 * twice as far apart, a level in, Chrome's own ratio — about the pointer.
 * A pinch on a touchscreen is left to Leaflet's touch zoom, which has it
 * already. Should a browser ever send one pinch both ways, whichever moves
 * the map first in a gesture keeps it, and from the next gesture on the
 * wheel alone zooms, so a pinch never zooms twice.
 *
 * Past the farthest zoom the map goes no further, but the wheel or the
 * pinch held on is a pull (`onPull`), which curls the map up into the
 * globe (src/components/maps/globe). A pull counts only from a spell of
 * stillness at the floor (PULL.quietMs): a trackpad's fling, or a run of
 * notches that merely reaches the floor, belongs to the zoom that got it
 * there and never curls. What it has asked for past the floor is said as
 * it goes, a zoom back in taking from it first, and once more as the
 * gesture ends.
 */
function installWheelZoom(map: L.Map, container: HTMLElement, onPull?: (pull: GlobePull) => void): () => void {
  const internals = map as MapInternals
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let target = 0
  let current = 0
  let anchor = L.point(0, 0)
  let begun = false
  let frame = 0
  let last = 0
  let lastWheel = 0
  // Whether the last frame was a long one that the gesture waited out (LONG_FRAME_MS).
  let waited = false
  // A pull past the floor: the zoom asked for, unheld by the floor, and whether it has yet gone past.
  let pull: { raw: number; past: number; pulled: boolean } | null = null

  const finish = () => {
    cancelAnimationFrame(frame)
    frame = 0
    if (pull?.pulled) onPull?.(pullOf(pull.past, 'end', false))
    pull = null
    if (!begun) return
    begun = false
    // Tiles for the level arrived at, then the map settles.
    map.fire('zoom')
    internals._moveEnd(true)
  }

  const step = (now: number) => {
    frame = requestAnimationFrame(step)
    // Leaflet is mid-animation (a button's zoom): let it finish first.
    if (internals._animatingZoom) {
      last = now
      return
    }
    if (!begun) {
      begun = true
      internals._stop()
      current = map.getZoom()
      internals._moveStart(true, false)
      last = now
    }
    const gap = now - last
    const dt = Math.min(64, gap)
    last = now
    current += (target - current) * (reduced() ? 1 : 1 - Math.exp(-dt / WHEEL.ease))
    if (Math.abs(target - current) < 0.002) current = target
    // Keep the block under the pointer under the pointer, as setZoomAround does.
    const scale = map.getZoomScale(current, map.getZoom())
    const half = map.getSize().divideBy(2)
    const shift = anchor.subtract(half).multiplyBy(1 - 1 / scale)
    const centre = map.containerPointToLatLng(half.add(shift))
    internals._move(centre, current, { pinch: true, round: false })
    // Done once the wheel has rested a moment (a pull, as long as the stillness that arms one, so notches
    // in quick succession are one pull); not on the frame after a long one, when a notch sent meanwhile
    // may still be on its way in, but on the next, long or not, so a page that stays slow still settles.
    const wait = gap >= LONG_FRAME_MS && !waited
    waited = wait
    if (current === target && now - lastWheel > (pull ? PULL.quietMs : 120) && !wait) finish()
  }

  /**
   * Moves the target zoom by `dz` levels about `at`, a point in the container; the frames ease the map after it.
   * Pulling past the floor, a click-wheel's notch out (`notch`) counts as one notch however far the mouse says it
   * turned, as mice and screens scaled up say it turned further: one never opens the globe, and two always do.
   */
  const nudge = (dz: number, at: L.Point, notch = false) => {
    const now = performance.now()
    if (!frame) {
      target = map.getZoom()
      current = target
      last = now
    }
    const floor = map.getMinZoom()
    // At the floor after a spell of stillness, a fresh gesture: from here on, it may pull. A gesture still
    // easing (`frame`) is the one that came to the floor, however long the page held it up meanwhile: a
    // stall in a fling looks like stillness by the clock, but the fling's own frames are still running.
    if (onPull && !pull && !frame && now - lastWheel >= PULL.quietMs && target <= floor + 0.02)
      pull = { raw: target, past: 0, pulled: false }
    if (pull) {
      pull.raw = Math.min(map.getMaxZoom(), pull.raw + (notch && dz < 0 ? -WHEEL.notchLevels : dz))
      target = internals._limitZoom(pull.raw)
      const past = Math.max(0, floor - pull.raw)
      if (past > 0 || pull.past > 0) {
        pull.past = past
        pull.pulled = true
        onPull?.(pullOf(past, 'move', false))
      }
    } else target = internals._limitZoom(target + dz)
    anchor = at
    lastWheel = now
    if (!frame) frame = requestAnimationFrame(step)
  }

  // A Safari pinch under way (see below): its scale so far, and which of the two ways is zooming with it.
  let gesture: { scale: number; by: 'gesture' | 'wheel' | null } | null = null
  // Once a pinch has come as a wheel too, the wheel alone zooms.
  let wheelPinches = false

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    let dy = event.deltaY
    if (event.deltaMode === 1) dy *= 16
    else if (event.deltaMode === 2) dy *= container.clientHeight
    if (!dy) return
    const pinch = event.ctrlKey
    if (pinch && gesture) {
      wheelPinches = true
      if (gesture.by === 'gesture') return
      gesture.by = 'wheel'
    }
    // A click-wheel mouse sends whole notches, big and far apart; a trackpad a stream of small ones.
    const notch = !pinch && (event.deltaMode !== 0 || Math.abs(dy) >= 60)
    const dz = pinch
      ? -dy / WHEEL.pinchPxPerLevel
      : notch
        ? -Math.sign(dy) * WHEEL.notchLevels * Math.min(2, Math.max(1, Math.abs(dy) / 100))
        : -dy / WHEEL.scrollPxPerLevel
    nudge(dz, map.mouseEventToContainerPoint(event), notch)
  }

  // Safari's pinch: only where the browser has gesture events at all.
  const gestures = 'GestureEvent' in window
  let touching = false
  let pointer: L.Point | null = null
  const onTouch = (event: TouchEvent) => {
    touching = event.touches.length > 0
  }
  const onPointerMove = (event: PointerEvent) => {
    pointer = map.mouseEventToContainerPoint(event)
  }
  const onPointerLeave = () => {
    pointer = null
  }
  /** Where a pinch zooms about: the pointer, as for the wheel; else where the event says, if that's on the map; else the middle. */
  const anchorOf = (event: GestureEvent): L.Point => {
    if (pointer) return pointer
    const { clientX, clientY } = event
    if (typeof clientX === 'number' && typeof clientY === 'number' && Number.isFinite(clientX) && Number.isFinite(clientY)) {
      const rect = container.getBoundingClientRect()
      const at = L.point(clientX - rect.left, clientY - rect.top)
      if (at.x >= 0 && at.y >= 0 && at.x <= rect.width && at.y <= rect.height) return at
    }
    return map.getSize().divideBy(2)
  }
  const onGestureStart = (event: Event) => {
    // Fingers on a touchscreen: Leaflet's touch zoom has the pinch.
    if (touching) return
    event.preventDefault()
    gesture = { scale: 1, by: null }
  }
  const onGestureChange = (event: Event) => {
    if (!gesture) return
    event.preventDefault()
    const { scale } = event as GestureEvent
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return
    const dz = Math.log2(scale / gesture.scale)
    gesture.scale = scale
    if (!dz || wheelPinches || gesture.by === 'wheel') return
    gesture.by = 'gesture'
    nudge(dz, anchorOf(event as GestureEvent))
  }
  const onGestureEnd = (event: Event) => {
    if (!gesture) return
    event.preventDefault()
    // Let go: the map settles as soon as it has eased to where the pinch left it.
    if (gesture.by === 'gesture') lastWheel = 0
    gesture = null
  }

  container.addEventListener('wheel', onWheel, { passive: false })
  if (gestures) {
    container.addEventListener('gesturestart', onGestureStart, { passive: false })
    container.addEventListener('gesturechange', onGestureChange, { passive: false })
    container.addEventListener('gestureend', onGestureEnd, { passive: false })
    container.addEventListener('touchstart', onTouch, { passive: true })
    container.addEventListener('touchend', onTouch, { passive: true })
    container.addEventListener('touchcancel', onTouch, { passive: true })
    container.addEventListener('pointermove', onPointerMove, { passive: true })
    container.addEventListener('pointerleave', onPointerLeave, { passive: true })
  }
  return () => {
    container.removeEventListener('wheel', onWheel)
    if (gestures) {
      container.removeEventListener('gesturestart', onGestureStart)
      container.removeEventListener('gesturechange', onGestureChange)
      container.removeEventListener('gestureend', onGestureEnd)
      container.removeEventListener('touchstart', onTouch)
      container.removeEventListener('touchend', onTouch)
      container.removeEventListener('touchcancel', onTouch)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerleave', onPointerLeave)
    }
    cancelAnimationFrame(frame)
    frame = 0
    if (begun) finish()
  }
}

/**
 * Whether the reader is at the keyboard, said on the map's root as
 * `.az-keyed`: the map, and the globe over it, are ringed in saffron when
 * focused only then. Leaflet focuses the map from a script as it's
 * pressed, which the browser takes for the keyboard's doing, so the
 * browser's own :focus-visible would ring it for a mouse or a finger too.
 * A key pressed (a shortcut or a modifier alone aside) says the reader is
 * at the keyboard; a press of the pointer, that they aren't.
 */
function trackKeyboard(root: Element): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || /^(Shift|Control|Alt|Meta)$/.test(event.key)) return
    if (!root.classList.contains('az-keyed')) root.classList.add('az-keyed')
  }
  const onPointer = () => {
    if (root.classList.contains('az-keyed')) root.classList.remove('az-keyed')
  }
  document.addEventListener('keydown', onKey, true)
  document.addEventListener('pointerdown', onPointer, true)
  return () => {
    document.removeEventListener('keydown', onKey, true)
    document.removeEventListener('pointerdown', onPointer, true)
  }
}

/**
 * A pull as the globe is told of it: far enough to open it once let go
 * (a pinch needs a little less), or at once if pulled on further still.
 */
function pullOf(levels: number, phase: GlobePull['phase'], touch: boolean): GlobePull {
  const opens = levels >= (phase === 'move' ? PULL.auto : touch ? PULL.commitTouch : PULL.commit)
  return { levels, phase, touch, opens, at: performance.now() }
}

/** Leaflet's pinch on a touchscreen, and whether it's under way. */
type TouchZoomInternals = L.Handler & { _zooming?: boolean }

/**
 * The other ways of pulling the map past its farthest zoom (the wheel's
 * are in installWheelZoom). Two fingers that come down at the floor and
 * pinch on: Leaflet lets the map give a little past it, and springs it
 * back once they lift, and how far it gave is the pull, ending as they
 * lift (this listener runs before Leaflet's own, so the map hasn't yet
 * sprung back). And a fresh press of the minus key at the floor, which
 * asks for the globe outright; held down from further in, it stops at the
 * floor, as the wheel does.
 */
function installPull(map: L.Map, container: HTMLElement, onPull: (pull: GlobePull) => void): () => void {
  const pinch = map.touchZoom as TouchZoomInternals
  const atFloor = () => map.getZoom() <= map.getMinZoom() + 0.02
  let touch: { past: number; pulled: boolean } | null = null
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) touch = atFloor() ? { past: 0, pulled: false } : null
  }
  const onZoom = (event: L.LeafletEvent) => {
    if (!touch || !(event as L.LeafletEvent & { pinch?: boolean }).pinch || !pinch._zooming) return
    const past = Math.max(0, map.getMinZoom() - map.getZoom())
    if (past <= 0 && touch.past <= 0) return
    touch.past = past
    touch.pulled = true
    onPull(pullOf(past, 'move', true))
  }
  const onTouchEnd = (event: TouchEvent) => {
    if (!touch || event.touches.length >= 2) return
    if (touch.pulled) onPull(pullOf(touch.past, 'end', true))
    touch = null
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.target !== container || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
    if ((event.key === '-' || event.key === '_') && atFloor())
      onPull(pullOf(Infinity, 'end', false))
  }
  container.addEventListener('touchstart', onTouchStart, { passive: true })
  container.addEventListener('touchend', onTouchEnd, { passive: true })
  container.addEventListener('touchcancel', onTouchEnd, { passive: true })
  container.addEventListener('keydown', onKey)
  map.on('zoom', onZoom)
  return () => {
    container.removeEventListener('touchstart', onTouchStart)
    container.removeEventListener('touchend', onTouchEnd)
    container.removeEventListener('touchcancel', onTouchEnd)
    container.removeEventListener('keydown', onKey)
    map.off('zoom', onZoom)
  }
}

/** How far east or west the map may be panned when the world wraps, in blocks: a hundred-odd worlds, which is forever. */
const WRAP_REACH = WORLD_LIMIT * 100

type CanvasProps = {
  /** Where to open: a centre and zoom, or bounds to fit. */
  initial: MapPosition | { bounds: Bounds; padding?: number }
  className?: string
  /** The CSS cursor over the map, e.g. crosshair while drawing. */
  cursor?: string
  /** Dragging and zooming by hand; off for a still frame that opens on a tap. */
  interactive?: boolean
  /** Whether the wheel zooms; off in an article, where it would catch the page's scroll. */
  wheel?: boolean
  /**
   * Whether the world repeats east and west (the live map); an article's
   * embed stays bounded. Fixed when the map is made. In an echo the pointer
   * is over nothing and a click lands nowhere, so neither is passed on.
   */
  wrap?: boolean
  onReady?: (map: L.Map) => void
  onMove?: (position: MapPosition) => void
  onPointer?: (point: Point | null) => void
  onClick?: (point: Point, event: L.LeafletMouseEvent) => void
  onDoubleClick?: (point: Point, event: L.LeafletMouseEvent) => void
  /**
   * The map pulled out past its farthest zoom, by the wheel, a pinch or the
   * minus key: the live map's way into the globe. Only a map that wraps and
   * zooms by hand is ever pulled, and only while the globe may curl up out
   * of it (src/maps/globe-switches.ts → GLOBE).
   */
  onPull?: (pull: GlobePull) => void
  /**
   * How the names animate (./names.ts): handed over from one drawing of
   * the marks to the next as the drawing settles; placed again every frame
   * mid-gesture besides (`live`, the map's own canvas); or not at all, a
   * plain swap. Fixed when the map is made.
   */
  names?: NamesMode
  /** Rendered into the SVG overlay, in layer coordinates (useProjection). */
  children?: ReactNode
  /** Rendered over the map as ordinary DOM, inside the container (controls, frames). */
  chrome?: ReactNode
}

/**
 * The map itself: a Leaflet map in a div, its tiles from the cache, and an
 * SVG overlay the children are rendered into through a portal, in two
 * parts. The ground (the children themselves) lies in one of Leaflet's SVG
 * renderers, which mid-zoom Leaflet scales whole like a picture, on the
 * compositor, at no cost. What keeps its size on the page (whatever the
 * children draw through OnTop: names, pins, marks) lies over it in a
 * second, which keeps its size while its group is moved and scaled inside
 * it, frame by frame (./overlay.ts), its marks held steady and gliding with
 * their points (./steady.ts); nothing of React's runs meanwhile. When the
 * view settles, or holds still a moment mid-gesture, the children are
 * rendered again at the new layer points and the names hand over to the
 * new plan; until that render lands, a move keeps what's drawn in place,
 * so no frame shows it askew.
 */
export function MapCanvas({
  initial,
  className,
  cursor,
  interactive = true,
  wheel = true,
  wrap = false,
  onReady,
  onMove,
  onPointer,
  onClick,
  onDoubleClick,
  onPull,
  names: mode = 'settle',
  children,
  chrome,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [overlay, setOverlay] = useState<SVGGElement | null>(null)
  const [context, setContext] = useState<MapContextValue | null>(null)
  // The view the overlay's contents were drawn for, the view the map last settled at, and where it's shown just now.
  const drawn = useRef<View | null>(null)
  const settled = useRef<View | null>(null)
  const shown = useRef<Shown | null>(null)
  // The overlay's groups as they're moved (./overlay.ts): the marks' and the ground's.
  const layer = useRef<Layer | null>(null)
  const groundLayer = useRef<Layer | null>(null)
  const handlers = useRef({ onMove, onPointer, onClick, onDoubleClick, onPull })
  useEffect(() => {
    handlers.current = { onMove, onPointer, onClick, onDoubleClick, onPull }
  })

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return
    const map = L.map(container, {
      crs: wrap ? AzaniaWrappingCRS : AzaniaCRS,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      zoomSnap: 0,
      zoomDelta: 0.5,
      zoomControl: false,
      attributionControl: false,
      // North and south stay bounded either way; east and west only when the world doesn't wrap.
      maxBounds: toLatLngBounds({
        minX: wrap ? -WRAP_REACH : -WORLD_LIMIT,
        maxX: wrap ? WRAP_REACH : WORLD_LIMIT,
        minZ: -WORLD_LIMIT,
        maxZ: WORLD_LIMIT,
      }),
      maxBoundsViscosity: 0.9,
      boxZoom: false,
      doubleClickZoom: false,
      dragging: interactive,
      // The wheel is ours (installWheelZoom), not Leaflet's.
      scrollWheelZoom: false,
      touchZoom: interactive,
      keyboard: interactive,
    })
    mapRef.current = map
    if ('bounds' in initial) {
      map.fitBounds(toLatLngBounds(initial.bounds), {
        padding: [initial.padding ?? 48, initial.padding ?? 48],
        animate: false,
      })
    } else {
      map.setView(toLatLng(initial.centre), initial.zoom, { animate: false })
    }

    const tiles = new AzaniaTileLayer(wrap).addTo(map)
    // The world as one picture, under the tiles; fetched ahead of a zoom on the live map, not in an article.
    const detachSheets = attachSheets(map, { wrap, tiles, preload: wrap })
    // A flight's destination has its tiles asked for at take-off, so they're in when it lands (flyToBounds flies through here too).
    // On a long one the ground's shapes bow out on the way and come back drawn for where it lands (maps.css → .az-flying):
    // scaled as a picture over several levels, a town's border swells into a blur on the way down.
    const fly = map.flyTo.bind(map)
    map.flyTo = (centre, zoom, options) => {
      const to = zoom ?? map.getZoom()
      tiles.prefetch(L.latLng(centre), to)
      if (Math.abs(to - map.getZoom()) >= FADE_FLIGHTS_FROM) {
        container.classList.add('az-flying')
        map.once('moveend', () => requestAnimationFrame(() => container.classList.remove('az-flying')))
      }
      return fly(centre, zoom, options)
    }

    // The overlay, in two of Leaflet's SVG renderers, each with a group of
    // our own for React. The ground (claims, roads, rings) is drawn into
    // the first, and mid-zoom Leaflet scales that SVG whole, like a picture,
    // which the compositor does without painting it again: its many long
    // shapes cost nothing through a gesture, though their lines thicken and
    // thin with it until the view settles. What keeps its size on the page
    // (names, pins, marks: OnTop) is drawn into the second, over it, which
    // keeps its own size; its group is moved and scaled frame by frame and
    // its marks held steady (./overlay.ts), so only those few things are
    // painted again each frame. Drawn as one SVG, a pinch painted every
    // claim and road anew each frame, some four times the work.
    const overlaySvg = (name: string) => {
      const renderer = L.svg({ padding: OVERLAY_PADDING }).addTo(map)
      const svg = renderer as unknown as { _container: SVGSVGElement; _update: () => void }
      svg._container.classList.add(`${name}-svg`)
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('class', `az-overlay ${name}`)
      svg._container.appendChild(group)
      // React listens for focus on the element it renders a portal into, and
      // Chromium makes an SVG element with focus listeners focusable: a tap on
      // a town or a nation focused the whole overlay, and the browser ringed
      // all that's drawn in it with its focus outline, a box the size of the
      // drawing, out of sight until a pinch shrank the overlay. Focus belongs
      // to the map itself, which shows a ring only for the keyboard.
      group.addEventListener('focus', () => container.focus({ preventScroll: true }))
      return { renderer, svg, group }
    }
    const ground = overlaySvg('az-ground')
    const top = overlaySvg('az-marks')
    /** Fits both SVGs to the view, as Leaflet does when the map settles. */
    const fit = () => {
      ground.svg._update()
      top.svg._update()
    }
    // Beside the marks, the names going as the drawing changes, fading where they stood (./names.ts).
    const gone = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    gone.setAttribute('class', 'az-leaving')
    gone.setAttribute('aria-hidden', 'true')
    top.svg._container.appendChild(gone)
    setOverlay(ground.group)
    const shownNow = () => shown.current ?? shownAt(takeView(map))
    const drawing = createLayer(top.group)
    const groundDrawing = createLayer(ground.group, false)
    const leaving = createLayer(gone)
    layer.current = drawing
    groundLayer.current = groundDrawing
    // The names' hand-over, told of every commit of the marks by OnTop's boundary; none, and the drawing simply swaps.
    const names =
      mode === 'off'
        ? null
        : createNames({ map, container, group: top.group, leaving, drawn: () => drawn.current, shown: shownNow, mode })
    // Mid-zoom the ground's SVG is held as the picture it was when the zoom set out, scaled by the
    // compositor rather than painted afresh at each new scale; it's painted sharp again as it settles.
    map.on('zoomstart', () => container.classList.add('az-zooming'))
    map.on('zoomend', () => container.classList.remove('az-zooming'))

    /**
     * The map is shown at `at`: the marks are moved there. Leaflet would
     * scale their SVG itself mid-zoom, like a picture, as it does the
     * ground's; instead it stays where Leaflet last fitted it, over the map
     * and a margin about it, at its own size, so its pixels are still the
     * layer's, and the group inside is moved and scaled, its marks and
     * names held steady. A zoom's animation is followed frame by frame as
     * the tiles ease.
     */
    const show = (at: Shown) => {
      shown.current = at
      if (drawn.current) drawing.place(placementOf(drawn.current, at))
      names?.show(at)
    }
    const ease = createZoomEase({ map, shown: shownNow, show })
    const follow = (at: Frame) => {
      ease.stop()
      show(shownAt(at))
    }
    const scaler = top.renderer as unknown as SvgRenderer
    scaler._updateTransform = (center, zoom) => {
      const at = { zoom, origin: (map as MapInternals)._getNewPixelOrigin(center, zoom) }
      if ((map as MapInternals)._animatingZoom) ease.start(at)
      else follow(at)
    }

    // Past the coarsest tiles, the level-5 tiles are drawn smaller: smoothed, since dropping pixels only speckles them.
    const far = () => container.classList.toggle('az-far', map.getZoom() < MIN_NATIVE_ZOOM)
    map.on('zoom', far)

    // When the world repeats, the reader is kept in the real copy of it.
    const home = wrap ? createHome(map, tiles) : null
    let version = 0
    /**
     * The map has settled, or been re-based (`rebase`, if not checked for
     * here), or is held still mid-gesture (`held`).
     */
    const settle = (rebase = home?.check(), held = false) => {
      if (rebase && drawn.current) {
        // The map's origin moved a world's width, and nothing on the page
        // did: what's drawn stands where it should, in the old colours,
        // until the fresh render lands; told it was drawn for the new
        // origin, it stays put. (In the drawn view's own pixels.)
        const scale = 2 ** (map.getZoom() - drawn.current.zoom)
        drawn.current = { ...drawn.current, origin: drawn.current.origin.add(rebase.shift.divideBy(scale)) }
        names?.rebase(rebase.shift, map.getZoom())
        // The viewreset left the overlay's box a fraction of a pixel off, as Leaflet's does; its own update sets it exactly.
        fit()
      }
      // Leaflet fits the SVGs to the view when the map settles; held mid-gesture, they're fitted here, since a long drag may have carried them off the page.
      if (held) fit()
      const view = takeView(map)
      const last = settled.current
      settled.current = view
      far()
      // Leaflet has just fitted the SVG to the new view (its own moveend ran
      // first); move what's drawn into place before React runs. A pan
      // leaves the layer points as they were, and the overlay untouched.
      follow(view)
      if (drawn.current) groundDrawing.place(placementOf(drawn.current, shownAt(view)))
      // Let go where a pause already drew it, the view is the same, and so is the drawing.
      const same =
        last !== null &&
        view.zoom === last.zoom &&
        view.origin.equals(last.origin) &&
        view.bounds.equals(last.bounds)
      if (same && !rebase) return
      // The names are noted as they stand and handed over once the new drawing is in, at OnTop's boundary.
      setContext({ map, version: ++version, view, world: home?.world() ?? 0, marks: top.group, names, mode })
    }
    // In an echo the pointer is over nothing real, and a click lands nowhere.
    const real = (point: Point) => !wrap || inWorld(point)
    map.on('moveend', () => settle())

    // A gesture held still — a pinch whose fingers rest, a drag held — is
    // drawn again for the view as it stands, so the names and what's come
    // onto the page catch up while the reader looks, not only once they
    // let go. Not while a zoom animates, which never pauses, nor for a drag
    // too short to have brought anything new onto the page; and never
    // re-based mid-gesture, which the gesture would undo.
    let moving = false
    let pause = 0
    const paused = () => {
      pause = 0
      const last = settled.current
      if (!moving || !last || (map as MapInternals)._animatingZoom) return
      const size = map.getSize()
      const shift = map.latLngToContainerPoint(last.bounds.getCenter()).distanceTo(size.divideBy(2))
      if (Math.abs(map.getZoom() - last.zoom) < 0.02 && shift < PAUSE_PAN * Math.max(size.x, size.y)) return
      settle(null, true)
    }
    map.on('movestart', () => {
      moving = true
    })
    map.on('move', () => {
      if (!moving) return
      window.clearTimeout(pause)
      pause = window.setTimeout(paused, PAUSE_MS)
    })
    map.on('moveend', () => {
      moving = false
      window.clearTimeout(pause)
    })
    // Mid-pan, by hand or by inertia, the seam is crossed where it's crossed: the map re-bases there and then.
    if (home)
      map.on('move', () => {
        if (!home.panning()) return
        const rebase = home.check()
        if (rebase) settle(rebase)
      })
    map.on('moveend', () =>
      handlers.current.onMove?.({ centre: toPoint(map.getCenter()), zoom: map.getZoom() }),
    )
    map.on('mousemove', (event: L.LeafletMouseEvent) => {
      const point = toPoint(event.latlng)
      handlers.current.onPointer?.(real(point) ? point : null)
    })
    map.on('mouseout', () => handlers.current.onPointer?.(null))
    map.on('click', (event: L.LeafletMouseEvent) => {
      const point = toPoint(event.latlng)
      if (real(point)) handlers.current.onClick?.(point, event)
    })
    map.on('dblclick', (event: L.LeafletMouseEvent) => {
      const point = toPoint(event.latlng)
      if (real(point)) handlers.current.onDoubleClick?.(point, event)
    })

    // The map's box changes when a panel opens beside it.
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(container)

    settle()
    handlers.current.onMove?.({ centre: toPoint(map.getCenter()), zoom: map.getZoom() })
    onReady?.(map)

    return () => {
      window.clearTimeout(pause)
      ease.remove()
      names?.dispose()
      drawing.dispose()
      groundDrawing.dispose()
      leaving.dispose()
      observer.disconnect()
      detachSheets()
      map.remove()
      mapRef.current = null
      drawn.current = null
      settled.current = null
      shown.current = null
      layer.current = null
      groundLayer.current = null
      setOverlay(null)
      setContext(null)
    }
    // Created once; later changes come through the other effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The children have just been drawn for the settled view: they stand in
  // place of their own accord, unless the map has moved on meanwhile. (The
  // names have handed over already, at OnTop's boundary, which runs first:
  // a child's layout effects come before its parent's.)
  useLayoutEffect(() => {
    if (!context || !overlay) return
    drawn.current = context.view
    layer.current?.place(placementOf(context.view, shown.current ?? shownAt(context.view)))
    // The ground's SVG stands as Leaflet last fitted it, for the view the map last settled at.
    groundLayer.current?.place(placementOf(context.view, shownAt(settled.current ?? context.view)))
  }, [context, overlay])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const toggle = (handler: L.Handler | undefined, on: boolean) =>
      on ? handler?.enable() : handler?.disable()
    toggle(map.dragging, interactive)
    toggle(map.touchZoom, interactive)
    toggle(map.keyboard, interactive)
  }, [interactive])

  // Whether the reader is at the keyboard, for the map's ring and the globe's (../maps.css → .az-keyed).
  useEffect(() => {
    const root = containerRef.current?.closest('.az-maps')
    return root ? trackKeyboard(root) : undefined
  }, [])

  // A pull is passed on only while it's wanted (the shell offers no globe while drawing, say): asked of the handlers when it comes.
  const pulls = Boolean(onPull)
  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container || !interactive || !wheel) return
    const pull = wrap && pulls && GLOBE.curl ? (next: GlobePull) => handlers.current.onPull?.(next) : undefined
    const unzoom = installWheelZoom(map, container, pull)
    const unpull = pull ? installPull(map, container, pull) : null
    return () => {
      unzoom()
      unpull?.()
    }
  }, [interactive, wheel, wrap, pulls])

  return (
    <div
      className={className}
      ref={containerRef}
      style={{ cursor: cursor ?? undefined }}
      tabIndex={-1}
    >
      {context && overlay ? (
        <MapContext.Provider value={context}>
          {createPortal(children, overlay)}
          {chrome}
        </MapContext.Provider>
      ) : null}
    </div>
  )
}

/**
 * How long a flight takes, in seconds: a hop next door quick, a dive from
 * the whole nation down to a town's streets long enough to follow, never
 * so long that it's a wait. Leaflet's own reckoning ran past two seconds
 * for the dive; a fixed 0.8 rushed it.
 */
function flightTime(map: L.Map, zoom: number): number {
  return Math.min(1.4, Math.max(0.6, 0.4 + 0.25 * Math.abs(zoom - map.getZoom())))
}

/** Nothing covering the map's head or foot. */
const UNCOVERED: Insets = { top: 0, bottom: 0 }

/**
 * Fly the map somewhere, settling without animation for readers who ask
 * for less motion. `cover` is how much of the map's head and foot is
 * covered, on a phone by its floating search and its sheet: the spot lands
 * in the middle of what's left.
 */
export function flyTo(map: L.Map, centre: Point, zoom?: number, cover: Insets = UNCOVERED): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const z = zoom ?? map.getZoom()
  const shift = (cover.bottom - cover.top) / 2
  const target = shift
    ? map.unproject(map.project(toLatLng(centre), z).add([0, shift]), z)
    : toLatLng(centre)
  if (reduced) map.setView(target, z, { animate: false })
  else map.flyTo(target, z, { duration: flightTime(map, z) })
}

/**
 * Fly the map to frame `bounds`, as flyTo does. Not Leaflet's fitBounds:
 * that animates a zoom of four levels at most and jumps past it, and a
 * town is often further in than that from a view of the whole nation, so
 * a click on one on a laptop cut straight to it.
 */
export function fitBounds(map: L.Map, bounds: Bounds, padding = 48, cover: Insets = UNCOVERED): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const target = toLatLngBounds(bounds)
  const paddingTopLeft = L.point(padding, padding + cover.top)
  const paddingBottomRight = L.point(padding, padding + cover.bottom)
  if (reduced) {
    map.fitBounds(target, { paddingTopLeft, paddingBottomRight, animate: false })
    return
  }
  const zoom = Math.min(map.getMaxZoom(), map.getBoundsZoom(target, false, paddingTopLeft.add(paddingBottomRight)))
  map.flyToBounds(target, { paddingTopLeft, paddingBottomRight, duration: flightTime(map, zoom) })
}

export { L }
