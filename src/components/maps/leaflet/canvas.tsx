'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
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
import { inWorld } from '@/maps/source'

import type { Projection } from '../layers/projection'

import { AzaniaCRS, AzaniaWrappingCRS, toLatLng, toLatLngBounds, toPoint } from './crs'
import { createHome } from './home'
import {
  createLayer,
  createZoomEase,
  placementOf,
  shownAt,
  type Frame,
  type Layer,
  type Shown,
} from './overlay'
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
 * beside the panel on a laptop, with its echoes and torn edges beyond.
 */
export const MIN_ZOOM = MIN_NATIVE_ZOOM - 2.5

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
}

const MapContext = createContext<MapContextValue | null>(null)

/** The Leaflet map, the view it last settled at, a counter that advances each time, and the world the reader is in. */
export function useLeaflet(): MapContextValue {
  const value = useContext(MapContext)
  if (!value) throw new Error('useLeaflet needs a MapCanvas above it.')
  return value
}

/** The projection for the overlay at the settled view; recomputed when the view settles. */
export function useProjection(id = 'map'): Projection {
  const { map, view } = useLeaflet()
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
    }
  }, [map, view, id])
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

/** How the wheel zooms: pixels of scrolling per level, and the easing's time constant in ms. */
const WHEEL = { scrollPxPerLevel: 180, pinchPxPerLevel: 70, notchLevels: 0.5, ease: 90 } as const

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
 */
function installWheelZoom(map: L.Map, container: HTMLElement): () => void {
  const internals = map as MapInternals
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let target = 0
  let current = 0
  let anchor = L.point(0, 0)
  let begun = false
  let frame = 0
  let last = 0
  let lastWheel = 0

  const finish = () => {
    cancelAnimationFrame(frame)
    frame = 0
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
    const dt = Math.min(64, now - last)
    last = now
    current += (target - current) * (reduced() ? 1 : 1 - Math.exp(-dt / WHEEL.ease))
    if (Math.abs(target - current) < 0.002) current = target
    // Keep the block under the pointer under the pointer, as setZoomAround does.
    const scale = map.getZoomScale(current, map.getZoom())
    const half = map.getSize().divideBy(2)
    const shift = anchor.subtract(half).multiplyBy(1 - 1 / scale)
    const centre = map.containerPointToLatLng(half.add(shift))
    internals._move(centre, current, { pinch: true, round: false })
    if (current === target && now - lastWheel > 120) finish()
  }

  /** Moves the target zoom by `dz` levels about `at`, a point in the container; the frames ease the map after it. */
  const nudge = (dz: number, at: L.Point) => {
    if (!frame) {
      target = map.getZoom()
      current = target
      last = performance.now()
    }
    target = internals._limitZoom(target + dz)
    anchor = at
    lastWheel = performance.now()
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
    nudge(dz, map.mouseEventToContainerPoint(event))
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
  /** Rendered into the SVG overlay, in layer coordinates (useProjection). */
  children?: ReactNode
  /** Rendered over the map as ordinary DOM, inside the container (controls, frames). */
  chrome?: ReactNode
}

/**
 * The map itself: a Leaflet map in a div, its tiles from the cache, and an
 * SVG overlay the children are rendered into through a portal. Leaflet's
 * own SVG renderer holds that overlay, but where Leaflet would scale the
 * whole SVG like a picture mid-zoom — names ballooning, lines swelling —
 * the SVG keeps its size and the overlay's group is moved and scaled
 * inside it instead, frame by frame (./overlay.ts), with nothing of
 * React's running: the ground grows and shrinks, while what has a size on
 * the page keeps it and glides with its point (./steady.ts). When the view
 * settles, the children are rendered again at the new layer points; until
 * that render lands, the same move keeps what's drawn in place, so no
 * frame shows it askew.
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
  // The overlay's group as it's moved (./overlay.ts).
  const layer = useRef<Layer | null>(null)
  const handlers = useRef({ onMove, onPointer, onClick, onDoubleClick })
  useEffect(() => {
    handlers.current = { onMove, onPointer, onClick, onDoubleClick }
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
    const fly = map.flyTo.bind(map)
    map.flyTo = (centre, zoom, options) => {
      tiles.prefetch(L.latLng(centre), zoom ?? map.getZoom())
      return fly(centre, zoom, options)
    }

    // The overlay: Leaflet's SVG renderer, with a group of our own for React.
    const renderer = L.svg({ padding: OVERLAY_PADDING }).addTo(map)
    const svg = renderer as unknown as { _container: SVGSVGElement; _update: () => void }
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'az-overlay')
    svg._container.appendChild(group)
    // React listens for focus on the element it renders a portal into, and
    // Chromium makes an SVG element with focus listeners focusable: a tap on
    // a town or a nation focused the whole overlay, and the browser ringed
    // all that's drawn in it with its focus outline, a box the size of the
    // drawing, out of sight until a pinch shrank the overlay. Focus belongs
    // to the map itself, which shows a ring only for the keyboard.
    group.addEventListener('focus', () => container.focus({ preventScroll: true }))
    setOverlay(group)
    const shownNow = () => shown.current ?? shownAt(takeView(map))
    const drawing = createLayer(group)
    layer.current = drawing

    /**
     * The map is shown at `at`: what's drawn is moved there. Leaflet would
     * scale the SVG itself mid-zoom, like a picture; instead the SVG stays
     * where Leaflet last fitted it, over the map and a margin about it, at
     * its own size, so its pixels are still the layer's, and the group
     * inside is moved and scaled, its marks and names held steady. A zoom's
     * animation is followed frame by frame as the tiles ease.
     */
    const show = (at: Shown) => {
      shown.current = at
      if (drawn.current) drawing.place(placementOf(drawn.current, at))
    }
    const ease = createZoomEase({ map, shown: shownNow, show })
    const follow = (at: Frame) => {
      ease.stop()
      show(shownAt(at))
    }
    const scaler = renderer as unknown as SvgRenderer
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
    /** The map has settled, or been re-based (`rebase`, if not checked for here). */
    const settle = (rebase = home?.check()) => {
      if (rebase && drawn.current) {
        // The map's origin moved a world's width, and nothing on the page
        // did: what's drawn stands where it should, in the old colours,
        // until the fresh render lands; told it was drawn for the new
        // origin, it stays put. (In the drawn view's own pixels.)
        const scale = 2 ** (map.getZoom() - drawn.current.zoom)
        drawn.current = { ...drawn.current, origin: drawn.current.origin.add(rebase.shift.divideBy(scale)) }
        // The viewreset left the overlay's box a fraction of a pixel off, as Leaflet's does; its own update sets it exactly.
        svg._update()
      }
      const view = takeView(map)
      settled.current = view
      far()
      // Leaflet has just fitted the SVG to the new view (its own moveend ran
      // first); move what's drawn into place before React runs. A pan
      // leaves the layer points as they were, and the overlay untouched.
      follow(view)
      setContext({ map, version: ++version, view, world: home?.world() ?? 0 })
    }
    // In an echo the pointer is over nothing real, and a click lands nowhere.
    const real = (point: Point) => !wrap || inWorld(point)
    map.on('moveend', () => settle())
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
      ease.remove()
      drawing.dispose()
      observer.disconnect()
      detachSheets()
      map.remove()
      mapRef.current = null
      drawn.current = null
      settled.current = null
      shown.current = null
      layer.current = null
      setOverlay(null)
      setContext(null)
    }
    // Created once; later changes come through the other effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The children have just been drawn for the settled view: they stand in
  // place of their own accord, unless the map has moved on meanwhile.
  useLayoutEffect(() => {
    if (!context || !overlay) return
    drawn.current = context.view
    layer.current?.place(placementOf(context.view, shown.current ?? shownAt(context.view)))
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

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container || !interactive || !wheel) return
    return installWheelZoom(map, container)
  }, [interactive, wheel])

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
 * Fly the map somewhere, settling without animation for readers who ask
 * for less motion. `inset` is how much of the foot of the map a sheet
 * covers on a phone: the spot lands in the middle of what's left.
 */
export function flyTo(map: L.Map, centre: Point, zoom?: number, inset = 0): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const z = zoom ?? map.getZoom()
  const target = inset
    ? map.unproject(map.project(toLatLng(centre), z).add([0, inset / 2]), z)
    : toLatLng(centre)
  if (reduced) map.setView(target, z, { animate: false })
  else map.flyTo(target, z, { duration: 0.8 })
}

export function fitBounds(map: L.Map, bounds: Bounds, padding = 48, inset = 0): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  map.fitBounds(toLatLngBounds(bounds), {
    paddingTopLeft: [padding, padding],
    paddingBottomRight: [padding, padding + inset],
    animate: !reduced,
    duration: 0.8,
  })
}

export { L }
