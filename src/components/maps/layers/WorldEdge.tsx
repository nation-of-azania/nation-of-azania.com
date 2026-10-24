import type { Bounds } from '@/maps/geo'
import { GROUND } from '@/maps/palette'
import { WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH } from '@/maps/source'

import type { Projection } from './projection'

/**
 * The world's edges on the live map, which repeats the world east and west
 * so it can be scrolled without end. The repeats aren't real — the game's
 * world ends at its edges, and nobody walks west out of one into the other
 * — and the map says so without a word: each echo is washed pale, like a
 * sheet seen through tracing paper, and a dashed hairline marks every edge
 * between the real world and its copy. Plain SVG over the overlay's
 * projection, drawn afresh when the view settles like every layer;
 * nothing here answers the pointer.
 */

/** The echoes a view shows: 1 is the copy east of the real world, −1 the one west; none while the view is all real. */
export function echoesIn(projection: Projection): number[] {
  const { minX, maxX } = projection.bounds
  const first = Math.floor((minX - WORLD_WEST) / WORLD_WIDTH)
  const last = Math.floor((maxX - WORLD_WEST) / WORLD_WIDTH)
  const copies: number[] = []
  for (let copy = first; copy <= last; copy++) if (copy !== 0) copies.push(copy)
  return copies
}

/**
 * The real world's layers drawn `copy` worlds over: the same data, projected
 * across by a world's width, culled to what of the echo is on the page. The
 * layers need know nothing of echoes.
 */
export function echoProjection(projection: Projection, copy: number): Projection {
  const shift = copy * WORLD_WIDTH
  const back = (b: Bounds): Bounds => ({ minX: b.minX - shift, maxX: b.maxX - shift, minZ: b.minZ, maxZ: b.maxZ })
  return {
    ...projection,
    project: ([x, z]) => projection.project([x + shift, z]),
    bounds: back(projection.bounds),
    view: projection.view ? back(projection.view) : undefined,
    id: `${projection.id}-echo-${copy < 0 ? 'w' : 'e'}${Math.abs(copy)}`,
  }
}

/** The world's height on the page, in layer px, pole to pole, within what's on the page; null when none of it is. */
function sheetSpan(projection: Projection): { top: number; bottom: number } | null {
  const minZ = Math.max(projection.bounds.minZ, WORLD_NORTH)
  const maxZ = Math.min(projection.bounds.maxZ, WORLD_SOUTH)
  if (minZ >= maxZ) return null
  const [, top] = projection.project([0, minZ])
  const [, bottom] = projection.project([0, maxZ])
  return { top, bottom }
}

/**
 * The wash over each echo on the page, drawn under the layers: the copy's
 * sheet, faded. The real world gets a wash too, fully clear, keyed like
 * the echoes' by which copy it is to the reader (`world`, from
 * leaflet/home.ts): when the map re-bases a world over, the wash under the
 * reader fades away and the one over the copy they came from fades in,
 * which reads as one hand-over rather than a cut (the transition is in
 * maps.css, and off for readers who ask for less motion).
 */
export function EchoWash({ projection, world = 0 }: { projection: Projection; world?: number }) {
  const echoes = echoesIn(projection)
  const span = sheetSpan(projection)
  if (echoes.length === 0 || !span) return null
  return (
    <g className="az-echoes" pointerEvents="none">
      {[0, ...echoes].map((copy) => {
        const [left] = projection.project([copy * WORLD_WIDTH + WORLD_WEST, 0])
        const [right] = projection.project([copy * WORLD_WIDTH + WORLD_EAST, 0])
        return (
          <rect
            className="az-wash"
            fill={GROUND.whitewash}
            height={span.bottom - span.top}
            key={world + copy}
            style={{ fillOpacity: copy ? 0.5 : 0 }}
            width={right - left}
            x={left}
            y={span.top}
          />
        )
      })}
    </g>
  )
}

/**
 * The seams, drawn over everything: at every edge of the world on the
 * page, a hairline the height of the world, half black and dashed, where
 * the real world meets its echo. The wash over the echo says the rest.
 * Fixed in pixels, so it reads the same at every zoom, and kept to the
 * device's pixels, so it stays a hairline.
 */
export function Seams({ projection }: { projection: Projection }) {
  const { bounds } = projection
  const span = sheetSpan(projection)
  if (!span) return null
  const first = Math.ceil((bounds.minX - WORLD_WEST) / WORLD_WIDTH)
  const last = Math.floor((bounds.maxX - WORLD_WEST) / WORLD_WIDTH)
  if (first > last) return null
  const edges: number[] = []
  for (let copy = first; copy <= last; copy++) edges.push(WORLD_WEST + copy * WORLD_WIDTH)
  return (
    <g className="az-seams" pointerEvents="none">
      {edges.map((edge) => {
        const [x] = projection.project([edge, 0])
        return (
          <line
            key={edge}
            shapeRendering="crispEdges"
            stroke="#000"
            strokeDasharray="6 4"
            strokeOpacity={0.5}
            strokeWidth={1}
            x1={x}
            x2={x}
            y1={span.top}
            y2={span.bottom}
          />
        )
      })}
    </g>
  )
}
