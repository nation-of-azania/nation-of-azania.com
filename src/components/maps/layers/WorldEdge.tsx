import type { Bounds } from '@/maps/geo'
import { GROUND } from '@/maps/palette'
import { WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH } from '@/maps/source'

import type { Projection } from './projection'

/**
 * The world's edges on the live map, which repeats the world east and west
 * so it can be scrolled without end. The repeats aren't real — the game's
 * world ends at its edges, and nobody walks west out of one into the other
 * — and the map says so without a word: each echo is washed pale, like a
 * sheet seen through tracing paper, and at every edge the sheet is torn, a
 * dark gap with ragged paper either side between the real world and its
 * copy. Plain SVG over the overlay's projection, drawn afresh when the view
 * settles like every layer; nothing here answers the pointer.
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

/** The sheet's height on the page, in layer px: the rows the map draws, within what's on the page; null when none is. */
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
 * A torn edge down the page: a ragged line about `x`, in layer px, as one
 * path. The teeth vary in reach and spacing by a fixed pattern, so the edge
 * reads as torn paper rather than a zip, and tears the same way each time
 * it's drawn.
 */
function tear(x: number, top: number, bottom: number): string {
  const parts = [`M${(x - 2).toFixed(1)} ${top.toFixed(1)}`]
  for (let y = top, tooth = 0; y < bottom; tooth++) {
    const wobble = ((tooth * 7919) % 11) / 10
    y = Math.min(bottom, y + 4 + wobble * 7)
    const reach = 1.5 + wobble * 3
    parts.push(`L${(x + (tooth % 2 ? reach : -reach)).toFixed(1)} ${y.toFixed(1)}`)
  }
  return parts.join('')
}

/**
 * The seams, drawn over everything: at every edge of the sheet on the page,
 * a dark gap with the ragged edges of the two sheets either side, and a
 * soft shadow across it. Fixed in pixels, so the tear reads the same at
 * every zoom, and only as tall as the sheet, so beyond its last rows the
 * void is plain void.
 */
export function Seams({ projection }: { projection: Projection }) {
  const { bounds, id } = projection
  const span = sheetSpan(projection)
  if (!span) return null
  const first = Math.ceil((bounds.minX - WORLD_WEST) / WORLD_WIDTH)
  const last = Math.floor((bounds.maxX - WORLD_WEST) / WORLD_WIDTH)
  if (first > last) return null
  const shade = `${id}-seam`
  const edges: number[] = []
  for (let copy = first; copy <= last; copy++) edges.push(WORLD_WEST + copy * WORLD_WIDTH)
  return (
    <g className="az-seams" pointerEvents="none">
      <defs>
        <linearGradient id={shade} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={GROUND.sea} stopOpacity={0} />
          <stop offset="0.5" stopColor={GROUND.sea} stopOpacity={0.7} />
          <stop offset="1" stopColor={GROUND.sea} stopOpacity={0} />
        </linearGradient>
      </defs>
      {edges.map((edge) => {
        const [x] = projection.project([edge, 0])
        const torn = tear(x, span.top, span.bottom)
        return (
          <g key={edge}>
            <rect fill={`url(#${shade})`} height={span.bottom - span.top} width={40} x={x - 20} y={span.top} />
            {/* The gap, then the paper's edges either side of it. */}
            <path d={torn} fill="none" stroke={GROUND.sea} strokeLinejoin="round" strokeOpacity={0.92} strokeWidth={9} />
            <path
              d={torn}
              fill="none"
              stroke={GROUND.whitewash}
              strokeLinejoin="round"
              strokeOpacity={0.95}
              strokeWidth={1.5}
              transform="translate(-4.5 0)"
            />
            <path
              d={torn}
              fill="none"
              stroke={GROUND.whitewash}
              strokeLinejoin="round"
              strokeOpacity={0.95}
              strokeWidth={1.5}
              transform="translate(4.5 0)"
            />
          </g>
        )
      })}
    </g>
  )
}
