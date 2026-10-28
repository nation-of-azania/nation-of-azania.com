import type { RefObject } from 'react'

import type { Bounds, Point } from '@/maps/geo'
import type { Insets } from '@/maps/globe'
import type { MapPosition, MapSelection } from '@/maps/url'

import type { Store } from '../hooks'
import type { LiveState } from '../live'
import type { LookTarget, SceneApi } from '../MapScene'

/**
 * What the globe (./Globe.tsx), its keeper (./GlobeHost.tsx) and the shell
 * (../MapsShell.tsx) say to one another. The shell takes only types from
 * here and from the keeper, and code only from ./support.ts, which is kept
 * small; the keeper, the globe and three.js come through the dynamic
 * import there (loadGlobe), so none of the globe's drawing rides with the
 * map's first load.
 */

/** How the globe opens: fading in over the flat map, or the flat map curling up into it, by a button or by a pull past the farthest zoom. */
export type GlobeEntry = 'fade' | 'curl' | 'pull'

/**
 * Where the globe is in its life: drawing nothing (`closed`), following a
 * pull on the flat map that may yet spring back (`pulling`), opening,
 * open, and handing back to the flat map (`leaving`).
 */
export type GlobePhase = 'closed' | 'pulling' | 'opening' | 'open' | 'leaving'

/**
 * A way back to the flat map. `to` is where the flat map looks once the
 * globe has gone (the globe turns towards it first); `at` and `zoom` hand
 * back about a point of the container at a zoom, as a zoom past the globe's
 * closest does; `fade` hands back by a plain fade whatever else is asked
 * (the editor opening).
 */
export type LeaveRequest = { to?: LookTarget | null; at?: [number, number]; zoom?: number; fade?: boolean }

/**
 * A click on the globe: where the flat map is to look, and what opens with
 * it, a siege's card by its town's Towny id or a page (null for the map's
 * front; left out, the page open stays as it is).
 */
export type GlobePick = {
  selection?: MapSelection | null
  siege?: string
  target: LookTarget
  /** For a click on a town's outpost, or on claims detached from it: their bounds, looked at rather than the town once its page lands. */
  focus?: Bounds
}

/**
 * A pull on the flat map past its farthest zoom (src/components/maps/leaflet/canvas.tsx):
 * how many levels past it, whether the gesture goes on or has ended,
 * whether by touch, whether it has gone far enough to open the globe
 * (src/maps/view.ts → PULL), and when (performance.now()), so a
 * globe whose code arrives after the pull has ended knows whether it's news.
 */
export type GlobePull = { levels: number; phase: 'move' | 'end'; touch: boolean; opens: boolean; at: number }

/** What the shell may ask of a mounted globe. */
export type GlobeApi = {
  /** Open again, while it lingers closed. */
  enter: (entry: GlobeEntry) => void
  /** Hand back to the flat map: every way back runs through here. */
  leave: (request?: LeaveRequest) => void
  /** Turn to something and stay on the globe: a page opened from the search lands here. */
  face: (target: LookTarget) => void
  /**
   * The zoom buttons' step, eased (a cut for a reader who asks for less
   * motion); pressed while the globe hands back, the flat map's, once the
   * globe has gone.
   */
  zoomBy: (delta: number) => void
}

export type GlobeProps = {
  /** How to open on mounting. */
  entry: GlobeEntry
  /** The spot to open facing: the flat map's own, or the address's; else Azania. */
  initial: MapPosition | null
  /** Opened by the address (`&globe=1`): the globe keeps the zoom it names, where opened by hand it rests at its own. */
  arrival: boolean
  /**
   * Whether the reader has asked for the globe. Mounted by a pull still
   * under way it's not yet asked for, and only follows the pull; asked
   * for, it curls on up.
   */
  wanted: boolean
  /** What covers the map's top and foot: on a phone the search bar and the sheet; beside a wide map, the readouts and the What's-on strip at its foot. */
  insets: Insets
  /** The phone's sheet covers everything: draw nothing. */
  hidden: boolean
  liveStore: Store<LiveState>
  /** A pull on the flat map, followed while the globe is `pulling`. */
  pull: Store<GlobePull | null>
  /** The flat map, to hand back to and to borrow its picture of the world from. */
  flat: RefObject<SceneApi | null>
  onApi: (api: GlobeApi) => void
  onPhase: (phase: GlobePhase) => void
  /** The globe covers the flat map, or no longer does: the flat map is made inert, and the address follows the globe. */
  onCover: (covered: boolean) => void
  /** Where the globe has come to rest, as the flat map would say it (the zoom never under −8). */
  onSettle: (position: MapPosition) => void
  /** The reader turned or zoomed the globe themselves (a drag, a pinch, the wheel, the keys), not one of its own turns. */
  onGesture: () => void
  /** The block under the pointer; null off the sphere. */
  onPointer: (point: Point | null) => void
  onPick: (pick: GlobePick) => void
  /** The globe asks to hand back of its own accord: zoomed in past its closest. */
  onLeave: (request: LeaveRequest) => void
  /** Gone: the shell plays the look it held, and starts the lingering. */
  onClosed: () => void
  /** A pull fell short of opening the globe: the reader is told to keep going. */
  onHint: () => void
  /** The globe can't be drawn: no WebGL, its context lost for good, a shader refused, or anything else thrown. */
  onFail: (reason: 'webgl' | 'lost' | 'shader' | 'error') => void
  /** Closed and lingering, the globe has lost its context: it's to be let go of quietly, and made afresh when next wanted. */
  onGone: () => void
}
