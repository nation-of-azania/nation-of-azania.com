'use client'

import L from 'leaflet'

import { createSteady } from './steady'

/*
 * The overlay's own motion: how what's drawn for one view is moved into
 * place for another, frame by frame, and how the names hand over from one
 * drawing to the next. The overlay is drawn by React only when the map
 * settles (./canvas.tsx); between drawings its group is moved as a whole
 * — a scale and a shift, the projection being linear in the zoom's scale
 * — while the marks and names in it are scaled back and the lines keep
 * their width (./steady.ts), so mid-zoom the ground grows and shrinks and
 * what has a size on the page keeps it.
 */

/** A view as the overlay knows it: its zoom, and the map's pixel origin there. */
export type Frame = { zoom: number; origin: L.Point }

/** An affine move of the overlay's pixels: a scale, then a shift. */
export type Placement = { k: number; x: number; y: number }

const IDENTITY: Placement = { k: 1, x: 0, y: 0 }

/** Where something drawn for one frame stands in another. */
export function alignment(from: Frame, to: Frame): Placement {
  const k = 2 ** (to.zoom - from.zoom)
  return { k, x: from.origin.x * k - to.origin.x, y: from.origin.y * k - to.origin.y }
}

/** `inner`, then `outer`. */
const compose = (outer: Placement, inner: Placement): Placement => ({
  k: outer.k * inner.k,
  x: outer.k * inner.x + outer.x,
  y: outer.k * inner.y + outer.y,
})

/**
 * Where the overlay is shown just now: at a frame, and moved on from it by
 * `eased` while a zoom's animation is under way — a scale and a shift each
 * eased in a straight line, as the tiles' transition eases theirs, so a
 * point drawn anywhere moves exactly as the ground beneath it.
 */
export type Shown = { frame: Frame; eased: Placement }

export const shownAt = (frame: Frame): Shown => ({ frame, eased: IDENTITY })

/** The move of something drawn for `drawn` to where the map is shown. */
export const placementOf = (drawn: Frame, shown: Shown): Placement =>
  compose(shown.eased, alignment(drawn, shown.frame))

/** Partway from `shown` to `to`, `p` of the way along. */
export function easedTowards(shown: Shown, to: Frame, p: number): Shown {
  const from = shown.eased
  const end = alignment(shown.frame, to)
  return {
    frame: shown.frame,
    eased: {
      k: from.k + (end.k - from.k) * p,
      x: from.x + (end.x - from.x) * p,
      y: from.y + (end.y - from.y) * p,
    },
  }
}

export type Layer = {
  element: SVGGElement
  /** Moves the group as a whole, and holds its marks steady at the scale it's moved by. */
  place: (placement: Placement) => void
  dispose: () => void
}

/**
 * A group of the overlay that's moved as a whole: React's drawing, or the
 * names leaving it. With `steady`, its marks and names are held their size
 * at the scale it's moved by (./steady.ts); the ground's group, which is
 * only ever moved into place as the view settles, has none to hold.
 */
export function createLayer(element: SVGGElement, steady = true): Layer {
  const held = steady ? createSteady(element) : null
  let at = IDENTITY
  return {
    element,
    place: (placement) => {
      if (placement.k === at.k && placement.x === at.x && placement.y === at.y) return
      at = placement
      const { k, x, y } = placement
      element.style.transform =
        k === 1 && x === 0 && y === 0 ? '' : `matrix(${k}, 0, 0, ${k}, ${x}, ${y})`
      held?.apply(k)
    },
    dispose: () => held?.disconnect(),
  }
}

export type ZoomEase = {
  /** Leaflet has set off a zoom's animation to `to`: the overlay follows it, frame by frame. */
  start: (to: Frame) => void
  stop: () => void
  remove: () => void
}

/**
 * A zoom's animation (a button's, a key's, a pinch let go) as Leaflet runs
 * it: the tiles eased by a CSS transition set off once, not moved frame by
 * frame. The overlay follows it: a hidden element in the map's pane, eased
 * by the same rule from the same frame, says each frame how far the
 * transition has got, and the overlay is eased as far, so it and the tiles
 * move as one, whatever the frame rate.
 */
export function createZoomEase({
  map,
  shown,
  show,
}: {
  map: L.Map
  /** Where the map is shown just now, and showing it somewhere. */
  shown: () => Shown
  show: (at: Shown) => void
}): ZoomEase {
  const clock = document.createElement('div')
  clock.className = 'leaflet-zoom-animated az-zoom-clock'
  clock.setAttribute('aria-hidden', 'true')
  map.getPane('overlayPane')!.appendChild(clock)
  // The clock runs from one end of a 1000 px track to the other, and back the next time.
  let end = 0
  const progress = () => {
    const x = new DOMMatrixReadOnly(getComputedStyle(clock).transform).m41
    return Math.min(1, Math.max(0, end ? x / 1000 : 1 - x / 1000))
  }
  let frame = 0
  let from: Shown | null = null
  let to: Frame | null = null
  const tick = () => {
    frame = 0
    if (!from || !to) return
    const p = progress()
    show(easedTowards(from, to, p))
    if ((map as L.Map & { _animatingZoom?: boolean })._animatingZoom && p < 1)
      frame = requestAnimationFrame(tick)
  }
  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
    from = to = null
  }
  return {
    start: (target) => {
      from = shown()
      to = target
      end = end ? 0 : 1000
      clock.style.transform = `translateX(${end}px)`
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(tick)
    },
    stop,
    remove: () => {
      stop()
      clock.remove()
    },
  }
}

const SVG = 'http://www.w3.org/2000/svg'

/** The hand-over's own animations, told apart from a layer's (a pulse, a fade of its own). */
const OURS = 'az-handover'

/** How the names move when the view settles: quick, and calm. */
const HANDOVER = {
  /** A name that stays glides to its new spot, easing in to land. */
  glide: { duration: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  /** One that goes fades where it stood. */
  leave: { duration: 160, easing: 'ease-out' },
  /** One that comes fades in once those going have mostly gone. */
  arrive: { duration: 220, delay: 70, easing: 'ease-out' },
  /** Further than this, in px, a name doesn't glide but goes and comes again: a glide that far reads as a fling. */
  farthest: 140,
} as const

/** A name as it stood when the view settled: the element, its middle in the layer's pixels, and what it drew with. */
type Spot = {
  element: SVGElement
  x: number
  y: number
  /** The point a group around it was held upright about (its data-az-at), when the name isn't held itself. */
  upright: string | null
  /** Whether it stood in an echo of the world, which is washed. */
  echo: boolean
}

export type Handover = {
  /** Notes where every name stands, just before the overlay is drawn again; `drawn` is the frame it stands drawn for. */
  note: (drawn: Frame) => void
  /** Forgets what was noted: the next drawing simply replaces this one (a re-basing, where every name stays where it is). */
  drop: () => void
  /** The overlay has been drawn again: the names glide, go and come. */
  play: () => void
  /** The map is shown somewhere new: the names still fading where they stood move with it. */
  show: (shown: Shown) => void
}

/**
 * The hand-over from one plan of names to the next. Which names fit is
 * decided once per view (layers/labels.ts), so when the view settles some
 * names stay, some take a better spot, some go and some come; swapped all
 * at once, the page jumps. So just before the overlay is drawn again,
 * where each name stands on the page is noted, and once the new drawing is
 * in, a name still there glides from where it stood to its new spot, one
 * gone fades out where it was (the very element React let go of, in a
 * group of its own beside the overlay), and one new fades in. A name is
 * an element a layer marks with `data-az-name` (layers/projection.ts →
 * named), keyed by what it names, so a town's name is known as itself
 * across two drawings. Readers who ask for less motion get the swap.
 *
 * Positions are compared in the layer's pixels, which stand still under a
 * pan; if the map zoomed between the noting and the drawing (a gesture
 * begun meanwhile), nothing glides, and names only go and come.
 */
export function createHandover({
  map,
  container,
  group,
  leaving,
  shown,
}: {
  map: L.Map
  container: HTMLElement
  /** The overlay's group, which React draws into. */
  group: SVGGElement
  /** A layer beside it, for the names going: moved like the overlay, from the frame they were drawn for. */
  leaving: Layer
  /** Where the map is shown just now. */
  shown: () => Shown
}): Handover {
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let noted: { names: Map<string, Spot>; frame: Frame; drawn: Frame } | null = null
  // The frame the names fading out were drawn for.
  let leavingFrame: Frame | null = null

  const frameNow = (): Frame => ({ zoom: map.getZoom(), origin: map.getPixelOrigin() })
  const animating = () => Boolean((map as L.Map & { _animatingZoom?: boolean })._animatingZoom)

  /** Where an element's middle stands, in the layer's pixels: the page's, less the map's box and the pane's offset. */
  const measure = () => {
    const box = container.getBoundingClientRect()
    const offset = L.DomUtil.getPosition(map.getPane('mapPane')!)
    return (element: Element) => {
      const r = element.getBoundingClientRect()
      return {
        x: r.left + r.width / 2 - box.left - offset.x,
        y: r.top + r.height / 2 - box.top - offset.y,
      }
    }
  }

  const names = () => group.querySelectorAll<SVGElement>('[data-az-name]')

  const clearLeaving = () => {
    for (const animation of leaving.element.getAnimations({ subtree: true })) animation.cancel()
    leaving.element.replaceChildren()
    leavingFrame = null
  }

  /** A name gone from the drawing: the element React let go of, faded out where it stood. */
  const leave = (spot: Spot) => {
    const { element } = spot
    if (element.isConnected) return
    const wrap = document.createElementNS(SVG, 'g')
    if (spot.upright) wrap.setAttribute('data-az-at', spot.upright)
    wrap.appendChild(element)
    leaving.element.appendChild(wrap)
    const fade = wrap.animate([{ opacity: spot.echo ? 0.55 : 1 }, { opacity: 0 }], {
      ...HANDOVER.leave,
      fill: 'forwards',
      id: OURS,
    })
    fade.onfinish = () => wrap.remove()
  }

  const arrive = (element: SVGElement) => {
    element.animate([{ opacity: 0 }, { opacity: 1 }], {
      ...HANDOVER.arrive,
      fill: 'backwards',
      id: OURS,
    })
  }

  const glide = (element: SVGElement, dx: number, dy: number) => {
    element.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], {
      ...HANDOVER.glide,
      id: OURS,
    })
  }

  return {
    note: (drawn) => {
      clearLeaving()
      noted = null
      if (reduced()) return
      const at = measure()
      const spots = new Map<string, Spot>()
      for (const element of names()) {
        const holder = element.closest('[data-az-at]')
        spots.set(element.getAttribute('data-az-name')!, {
          element,
          ...at(element),
          upright: holder && holder !== element ? holder.getAttribute('data-az-at') : null,
          echo: Boolean(element.closest('[data-echo]')),
        })
      }
      noted = { names: spots, frame: frameNow(), drawn }
    },
    drop: () => {
      noted = null
    },
    play: () => {
      const before = noted
      noted = null
      if (!before || !before.names.size) return
      const frame = frameNow()
      const steady =
        frame.zoom === before.frame.zoom && frame.origin.equals(before.frame.origin) && !animating()
      const at = measure()
      const seen = new Set<string>()
      for (const element of names()) {
        const key = element.getAttribute('data-az-name')!
        seen.add(key)
        const was = before.names.get(key)
        // A glide or a fade from the last hand-over still under way gives way to this one.
        for (const animation of element.getAnimations())
          if (animation.id === OURS) animation.cancel()
        if (!was) {
          arrive(element)
          continue
        }
        if (!steady) {
          if (was.element !== element) leave(was)
          continue
        }
        const now = at(element)
        const dx = was.x - now.x
        const dy = was.y - now.y
        const far = Math.hypot(dx, dy)
        if (far < 0.75) continue
        if (far <= HANDOVER.farthest) glide(element, dx, dy)
        else {
          arrive(element)
          if (was.element !== element) leave(was)
        }
      }
      for (const [key, was] of before.names) if (!seen.has(key)) leave(was)
      if (leaving.element.childNodes.length) {
        leavingFrame = before.drawn
        leaving.place(placementOf(before.drawn, shown()))
      }
    },
    show: (shown) => {
      if (!leavingFrame) return
      if (!leaving.element.childNodes.length) leavingFrame = null
      else leaving.place(placementOf(leavingFrame, shown))
    },
  }
}
