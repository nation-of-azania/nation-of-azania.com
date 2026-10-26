import {
  CLICK,
  pickLonLat,
  placeSpot,
  radiusAt,
  TILT,
  zoomAround,
  type GlobeView,
  type LonLat,
  type RestFrame,
} from '@/maps/globe'
import { WHEEL } from '@/maps/view'

import { lessMotion } from './motion'

/**
 * How a reader handles the globe: by hand, as a globe on a desk is
 * turned. A drag spins it, north always up, the spot under the pointer
 * following it; let go while moving and it spins on, slowing as a heavy
 * thing does; a press stops it. The wheel and a trackpad zoom it about the
 * pointer as they do the flat map (src/components/maps/leaflet/canvas.tsx,
 * whose rates it shares), two fingers likewise; pushed out past its
 * farthest it gives and springs back, and brought in past its closest it
 * hands back to the flat map there. A click is a press that barely moves.
 * And the keyboard, once the globe has the focus: the arrows turn it, plus
 * and minus zoom, Enter opens the flat map at the middle, Home turns to
 * Azania. Escape is the shell's.
 *
 * Nothing here draws or animates by itself: the globe's frame loop steps
 * the spin and the wheel's easing (`step`), so input and drawing never
 * run a frame apart.
 */

export type ControlsHost = {
  view: () => GlobeView
  frame: () => RestFrame
  /** Turns or zooms the globe: at once, or eased over a moment (a cut for less motion). */
  set: (next: Partial<GlobeView>, how?: 'eased' | 'now') => void
  /** Whether the globe takes input at all: only while it's open. */
  enabled: () => boolean
  tap: (sx: number, sy: number, touch: boolean) => void
  hover: (sx: number | null, sy: number | null) => void
  key: (action: 'enter' | 'home') => void
  /** Zoomed in past the globe's closest, about a point: time to hand back. */
  pastHand: (sx: number, sy: number) => void
  /** A frame is wanted. */
  invalidate: () => void
  /** The hand is on the globe, or has let go: for the cursor. */
  grabbing: (on: boolean) => void
}

export type Controls = {
  detach: () => void
  /** Steps the spin and the wheel to `now`; true while either still moves. */
  step: (now: number) => boolean
  /** Stops everything in hand: the spin, the wheel, a drag. */
  halt: () => void
}

/** A spin slower than this, in radians a second, has stopped. */
const SPIN_STOPS = 0.02
/** How quickly a spin slows, across and up and down, in ms. */
const SPIN_LONGITUDE_MS = 600
const SPIN_LATITUDE_MS = 350
/** The fastest a let-go globe spins, as its surface moves on the page, in px a ms. */
const SPIN_FASTEST = 2.5
/** How far back a let-go reads the hand's speed, in ms. */
const SPEED_OVER_MS = 80
/** How hard the globe resists being tipped past 75°, and pushed out past its farthest (in levels). */
const TIP_RESISTANCE = 0.35
const PUSH_GIVE = 0.35
/** How long the wheel must rest before the zoom is done with. */
const WHEEL_DONE_MS = 150
/** The keyboard's turn, in degrees (with Shift, more), and its zoom, in levels. */
const KEY_TURN = 10
const KEY_TURN_FAR = 30
const KEY_ZOOM = 0.5

const DEGREE = Math.PI / 180

/** A latitude tipped past the hold, given against resistance up to the limit. */
function tipped(raw: number): number {
  const over = Math.abs(raw) - TILT.hold
  if (over <= 0) return raw
  return Math.sign(raw) * (TILT.hold + Math.min(TILT.give - TILT.hold, over * TIP_RESISTANCE))
}

/** A zoom pushed out past the farthest, given against resistance. */
function pushed(raw: number, least: number): number {
  if (raw >= least) return raw
  return least - PUSH_GIVE * (1 - Math.exp(-(least - raw) / PUSH_GIVE))
}

/** Safari's own pinch event: the scale since the fingers came down, and where. */
type GestureEvent = UIEvent & { scale: number; clientX?: number; clientY?: number }

export function attachControls(root: HTMLElement, host: ControlsHost): Controls {
  const pointers = new Map<number, { x: number; y: number; touch: boolean }>()
  let rect = root.getBoundingClientRect()
  const local = (event: { clientX: number; clientY: number }): [number, number] => [
    event.clientX - rect.left,
    event.clientY - rect.top,
  ]

  // The press that may be a click; the drag's own latitude before the tip's resistance; its recent course.
  let press: { id: number; x: number; y: number; at: number; moved: boolean; spun: boolean; touch: boolean } | null = null
  let dragLat = 0
  let course: { at: number; x: number; y: number }[] = []
  // The spin after a let-go, in radians a ms.
  let spin: { lon: number; lat: number; last: number } | null = null
  // The wheel's zoom: where it's going (raw, before the push's give), where it is, and about what.
  let wheel: { raw: number; current: number; x: number; y: number; last: number; touched: number } | null = null
  // Two fingers: the spot between them as they came down, how far apart, and the zoom then.
  let pinch: { spot: LonLat | null; apart: number; zoom: number; done: boolean } | null = null
  // The keyboard's aim, so presses in quick succession add up rather than restart.
  let aim: { lon: number; lat: number; zoom: number; at: number } | null = null
  // Where the mouse is over the globe, while it's over it: what lies under it is asked again once the globe comes to rest.
  let mouse: [number, number] | null = null
  const rehover = () => {
    if (mouse && !spin) host.hover(mouse[0], mouse[1])
  }

  const halt = () => {
    spin = null
    wheel = null
  }

  const handBack = (x: number, y: number) => {
    halt()
    pinch = pinch && { ...pinch, done: true }
    host.pastHand(x, y)
  }

  // A drag: the ground turns under the hand, more across near the poles, where a degree of longitude is short.
  const drag = (dx: number, dy: number) => {
    const view = host.view()
    const R = radiusAt(view.zoom)
    dragLat += dy / R
    host.set({ lon: view.lon - dx / (R * Math.max(Math.cos(view.lat), 0.35)), lat: tipped(dragLat) })
  }

  /** Tipped past the hold, the globe settles back to it. */
  const settleTip = () => {
    const { lat } = host.view()
    if (Math.abs(lat) > TILT.hold) host.set({ lat: Math.sign(lat) * TILT.hold }, 'eased')
  }

  const startPinch = () => {
    const [a, b] = [...pointers.values()]
    const x = (a.x + b.x) / 2
    const y = (a.y + b.y) / 2
    const view = host.view()
    pinch = { spot: pickLonLat(x, y, view), apart: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom: view.zoom, done: false }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (!host.enabled() || (event.pointerType === 'mouse' && event.button !== 0)) return
    rect = root.getBoundingClientRect()
    const [x, y] = local(event)
    // A pointer the page no longer has (one made up, one already gone) can't be captured; the drag goes on without.
    try {
      root.setPointerCapture?.(event.pointerId)
    } catch {}
    pointers.set(event.pointerId, { x, y, touch: event.pointerType !== 'mouse' })
    if (event.pointerType === 'mouse') mouse = [x, y]
    // A press stops a spin, and is then no click: it was a catch. The ground moves under the hand from here, so
    // whatever the pointer was over is no longer named or lifted until the hand lets go and the globe is still.
    const spun = spin !== null
    halt()
    host.hover(null, null)
    if (pointers.size === 1) {
      press = { id: event.pointerId, x, y, at: event.timeStamp, moved: false, spun, touch: event.pointerType !== 'mouse' }
      dragLat = host.view().lat
      course = [{ at: event.timeStamp, x, y }]
      host.grabbing(true)
    } else if (pointers.size === 2) {
      press = null
      startPinch()
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    const held = pointers.get(event.pointerId)
    if (!held) {
      // The pointer passing over, nothing pressed: what's under it.
      if (event.pointerType !== 'mouse' || event.buttons) return
      rect = root.getBoundingClientRect()
      mouse = local(event)
      // Still spinning, the globe is asked what's under the pointer once it comes to rest.
      if (!spin) host.hover(mouse[0], mouse[1])
      return
    }
    if (!host.enabled()) return
    const [x, y] = local(event)
    if (!held.touch) mouse = [x, y]
    const dx = x - held.x
    const dy = y - held.y
    held.x = x
    held.y = y
    if (pointers.size === 1) {
      if (press && press.id === event.pointerId && !press.moved) {
        const limit = press.touch ? CLICK.moveTouchPx : CLICK.movePx
        if (Math.hypot(x - press.x, y - press.y) < limit) return
        press.moved = true
      }
      drag(dx, dy)
      // Timed by when the hand moved, not when the page got round to it: a slow frame mustn't read as a pause.
      const now = event.timeStamp
      course.push({ at: now, x, y })
      while (course.length > 2 && now - course[0].at > SPEED_OVER_MS + 40) course.shift()
      return
    }
    if (pointers.size === 2 && pinch && !pinch.done) {
      const [a, b] = [...pointers.values()]
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const frame = host.frame()
      const raw = pinch.zoom + Math.log2(Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) / pinch.apart)
      if (raw >= frame.zoomHand) return handBack(mx, my)
      const zoom = pushed(raw, frame.zoomMin)
      const view = host.view()
      const next = (pinch.spot && placeSpot(view, pinch.spot, mx, my, zoom)) ?? zoomAround(view, mx, my, zoom)
      host.set({ lon: next.lon, lat: tipped(next.lat), zoom: next.zoom })
    }
  }

  const onPointerUp = (event: PointerEvent) => {
    const held = pointers.get(event.pointerId)
    if (!held) return
    pointers.delete(event.pointerId)
    try {
      root.releasePointerCapture?.(event.pointerId)
    } catch {}
    const now = event.timeStamp
    if (pointers.size === 1) {
      // From two fingers to one: the one left drags on from where it is.
      pinch = null
      dragLat = host.view().lat
      course = []
      const frame = host.frame()
      if (host.view().zoom < frame.zoomMin) host.set({ zoom: frame.zoomMin }, 'eased')
      return
    }
    if (pointers.size > 0) return
    host.grabbing(false)
    const wasPinch = pinch !== null
    pinch = null
    if (event.type === 'pointercancel') {
      press = null
      settleTip()
      return
    }
    if (press && press.id === event.pointerId && !press.moved && !press.spun && now - press.at < CLICK.ms && host.enabled()) {
      const [x, y] = [held.x, held.y]
      press = null
      rehover()
      return host.tap(x, y, held.touch)
    }
    press = null
    const frame = host.frame()
    if (wasPinch && host.view().zoom < frame.zoomMin) host.set({ zoom: frame.zoomMin }, 'eased')
    settleTip()
    // Let go while moving: it spins on. Let go still: what's under the pointer now is named again.
    const last = course[course.length - 1]
    const first = course.find((sample) => last && last.at - sample.at <= SPEED_OVER_MS)
    course = []
    if (!last || !first || first === last || now - last.at > SPEED_OVER_MS || lessMotion() || wasPinch) return rehover()
    const ms = Math.max(1, last.at - first.at)
    let vx = (last.x - first.x) / ms
    let vy = (last.y - first.y) / ms
    const speed = Math.hypot(vx, vy)
    if (speed > SPIN_FASTEST) {
      vx *= SPIN_FASTEST / speed
      vy *= SPIN_FASTEST / speed
    }
    const view = host.view()
    const R = radiusAt(view.zoom)
    spin = { lon: -vx / (R * Math.max(Math.cos(view.lat), 0.35)), lat: vy / R, last: now }
    host.invalidate()
  }

  /** Moves the wheel's aim by `dz` levels about a point; the frames ease the globe after it. */
  const nudge = (dz: number, x: number, y: number) => {
    if (!host.enabled()) return
    spin = null
    const now = performance.now()
    const frame = host.frame()
    if (!wheel) wheel = { raw: host.view().zoom, current: host.view().zoom, x, y, last: now, touched: now }
    wheel.raw = Math.max(frame.zoomMin - 2, Math.min(frame.zoomHand, wheel.raw + dz))
    wheel.x = x
    wheel.y = y
    wheel.touched = now
    if (wheel.raw >= frame.zoomHand - 1e-6) return handBack(x, y)
    host.invalidate()
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    let dy = event.deltaY
    if (event.deltaMode === 1) dy *= 16
    else if (event.deltaMode === 2) dy *= root.clientHeight
    if (!dy) return
    rect = root.getBoundingClientRect()
    const [x, y] = local(event)
    // A trackpad's pinch comes as a wheel with Ctrl held; a click-wheel in whole notches, big and far apart.
    const pinching = event.ctrlKey
    const notch = !pinching && (event.deltaMode !== 0 || Math.abs(dy) >= 60)
    const dz = pinching
      ? -dy / WHEEL.pinchPxPerLevel
      : notch
        ? -Math.sign(dy) * WHEEL.notchLevels * Math.min(2, Math.max(1, Math.abs(dy) / 100))
        : -dy / WHEEL.scrollPxPerLevel
    nudge(dz, x, y)
  }

  // Safari's pinch, as the flat map takes it (leaflet/canvas.tsx): refused as a page zoom, and its scale used
  // only when no finger is on the glass, where the two pointers have it already.
  const gestures = 'GestureEvent' in window
  let touching = false
  let gesture: { scale: number } | null = null
  const onTouch = (event: TouchEvent) => {
    touching = event.touches.length > 0
  }
  const onGestureStart = (event: Event) => {
    if (touching) return
    event.preventDefault()
    gesture = { scale: 1 }
  }
  const onGestureChange = (event: Event) => {
    if (!gesture) return
    event.preventDefault()
    const { scale, clientX, clientY } = event as GestureEvent
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return
    const dz = Math.log2(scale / gesture.scale)
    gesture.scale = scale
    if (!dz) return
    rect = root.getBoundingClientRect()
    const frame = host.frame()
    const [x, y] =
      typeof clientX === 'number' && typeof clientY === 'number' ? local({ clientX, clientY }) : [frame.cx, frame.cy]
    nudge(dz, x, y)
  }
  const onGestureEnd = (event: Event) => {
    if (!gesture) return
    event.preventDefault()
    gesture = null
  }

  const onKey = (event: KeyboardEvent) => {
    if (!host.enabled() || event.target !== root || event.metaKey || event.ctrlKey || event.altKey) return
    const now = performance.now()
    const view = host.view()
    const frame = host.frame()
    const base = aim && now - aim.at < 300 ? aim : { lon: view.lon, lat: view.lat, zoom: view.zoom, at: now }
    const turn = (event.shiftKey ? KEY_TURN_FAR : KEY_TURN) * DEGREE
    const go = (next: { lon?: number; lat?: number; zoom?: number }) => {
      event.preventDefault()
      halt()
      aim = { ...base, ...next, at: now }
      host.set(next, 'eased')
    }
    switch (event.key) {
      case 'ArrowLeft':
        return go({ lon: base.lon - turn })
      case 'ArrowRight':
        return go({ lon: base.lon + turn })
      // Up and down no further than the hold, and never back the other way from past it.
      case 'ArrowUp':
        return go({ lat: Math.max(base.lat, Math.min(TILT.hold, base.lat + turn)) })
      case 'ArrowDown':
        return go({ lat: Math.min(base.lat, Math.max(-TILT.hold, base.lat - turn)) })
      case '+':
      case '=': {
        const zoom = base.zoom + KEY_ZOOM
        if (zoom >= frame.zoomHand - 0.05) {
          event.preventDefault()
          return handBack(frame.cx, frame.cy)
        }
        return go({ zoom })
      }
      case '-':
      case '_':
        return go({ zoom: Math.max(frame.zoomMin, base.zoom - KEY_ZOOM) })
      case 'Enter':
      case ' ':
        event.preventDefault()
        return host.key('enter')
      case 'Home':
        event.preventDefault()
        return host.key('home')
    }
  }

  const onLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    mouse = null
    host.hover(null, null)
  }
  const refuse = (event: Event) => event.preventDefault()

  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('pointermove', onPointerMove)
  root.addEventListener('pointerup', onPointerUp)
  root.addEventListener('pointercancel', onPointerUp)
  root.addEventListener('pointerleave', onLeave)
  root.addEventListener('wheel', onWheel, { passive: false })
  root.addEventListener('keydown', onKey)
  root.addEventListener('contextmenu', refuse)
  if (gestures) {
    root.addEventListener('gesturestart', onGestureStart, { passive: false })
    root.addEventListener('gesturechange', onGestureChange, { passive: false })
    root.addEventListener('gestureend', onGestureEnd, { passive: false })
    root.addEventListener('touchstart', onTouch, { passive: true })
    root.addEventListener('touchend', onTouch, { passive: true })
    root.addEventListener('touchcancel', onTouch, { passive: true })
  }

  const step = (now: number): boolean => {
    let moving = false
    if (spin) {
      const dt = Math.max(0, Math.min(64, now - spin.last))
      spin.last = now
      const view = host.view()
      let lat = view.lat + spin.lat * dt
      if (Math.abs(lat) >= TILT.hold) {
        lat = Math.sign(lat) * TILT.hold
        spin.lat = 0
      }
      host.set({ lon: view.lon + spin.lon * dt, lat })
      spin.lon *= Math.exp(-dt / SPIN_LONGITUDE_MS)
      spin.lat *= Math.exp(-dt / SPIN_LATITUDE_MS)
      if (Math.hypot(spin.lon, spin.lat) * 1000 < SPIN_STOPS) {
        spin = null
        rehover()
      } else moving = true
    }
    if (wheel) {
      const dt = Math.max(0, Math.min(64, now - wheel.last))
      wheel.last = now
      const frame = host.frame()
      const target = pushed(wheel.raw, frame.zoomMin)
      wheel.current += (target - wheel.current) * (lessMotion() ? 1 : 1 - Math.exp(-dt / WHEEL.ease))
      if (Math.abs(target - wheel.current) < 0.002) wheel.current = target
      const next = zoomAround(host.view(), wheel.x, wheel.y, wheel.current)
      host.set({ lon: next.lon, lat: next.lat, zoom: next.zoom })
      if (wheel.current === target && now - wheel.touched > WHEEL_DONE_MS) {
        wheel = null
        // Pushed out past its farthest, it springs back.
        if (target < frame.zoomMin) host.set({ zoom: frame.zoomMin }, 'eased')
        rehover()
      } else moving = true
    }
    return moving
  }

  return {
    step,
    halt: () => {
      halt()
      pinch = null
      press = null
      pointers.clear()
    },
    detach: () => {
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', onPointerUp)
      root.removeEventListener('pointercancel', onPointerUp)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('keydown', onKey)
      root.removeEventListener('contextmenu', refuse)
      if (gestures) {
        root.removeEventListener('gesturestart', onGestureStart)
        root.removeEventListener('gesturechange', onGestureChange)
        root.removeEventListener('gestureend', onGestureEnd)
        root.removeEventListener('touchstart', onTouch)
        root.removeEventListener('touchend', onTouch)
        root.removeEventListener('touchcancel', onTouch)
      }
    },
  }
}
