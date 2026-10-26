import type { Point } from './geo'
import { pixelsPerBlock } from './palette'
import { WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH, worldCopyOf } from './source'

/**
 * The world as a globe: the arithmetic the globe on /maps is drawn by
 * (src/components/maps/globe), and what the flat map and the globe agree
 * on, so that one can hand over to the other where the reader is looking.
 *
 * The Rulercraft world is a map of the Earth, two blocks wide for every one
 * tall (src/maps/source.ts): an equirectangular picture, its x the
 * longitude and its −z the latitude, so wrapping it round a sphere asks for
 * nothing but a scale. A radian is the same number of blocks either way,
 * and a sphere R pixels in radius is the flat map at the zoom whose pixels
 * per block make R pixels a radian. The globe's zoom is therefore the flat
 * map's own: a globe that hands back at zoom −5 lands on a flat map at −5,
 * the spot that faced the reader under the same pixels. The poles pinch,
 * as the corners of any flat map wrapped round a ball must: Antarctica is
 * plain ice to the pole, where a pinch can't be seen, but the Arctic is sea
 * and patchy ice, so the globe softens its last few degrees (POLE, below).
 *
 * Pure, and free of Leaflet and three.js. Only the globe itself imports
 * it, so it loads with the globe; the switches the shell needs sooner are
 * in ./globe-switches.ts, and the thresholds of the pull past the flat
 * map's farthest zoom that opens it, with the flat map's gestures, in
 * ./view.ts.
 */

export { GLOBE } from './globe-switches'
export { PULL } from './view'

/** Blocks to a radian, east and west alike, north and south alike: 11,734.2. */
export const BLOCKS_PER_RADIAN = WORLD_WIDTH / (2 * Math.PI)

/** The globe's radius in pixels at a zoom: a radian is BLOCKS_PER_RADIAN blocks at that zoom's pixels per block. */
export const radiusAt = (zoom: number): number => (WORLD_WIDTH * 2 ** zoom) / Math.PI

/** The zoom whose globe is `r` pixels in radius. */
export const zoomForRadius = (r: number): number => Math.log2((Math.PI * r) / WORLD_WIDTH)

/** A spot on the globe, in radians: longitude east of x = 0, latitude north of z = 0. */
export type LonLat = { lon: number; lat: number }

const HALF_PI = Math.PI / 2
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** An angle brought within (−π, π]. */
export function wrapAngle(angle: number): number {
  const turned = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI))
  return turned === -Math.PI ? Math.PI : turned
}

/**
 * A block's spot on the globe. An x in an echo of the world is the same spot
 * as in the real one; a z past the poles (a claim's corner may reach 16
 * blocks beyond) is held at the pole.
 */
export function toLonLat([x, z]: Point): LonLat {
  const real = x - worldCopyOf(x) * WORLD_WIDTH
  return { lon: real / BLOCKS_PER_RADIAN, lat: clamp(-z / BLOCKS_PER_RADIAN, -HALF_PI, HALF_PI) }
}

/** The block at a spot on the globe: x in the real world, [WORLD_WEST, WORLD_EAST); z within the poles. */
export function toBlock({ lon, lat }: LonLat): Point {
  const x = lon * BLOCKS_PER_RADIAN
  const real = x - worldCopyOf(x) * WORLD_WIDTH
  return [real >= WORLD_EAST ? WORLD_WEST : real, clamp(-lat * BLOCKS_PER_RADIAN, WORLD_NORTH, WORLD_SOUTH)]
}

/**
 * How the globe stands: the spot facing the reader (`lon`, `lat`), its zoom
 * (the radius is radiusAt(zoom)), how far the flat sheet has curled into a
 * ball (`t`: 0 the flat map, 1 the globe), and where on the page, in the
 * container's pixels, the facing spot is drawn (`cx`, `cy`). And, while it
 * curls, how far the ball is tipped to bring the facing latitude round to
 * the front (`tilt`: 1, as the globe rests, unless said; 0 upright, the
 * facing spot held where it's drawn and the ball beneath it).
 */
export type GlobeView = { lon: number; lat: number; zoom: number; t: number; cx: number; cy: number; tilt?: number }

/** What covers the map's top and foot (a phone's search bar, its sheet), in pixels; the globe sits between. */
export type Insets = { top: number; bottom: number }

/**
 * Where the globe rests on a page, and how near it may come: the middle of
 * what isn't covered, the radius that fills most of it (`rFit`), and from
 * that the zoom it rests at, the farthest it may be pushed out to, and the
 * zoom at which coming closer hands it back to the flat map. It rests no
 * smaller than 120 px in radius, unless the room it has is smaller still (a
 * phone on its side, between its search bar and its sheet), where it fills
 * what there is and runs under neither.
 */
export type RestFrame = { cx: number; cy: number; rFit: number; zoomRest: number; zoomMin: number; zoomHand: number }

/** The closest a globe comes before it hands over: no further out than −6.5, where the flat map has tiles still, and no further in than −5, where its picture is already twice its own size. */
export const HAND_ZOOM = { from: -6.5, to: -5 } as const

export function restFrame(width: number, height: number, insets: Insets): RestFrame {
  const tall = Math.max(0, height - insets.top - insets.bottom)
  const side = Math.min(width, tall)
  const rFit = Math.max(16, Math.min(Math.max(120, 0.42 * side), 0.48 * side))
  return {
    cx: width / 2,
    cy: insets.top + tall / 2,
    rFit,
    zoomRest: zoomForRadius(rFit),
    zoomMin: zoomForRadius(0.5 * rFit),
    zoomHand: clamp(zoomForRadius(2 * rFit), HAND_ZOOM.from, HAND_ZOOM.to),
  }
}

/**
 * How far the globe may be tipped towards a pole, in radians: it holds at
 * 75°, and a drag past that gives a little, to 80°, and springs back. North
 * always stays up.
 */
export const TILT = { hold: (75 * Math.PI) / 180, give: (80 * Math.PI) / 180 } as const

/**
 * A spot as the globe may face it: one nearer a pole than the hold (a town
 * on the ice, an address past z ±15,360, a flat map looking at the ice) is
 * faced from the hold, so it lies a little below or above the middle, and
 * the first touch of the hand doesn't tip the globe back to the hold.
 */
export const faceable = ({ lon, lat }: LonLat): LonLat => ({ lon, lat: clamp(lat, -TILT.hold, TILT.hold) })

/**
 * Where a spot on the sheet is drawn, as the sheet curls: `a` its longitude
 * from the facing spot (not wrapped: the flat sheet runs on past ±π into
 * its echoes), `phi` its latitude. The sheet is rolled round a sphere of
 * radius R/t, so at t = 0 it is the flat map exactly (Leaflet's own
 * W/2 + Δx·ppb, since R·Δλ is Δx·ppb) and at t = 1 the globe exactly, and
 * at every t the scale at the facing spot is R. In between the sheet wraps
 * a larger ball and doesn't yet close: its edges roll back first and the
 * poles gather. The ball is turned to bring the facing latitude round to
 * the front only as far as `tilt` says, the facing spot staying where it's
 * drawn whatever the turn: an upright ball hides its open poles and the gap
 * still open at its back, which a ball tipped towards the reader shows, so
 * the curl tips it only as it closes. The globe's vertex shader
 * (src/components/maps/globe/shaders.ts → curl()) is this, line for line;
 * `facing` is how squarely a spot faces the reader, 1 straight on, 0 at the
 * limb, below 0 round the back.
 */
export function curlSpot(a: number, phi: number, view: GlobeView): { x: number; y: number; facing: number } {
  const R = radiusAt(view.zoom)
  const t = view.t
  if (t < 1e-3) return { x: view.cx + R * a, y: view.cy - R * (phi - view.lat), facing: 1 }
  const r = R / t
  const al = t * a
  const be = t * phi
  const be0 = t * view.lat
  const th = (view.tilt ?? 1) * be0
  const dx = Math.cos(be) * Math.sin(al)
  const dy = Math.sin(be)
  const dz = Math.cos(be) * Math.cos(al)
  // The facing latitude comes round to the front, as far as the tilt takes it.
  const s = Math.sin(th)
  const k = Math.cos(th)
  const y = dy * k - dz * s
  const z = dy * s + dz * k
  // The facing spot, turned likewise, at the origin: r·(d − f) across and up the page.
  const fy = Math.sin(be0) * k - Math.cos(be0) * s
  return { x: view.cx + r * dx, y: view.cy - r * (y - fy), facing: z }
}

/** Where a spot on the globe is drawn, as curlSpot, its longitude taken the short way round from the facing spot. */
export const curlPoint = (ll: LonLat, view: GlobeView): { x: number; y: number; facing: number } =>
  curlSpot(wrapAngle(ll.lon - view.lon), ll.lat, view)

/**
 * The North Pole, softened. The world's last few degrees northwards are sea
 * and patchy ice, each row of the picture there wrapped round a small
 * circle about the pole, so turned north the ball would draw the patches
 * out into a starburst, with the dark sea of the topmost rows at its heart.
 * Instead, from POLE.read northwards, where a pixel spans many times more
 * of its circle of latitude than of its meridian, the picture is read along
 * the circle, so its ice keeps its shape rather than being smeared into
 * rays; and from POLE.fade the ground is drawn ever nearer its own circle's
 * colour, the picture's row averaged round the world, and wholly so two
 * degrees short of the pole, the picture meanwhile read along the circle
 * across ever more ground, POLE.grain of it at the last, about the size of
 * its patches of ice, so that none is drawn narrower than it is tall: the
 * sea and the ice gather into a soft haze about the pole, each circle its
 * own tone, as the far north of a globe does, with no point where
 * everything meets and no disc of one colour. How far any of it goes is
 * decided by how tightly the ground is gathered round the pole, cos(t·lat),
 * the share of its own width a row keeps on a sheet curled `t` of the way,
 * so the flat map (t = 0, nothing gathered) is left exactly as it is, and
 * the softening comes in only late in the curl, as the pole closes.
 * Antarctica, plain ice to the pole, needs none. The ground's shader
 * (src/components/maps/globe/shaders.ts → poleShare) is poleShare, line for
 * line, and nothing else changes: the borders, the marks and a click are
 * where they were.
 */
export const POLE = {
  read: { from: (76 * Math.PI) / 180, to: (80 * Math.PI) / 180 },
  fade: { from: (82 * Math.PI) / 180, to: (88 * Math.PI) / 180 },
  grain: (0.94 * Math.PI) / 180,
} as const

/**
 * How far a sheet curled `t` of the way has gathered the ground at latitude
 * `lat` round the North Pole, between two of the globe's latitudes: 0 short
 * of `from`, 1 from `to` on, eased between; 0 everywhere in the south.
 */
export function poleShare(lat: number, t: number, { from, to }: { from: number; to: number }): number {
  if (lat <= 0) return 0
  const k = clamp((Math.cos(t * lat) - Math.cos(to)) / (Math.cos(from) - Math.cos(to)), 0, 1)
  return 1 - k * k * (3 - 2 * k)
}

/** The spot on the globe (t = 1) under a point of the container; null off the sphere. */
export function pickLonLat(sx: number, sy: number, view: GlobeView): LonLat | null {
  const R = radiusAt(view.zoom)
  const dx = (sx - view.cx) / R
  const dy = -(sy - view.cy) / R
  const q = dx * dx + dy * dy
  if (q > 1) return null
  const dz = Math.sqrt(1 - q)
  // The facing latitude's tilt undone.
  const s = Math.sin(view.lat)
  const k = Math.cos(view.lat)
  const y = dy * k + dz * s
  const z = -dy * s + dz * k
  return { lon: wrapAngle(view.lon + Math.atan2(dx, z)), lat: Math.asin(clamp(y, -1, 1)) }
}

/** The block on the globe (t = 1) under a point of the container; null off the sphere. */
export function pickAt(sx: number, sy: number, view: GlobeView): Point | null {
  const spot = pickLonLat(sx, sy, view)
  return spot ? toBlock(spot) : null
}

/**
 * The globe at `zoom`, turned so that a spot on it is drawn at a point of
 * the container: what keeps the ground under a pointer as it zooms, and
 * under two fingers as they pinch. Solved outright, not nudged towards:
 * the spot's longitude from the new facing spot follows from how far
 * across the page it must sit, and the tilt from how far up. Null when no
 * turn of the globe can put the spot there (the point is off the sphere,
 * or too far across for the spot's latitude).
 */
export function placeSpot(view: GlobeView, spot: LonLat, sx: number, sy: number, zoom: number): GlobeView | null {
  const R = radiusAt(zoom)
  const dx = (sx - view.cx) / R
  const dy = -(sy - view.cy) / R
  const q = dx * dx + dy * dy
  const across = Math.cos(spot.lat)
  if (q > 1 || Math.abs(dx) > across) return null
  const dz = Math.sqrt(1 - q)
  // Of the two longitudes that put the spot that far across, the one nearer where it was.
  const near = Math.asin(dx / across)
  const was = wrapAngle(spot.lon - view.lon)
  const turn = Math.abs(wrapAngle(was - near)) <= Math.abs(wrapAngle(was - (Math.PI - near))) ? near : Math.PI - near
  const tilt = Math.atan2(Math.sin(spot.lat), across * Math.cos(turn)) - Math.atan2(dy, dz)
  return { ...view, zoom, lon: wrapAngle(spot.lon - turn), lat: clamp(wrapAngle(tilt), -TILT.give, TILT.give) }
}

/**
 * The globe zoomed to `zoom` about a point of the container, the spot under
 * it kept under it, as a map zooms about the pointer; about the facing spot
 * when the point is off the sphere, before or after.
 */
export function zoomAround(view: GlobeView, sx: number, sy: number, zoom: number): GlobeView {
  const spot = pickLonLat(sx, sy, view)
  return (spot && placeSpot(view, spot, sx, sy, zoom)) ?? { ...view, zoom }
}

/**
 * The spot of the flat map under a point of its container (`at`), and its
 * x as Leaflet has it, unwrapped (in an echo, it lies past the world's
 * edge): what the globe faces when the flat map curls up into it.
 * `flat.centre` is the flat map's centre as Leaflet has it, unwrapped too.
 */
export function faceOfFlat(
  flat: { centre: Point; zoom: number; width: number; height: number },
  at: [number, number],
): { face: LonLat; rawX: number } {
  const ppb = pixelsPerBlock(flat.zoom)
  const x = flat.centre[0] + (at[0] - flat.width / 2) / ppb
  const z = flat.centre[1] + (at[1] - flat.height / 2) / ppb
  return { face: toLonLat([x, z]), rawX: x }
}

/** A press on the globe is a click when it moves less than this (more for a finger) and is let go sooner. */
export const CLICK = { movePx: 6, moveTouchPx: 10, ms: 500 } as const

/** The angle between two spots on the globe, in radians, the short way round. */
export function between(a: LonLat, b: LonLat): number {
  const h =
    Math.sin((b.lat - a.lat) / 2) ** 2 + Math.cos(a.lat) * Math.cos(b.lat) * Math.sin(wrapAngle(b.lon - a.lon) / 2) ** 2
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The spot a share `k` of the way from `a` to `b` along the great circle between them. */
export function slerp(a: LonLat, b: LonLat, k: number): LonLat {
  const angle = between(a, b)
  if (angle < 1e-9) return b
  const v = (p: LonLat) => [Math.cos(p.lat) * Math.cos(p.lon), Math.cos(p.lat) * Math.sin(p.lon), Math.sin(p.lat)]
  const [pa, pb] = [v(a), v(b)]
  const wa = Math.sin((1 - k) * angle) / Math.sin(angle)
  const wb = Math.sin(k * angle) / Math.sin(angle)
  const [x, y, z] = pa.map((value, i) => wa * value + wb * pb[i])
  return { lon: Math.atan2(y, x), lat: Math.asin(clamp(z, -1, 1)) }
}
