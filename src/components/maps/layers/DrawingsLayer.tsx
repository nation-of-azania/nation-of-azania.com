import type { Point } from '@/maps/geo'
import { INK_COLOURS } from '@/maps/palette'
import type { Drawing } from '@/maps/registry'

import { halo, pathOf, type Projection } from './projection'

type Props = {
  projection: Projection
  drawings: Drawing[]
  /** Index of the drawing being edited, drawn with a dotted ring. */
  selected?: number | null
  onSelect?: (index: number) => void
}

export const STROKE_WIDTHS = { 1: 2.5, 2: 4, 3: 6 } as const

/** The centroid of a ring, for its label. */
export function centroid(points: Point[]): Point {
  const n = points.length
  return [points.reduce((s, [x]) => s + x, 0) / n, points.reduce((s, [, z]) => s + z, 0) / n]
}

/** An arrowhead at the end of a line, as a filled triangle in the same ink. */
function arrowhead(projection: Projection, points: Point[], size: number): string | null {
  if (points.length < 2) return null
  const [x1, y1] = projection.project(points[points.length - 1])
  // Aim from a point a little way back, so a wobbly hand still gives a straight head.
  let back = points.length - 2
  while (back > 0) {
    const [bx, by] = projection.project(points[back])
    if (Math.hypot(x1 - bx, y1 - by) > size) break
    back--
  }
  const [x0, y0] = projection.project(points[back])
  const angle = Math.atan2(y1 - y0, x1 - x0)
  const left = angle + Math.PI * 0.8
  const right = angle - Math.PI * 0.8
  const tip = [x1 + Math.cos(angle) * size * 0.6, y1 + Math.sin(angle) * size * 0.6]
  return `M${tip[0]} ${tip[1]}L${tip[0] + Math.cos(left) * size * 1.6} ${tip[1] + Math.sin(left) * size * 1.6}L${tip[0] + Math.cos(right) * size * 1.6} ${tip[1] + Math.sin(right) * size * 1.6}Z`
}

/** The pin a highlight drops: a teardrop in the ink with a whitewash eye. */
export function HighlightPin({
  x,
  y,
  fill,
  halo: haloColour,
  scale = 1,
}: {
  x: number
  y: number
  fill: string
  halo: string
  scale?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 0C-3 -5 -9 -9 -9 -16a9 9 0 0 1 18 0c0 7 -6 11 -9 16z"
        fill={fill}
        stroke={haloColour}
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <circle cy={-16} fill={haloColour} r={3.2} />
    </g>
  )
}

/**
 * The highlights of a map view: strokes, shaded areas, pins and short
 * notes in the fixed inks, each with its halo. Drawn as a reader's hand
 * would mark a printed map, over everything else; they carry no meaning
 * beyond the view they were drawn for.
 */
export function DrawingsLayer({ projection, drawings, selected, onSelect }: Props) {
  const interactive = Boolean(onSelect)
  const fontSize = 15
  return (
    <g className="az-drawings">
      {drawings.map((drawing, index) => {
        const ink = INK_COLOURS[drawing.ink] ?? INK_COLOURS.ink
        const isSelected = selected === index
        const hit = interactive
          ? { className: 'az-hit', onClick: () => onSelect!(index), style: { cursor: 'pointer' } }
          : {}
        switch (drawing.kind) {
          case 'line': {
            const width = STROKE_WIDTHS[drawing.weight ?? 2]
            const d = pathOf(projection, drawing.points)
            const head = drawing.arrow ? arrowhead(projection, drawing.points, width * 2.2) : null
            const [lx, ly] = projection.project(drawing.points[drawing.points.length - 1])
            return (
              <g key={index} {...hit}>
                {interactive ? (
                  <path d={d} fill="none" stroke="transparent" strokeWidth={width + 10} />
                ) : null}
                <path
                  d={d}
                  fill="none"
                  stroke={ink.halo}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.9}
                  strokeWidth={width + 3}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={ink.fill}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={width}
                />
                {head ? (
                  <path
                    d={head}
                    fill={ink.fill}
                    stroke={ink.halo}
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                  />
                ) : null}
                {drawing.label ? (
                  <text
                    className="font-display"
                    dy={-width - 6}
                    fill={ink.fill}
                    fontSize={fontSize}
                    fontStyle="italic"
                    fontWeight={600}
                    textAnchor="middle"
                    x={lx}
                    y={ly}
                    {...halo(ink.halo, 3.5)}
                  >
                    {drawing.label}
                  </text>
                ) : null}
                {isSelected ? (
                  <path
                    d={d}
                    fill="none"
                    stroke={ink.fill}
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    strokeWidth={width + 8}
                  />
                ) : null}
              </g>
            )
          }
          case 'area': {
            const d = pathOf(projection, drawing.points, true)
            const [cx, cy] = projection.project(centroid(drawing.points))
            return (
              <g key={index} {...hit}>
                <path
                  d={d}
                  fill={ink.fill}
                  fillOpacity={0.22}
                  stroke={ink.halo}
                  strokeLinejoin="round"
                  strokeWidth={4}
                  strokeOpacity={0.8}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={ink.fill}
                  strokeLinejoin="round"
                  strokeWidth={2}
                  strokeDasharray={isSelected ? '4 3' : undefined}
                />
                {drawing.label ? (
                  <text
                    className="font-display"
                    dy={fontSize * 0.36}
                    fill={ink.fill}
                    fontSize={fontSize}
                    fontStyle="italic"
                    fontWeight={600}
                    textAnchor="middle"
                    x={cx}
                    y={cy}
                    {...halo(ink.halo, 3.5)}
                  >
                    {drawing.label}
                  </text>
                ) : null}
              </g>
            )
          }
          case 'pin': {
            const [x, y] = projection.project(drawing.at)
            return (
              <g key={index} {...hit}>
                <HighlightPin
                  fill={ink.fill}
                  halo={ink.halo}
                  scale={isSelected ? 1.2 : 1}
                  x={x}
                  y={y}
                />
                {drawing.label ? (
                  <text
                    className="font-display"
                    dy={fontSize * 0.36}
                    fill={ink.fill}
                    fontSize={fontSize}
                    fontStyle="italic"
                    fontWeight={600}
                    x={x + 12}
                    y={y - 16}
                    {...halo(ink.halo, 3.5)}
                  >
                    {drawing.label}
                  </text>
                ) : null}
              </g>
            )
          }
          case 'text': {
            const [x, y] = projection.project(drawing.at)
            return (
              <g key={index} {...hit}>
                <text
                  className="font-display"
                  dy={fontSize * 0.36}
                  fill={ink.fill}
                  fontSize={fontSize + 1}
                  fontStyle="italic"
                  fontWeight={600}
                  textAnchor="middle"
                  textDecoration={isSelected ? 'underline' : undefined}
                  x={x}
                  y={y}
                  {...halo(ink.halo, 4)}
                >
                  {drawing.text}
                </text>
              </g>
            )
          }
          default:
            return null
        }
      })}
    </g>
  )
}
