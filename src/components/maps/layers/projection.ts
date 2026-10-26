import type { Bounds, Point } from '@/maps/geo'

/**
 * How the layers (./*.tsx) put blocks on paper. They are plain SVG, drawn
 * through this one interface, so the same components draw the live map in
 * the browser (where Leaflet projects) and the Map block's still picture on
 * the server (where a frame does). Nothing in a layer may touch the DOM or
 * a hook.
 */
export type Projection = {
  /** A block's position in the SVG's user units. */
  project: (point: Point) => [number, number]
  /** Pixels per block at this zoom. */
  ppb: number
  /** Map zoom: 0 is the tiles' native scale, 2 px per block. */
  zoom: number
  /** The visible extent in blocks, with a margin, for leaving out what's off the page. */
  bounds: Bounds
  /** The extent actually on the page, without the margin; `bounds` when not given. */
  view?: Bounds
  /** Prefixes element ids (text paths, masks), so two maps on one page don't collide. */
  id: string
  /**
   * How the names animate from one drawing to the next (leaflet/names.ts):
   * set only by the live map's canvas, absent in a still, where nothing
   * moves and the names carry no box.
   */
  names?: 'settle' | 'live'
}

export type Rect = { x: number; y: number; width: number; height: number }

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

/**
 * Keeps labels off each other and off the pins: a label claims its box, and
 * a later label that would overlap one is left out, or takes its next
 * candidate place. The hosts reserve what outranks everything first — an
 * article's highlights, then every pin and mark (./labels.ts) — and the
 * layers then place their names in order: towns, roads, places, events.
 */
export class LabelPlacer {
  private taken: Rect[] = []
  private tried = 0

  /**
   * Numbers the names in the order the plan tries them, placed or not,
   * for the live map to go by mid-gesture (leaflet/placing.ts): the plan's
   * order is its pecking order. Shared across the real world and its
   * echoes, so an echo's names rank after the real world's.
   */
  rank(): number {
    return this.tried++
  }

  fits(rect: Rect): boolean {
    return !this.taken.some((other) => overlaps(other, rect))
  }

  /** Takes the box whatever sits there: for pins and marks, which text keeps off. */
  claim(rect: Rect): void {
    this.taken.push(rect)
  }

  /** Claims the box if it's free; false when something already sits there. */
  tryClaim(rect: Rect): boolean {
    if (!this.fits(rect)) return false
    this.claim(rect)
    return true
  }

  /** The first of the candidate boxes that's free, claimed; null when none is. */
  tryPlace<T extends Rect>(candidates: T[]): T | null {
    for (const rect of candidates) if (this.tryClaim(rect)) return rect
    return null
  }
}

/** A text's box, estimated from its length: good enough to keep labels apart. */
export function textWidth(text: string, fontSize: number, tracking = 0): number {
  return text.length * fontSize * 0.56 + text.length * tracking
}

export const inBounds = (bounds: Bounds, [x, z]: Point): boolean =>
  x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ

export const boundsTouch = (a: Bounds, b: Bounds): boolean =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ

/** An SVG path through points, projected. */
export function pathOf(projection: Projection, points: Point[], close = false): string {
  if (points.length === 0) return ''
  const parts = points.map((point, index) => {
    const [x, y] = projection.project(point)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return parts.join('') + (close ? 'Z' : '')
}

/**
 * The halo every piece of text on the map wears, so it reads over any
 * ground: a stroke painted under the fill, which costs nothing next to a
 * filter.
 */
export const halo = (colour: string, width = 3) => ({
  paintOrder: 'stroke' as const,
  stroke: colour,
  strokeWidth: width,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
})

/*
 * Mid-zoom, the live map scales the whole overlay at once, and draws it
 * again only when the view settles (leaflet/canvas.tsx). The ground's
 * shapes — claims, roads, rings — should scale: they are the ground. A
 * name, a pin or a mark should not: it has a size on the page. So what
 * has one says so, in data attributes the live map reads each frame
 * (leaflet/steady.ts): a mark or a name is drawn about the point it
 * belongs to and scaled back about that point, so it keeps its size and
 * glides with it; a road's width follows its blocks as each zoom it
 * passes through would draw it; text along a path keeps its type size.
 * Every other line keeps its width (maps.css). The attributes are inert
 * anywhere else, and the drawing stands as it is drawn.
 */

/** Keeps an element its size on the page about (x, y), the point it belongs to: for marks and names. */
export const upright = (x: number, y: number) => ({
  'data-az-at': `${x.toFixed(1)} ${y.toFixed(1)}`,
})

/**
 * How a name at a point may move while the map does (leaflet/placing.ts),
 * which the plan says of each name it tries when the live map asks
 * (`reserve` in ./labels.ts): its rank in the plan's order; every spot
 * the plan would have tried for it, and which it drew; the live zooms it
 * may show in (after the first, up to the second, ±99 for no limit);
 * its class, Azania's names (1) before the world's (2) and what's kept
 * whatever the crowd (0, `force`); for the home name, the zoom up to
 * which it leads (`lead`); for a nation's name, its heart in the
 * drawing's px, about which it's kept on the page (`clamp`); and whether
 * it's drawn in reserve, hidden, for the map to bring in mid-gesture
 * when there's room.
 */
export type Live = {
  rank: number
  spots: Rect[]
  spot: number
  zooms: [number, number]
  klass: 0 | 1 | 2
  lead?: number
  force?: boolean
  clamp?: [number, number]
  reserve?: boolean
}

/**
 * Whether the names close in are placed every frame mid-gesture too — the
 * places' and the events', a town's name along its claim's edge, and the
 * world's towns in reserve — or only the names far out, where the
 * nations' jump most and the names are few. The close-in names are many,
 * and a phone's frames are dear.
 */
export const LIVE_CLOSE_IN = false

/** The live facts of a name placed at `spot` among `candidates` (`reserve`: held at the first, hidden). */
export const liveOf = (
  candidates: Rect[],
  spot: number,
  rank: number,
  zooms: [number, number],
  klass: Live['klass'],
  more: Pick<Live, 'lead' | 'force' | 'clamp' | 'reserve'> = {},
): Live => ({ rank, spots: candidates, spot, zooms, klass, ...more })

/** Whether the plan is asked how each name may move mid-gesture: only by the live map's own canvas. */
export const livePlan = (projection: Projection): boolean => projection.names === 'live'

/**
 * What the live map is told of a name besides its key: for a name at a
 * point, the box the plan drew it in, in the drawing's px, and how it may
 * move mid-gesture (`live`); for text set along a path, where along it
 * the text sits (`along`, in whatever terms the layer likes), which says
 * the name moved when the path is cut anew.
 */
export type NameInfo = { box?: Rect; along?: string; live?: Live }

/**
 * Marks an element as a name in the plan, keyed by what it names on this
 * projection, so the live map knows the same town's name across two
 * drawings and can hand one over to the next (leaflet/names.ts): a name
 * that stays glides to its new spot, one that goes fades out, one that
 * comes fades in. On the live map the element also says the box it was
 * drawn in, from which where it stands is computed rather than measured,
 * or, for text along a path, where along it the text sits; and on the
 * map's own canvas, how it may move mid-gesture, when the names at a
 * point are placed every frame (leaflet/placing.ts). The named element
 * carries no React style prop, and no opacity of its own: names.ts alone
 * writes its inline translate, opacity and visibility, so React never
 * fights it. It is mounted while the name is placed, or held in reserve.
 */
export const named = (projection: Projection, kind: string, id: string | number, info?: NameInfo) => {
  const box = projection.names ? info?.box : undefined
  const live = projection.names === 'live' && box ? info?.live : undefined
  return {
    'data-az-name': `${projection.id}/${kind}/${id}`,
    'data-az-box': box ? `${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.width.toFixed(1)} ${box.height.toFixed(1)}` : undefined,
    'data-az-along': projection.names && info?.along ? info.along : undefined,
    // Mid-gesture, the live map places the names at a point every frame (leaflet/placing.ts), by these.
    ...(live && box
      ? {
          'data-az-rank': String(live.rank),
          'data-az-spots': live.spots.map((spot) => `${(spot.x - box.x).toFixed(1)} ${(spot.y - box.y).toFixed(1)}`).join(' '),
          'data-az-spot': String(live.spot),
          'data-az-zooms': `${live.zooms[0].toFixed(2)} ${live.zooms[1].toFixed(2)}`,
          'data-az-class': String(live.klass),
          'data-az-lead': live.lead?.toFixed(2),
          'data-az-force': live.force ? '' : undefined,
          'data-az-clamp': live.clamp ? `${live.clamp[0].toFixed(1)} ${live.clamp[1].toFixed(1)}` : undefined,
          // A name in reserve is drawn hidden, and is nothing to a reader or a pointer until the map brings it in.
          'data-az-reserve': live.reserve ? '' : undefined,
          visibility: live.reserve ? ('hidden' as const) : undefined,
          'aria-hidden': live.reserve ? true : undefined,
        }
      : null),
  }
}

/**
 * Marks the element held upright about a pin, a mark or a highlight as
 * something the names keep off, with the box the plan claimed for it, so
 * the live map keeps the names off it mid-gesture too (leaflet/placing.ts).
 * Nothing anywhere else.
 */
export const kept = (projection: Projection, rect: Rect) => ({
  'data-az-keep':
    projection.names === 'live' ? `${rect.x.toFixed(1)} ${rect.y.toFixed(1)} ${rect.width.toFixed(1)} ${rect.height.toFixed(1)}` : undefined,
})

/** Keeps the type of text set along a path its size, which can't be scaled back as a whole: its size, tracking and halo, in px. */
export const steadyType = (fontSize: number, tracking: number, halo: number) => ({
  'data-az-type': `${fontSize} ${tracking} ${halo}`,
})

/** Keeps a hatching's lines their spacing on the page, as a hatching is meant to: on its pattern, with the pattern's turn. */
export const steadyHatch = (degrees: number) => ({
  'data-az-hatch': String(degrees),
})

/**
 * A road's width as each zoom draws it, for the live map to follow
 * mid-zoom: its blocks at this zoom (`base`, in px), held within its floor
 * and ceiling, taken `times` over with `plus` px added and never under
 * `least`; and its dashes, each so many of that width.
 */
export const steadyWidth = (
  width: { min: number; base: number; max: number; times?: number; plus?: number; least?: number },
  dash?: readonly number[],
) => ({
  'data-az-width': [width.min, width.base.toFixed(3), width.max, width.times ?? 1, width.plus ?? 0, width.least ?? 0].join(' '),
  'data-az-dash': dash?.join(' '),
})

/** A label's box beside a point, on the side asked for; `gap` is the room left for a pin. */
export function labelBeside(
  x: number,
  y: number,
  width: number,
  fontSize: number,
  side: 'right' | 'left' | 'below' | 'above',
  gap: number,
): Rect & { anchor: 'start' | 'middle' | 'end'; tx: number; ty: number } {
  const height = fontSize + 6
  switch (side) {
    case 'right':
      return { x: x + gap, y: y - height / 2, width: width + 6, height, anchor: 'start', tx: x + gap + 2, ty: y }
    case 'left':
      return { x: x - gap - width - 6, y: y - height / 2, width: width + 6, height, anchor: 'end', tx: x - gap - 2, ty: y }
    case 'below':
      return { x: x - width / 2 - 3, y: y + gap, width: width + 6, height, anchor: 'middle', tx: x, ty: y + gap + height / 2 }
    case 'above':
      return { x: x - width / 2 - 3, y: y - gap - height, width: width + 6, height, anchor: 'middle', tx: x, ty: y - gap - height / 2 }
  }
}
