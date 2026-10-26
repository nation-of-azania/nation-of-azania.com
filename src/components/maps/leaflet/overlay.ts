'use client'

import type L from 'leaflet'

import { createSteady } from './steady'

/*
 * The overlay's own motion: how what's drawn for one view is moved into
 * place for another, frame by frame. The overlay is drawn by React only
 * when the map settles (./canvas.tsx); between drawings its group is moved
 * as a whole — a scale and a shift, the projection being linear in the
 * zoom's scale — while the marks and names in it are only shifted, never
 * scaled, and the lines keep their width (./steady.ts), so mid-zoom the
 * ground grows and shrinks and what has a size on the page keeps it. How
 * the names hand over from one drawing to the next lives in ./names.ts.
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
  /** Shows what's drawn in the group moved by `placement`: the group as a whole, or element by element. */
  place: (placement: Placement) => void
  dispose: () => void
}

/**
 * A group of the overlay, as it's moved from the view it was drawn for to
 * the view the map is shown at: the marks' (React's drawing over the
 * ground, or the names leaving it), moved element by element, their marks
 * and names only shifted, never scaled (./steady.ts); or, without
 * `steady`, the ground's, moved as a whole, which happens only as the view
 * settles (mid-zoom Leaflet scales its SVG instead).
 */
export function createLayer(element: SVGGElement, steady = true): Layer {
  const held = steady ? createSteady(element) : null
  let at = IDENTITY
  return {
    element,
    place: (placement) => {
      if (placement.k === at.k && placement.x === at.x && placement.y === at.y) return
      at = placement
      if (held) return held.apply(placement)
      const { k, x, y } = placement
      element.style.transform =
        k === 1 && x === 0 && y === 0 ? '' : `matrix(${k}, 0, 0, ${k}, ${x}, ${y})`
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
