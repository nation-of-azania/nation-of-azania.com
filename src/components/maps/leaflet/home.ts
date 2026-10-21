'use client'

import L from 'leaflet'

import { pixelsPerBlock } from '@/maps/palette'
import { worldCopyOf } from '@/maps/source'

import { worldWidthPx, type AzaniaTileLayer } from './tiles'

/**
 * Keeping the reader home. The live map repeats the world east and west
 * (src/maps/source.ts), and a pan across a seam would otherwise leave the
 * reader in an echo for good: a pale, inert copy, however far they went.
 * So the moment the view's centre crosses a seam — when most of the page
 * is on an echo — the map is re-based by whole worlds: the copy under the
 * reader becomes the real one, and the one they came from its echo. The
 * reader can scroll east forever and is always home, with the echoes only
 * ever at the edges of the page.
 *
 * Nothing on the page moves. Rather than panning, the map's own pixel
 * origin is shifted by exactly a world's width, so the same spot on the
 * page now means the same spot a world over; every tile is re-keyed to
 * the column it now stands for (./tiles.ts), since the picture there is
 * the same; and the layers are told to stand again where they are, which
 * for the markers, the sheets and the overlay is a cheap repositioning
 * with no picture asked for. The overlay is drawn again for the new view
 * (the real world in full colour under the reader, the wash gone over to
 * the other side); until that lands, what's drawn is left exactly where it
 * is, a correct picture in the old colours. The address names the same
 * spot, since it always names the real one; the heads keep gliding, since
 * they stand at real coordinates; and the drag or the inertia under way,
 * which only moves the map's pane, carries on untouched.
 *
 * A little slack past each seam keeps a centre that sits right on one
 * from flipping to and fro. The map isn't re-based while the map's own
 * dragging is off, which is while a tool's drag or a pen stroke is in
 * progress, nor in the middle of a zoom; the check runs again when the
 * map settles.
 */

/** How far past a seam the centre goes before the map re-bases, in px: the hysteresis. */
const SLACK_PX = 24

type HomeInternals = L.Map & {
  _pixelOrigin: L.Point
  _lastCenter: L.LatLng | null
  _animatingZoom?: boolean
  _flyToFrame?: number
  _panAnim?: { _inProgress?: boolean }
  dragging: L.Handler & { moving?: () => boolean }
}

/** A re-basing: by how many worlds the view moved west (east, if negative), and the map origin's shift in px. */
export type Rebase = { worlds: number; shift: L.Point }

export type Home = {
  /** Re-bases the map if the centre has crossed a seam; what it did, or null. */
  check: () => Rebase | null
  /** Whether the map is mid-pan by hand or by inertia: a plain shift of the pane, safe to re-base under. */
  panning: () => boolean
  /** Which copy of the world the reader is in, counted from where the map opened: +1 a world east. */
  world: () => number
}

export function createHome(map: L.Map, tiles: AzaniaTileLayer): Home {
  const internals = map as HomeInternals
  let world = 0
  return {
    check: () => {
      if (internals._animatingZoom || internals._flyToFrame || !map.dragging.enabled()) return null
      const zoom = map.getZoom()
      const x = map.getCenter().lng
      const slack = SLACK_PX / pixelsPerBlock(zoom)
      const worlds = worldCopyOf(x - Math.sign(x) * slack)
      if (!worlds) return null
      // The view moves `worlds` worlds west, so the same spot on the page means the real world.
      const shift = L.point(-worlds * worldWidthPx(map, zoom), 0)
      internals._pixelOrigin = internals._pixelOrigin.add(shift)
      internals._lastCenter = null
      tiles.shiftWorlds(worlds)
      world += worlds
      // Every layer stands again where it is: the tiles' levels shift, the markers and the sheets reposition.
      map.fire('viewreset')
      return { worlds, shift }
    },
    panning: () => Boolean(internals.dragging.moving?.() || internals._panAnim?._inProgress),
    world: () => world,
  }
}
