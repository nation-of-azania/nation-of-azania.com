import { lineLength, type MapRoad } from '@/maps/data'
import { boundsOf, type Point } from '@/maps/geo'
import { GROUND, ROAD_ORDER, ROAD_STYLES } from '@/maps/palette'

import { boundsTouch, halo, LabelPlacer, pathOf, textWidth, type Projection } from './projection'

type Props = {
  projection: Projection
  roads: MapRoad[]
  /** Keeps names off the towns' and places' labels; without one, names go wherever they fall. */
  placer?: LabelPlacer
  selected?: number | null
  onSelect?: (road: MapRoad) => void
  labels?: boolean
}

/** The point halfway along a line, by length: where its name sits. */
function midpoint(line: Point[]): Point {
  const total = lineLength(line)
  let walked = 0
  for (let i = 1; i < line.length; i++) {
    const step = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
    if (walked + step >= total / 2) {
      const t = step === 0 ? 0 : (total / 2 - walked) / step
      return [
        line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
        line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t,
      ]
    }
    walked += step
  }
  return line[line.length - 1]
}

const roadWidth = (road: MapRoad, ppb: number) => {
  const style = ROAD_STYLES[road.kind]
  return Math.min(style.maxPx, Math.max(style.minPx, style.blocks * ppb))
}

/** Points ordered so a name along them reads left to right. */
const readable = (projection: Projection, road: MapRoad) => {
  const [x0] = projection.project(road.line[0])
  const [x1] = projection.project(road.line[road.line.length - 1])
  return x1 < x0 ? [...road.line].reverse() : road.line
}

/**
 * Roads the way a road map draws them: every casing first, then every fill,
 * so two roads that meet merge at the junction instead of one crossing the
 * other; the widest class on top. Widths follow the zoom with a floor, so
 * a lane is a hairline from afar and a proper street up close. A name
 * runs along the line once there's room for it.
 */
export function RoadsLayer({
  projection,
  roads,
  placer,
  selected,
  onSelect,
  labels = true,
}: Props) {
  const { ppb, zoom, bounds, id } = projection
  const interactive = Boolean(onSelect)
  const visible = roads.filter((road) => {
    const b = boundsOf(road.line)
    return b && boundsTouch(b, bounds)
  })
  const ordered = ROAD_ORDER.flatMap((kind) => visible.filter((road) => road.kind === kind))
  const paths = new Map(ordered.map((road) => [road.id, pathOf(projection, road.line)]))
  const fontSize = 11

  return (
    <g className="az-roads">
      <g className="az-road-casings">
        {ordered.map((road) => {
          const style = ROAD_STYLES[road.kind]
          const width = roadWidth(road, ppb)
          const isSelected = selected === road.id
          if (!style.casing && !isSelected) return null
          return (
            <path
              key={road.id}
              d={paths.get(road.id)}
              fill="none"
              stroke={isSelected ? GROUND.saffron : (style.casing ?? 'none')}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={width + (isSelected ? 5 : 2)}
            />
          )
        })}
      </g>
      <g className="az-road-fills">
        {ordered.map((road) => {
          const style = ROAD_STYLES[road.kind]
          const width = roadWidth(road, ppb)
          return (
            <g
              key={road.id}
              className={interactive ? 'az-hit' : undefined}
              onClick={onSelect ? () => onSelect(road) : undefined}
              style={interactive ? { cursor: 'pointer' } : undefined}
            >
              {/* A wide, invisible stroke makes a thin road easy to click. */}
              {interactive ? (
                <path
                  d={paths.get(road.id)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(width + 2, 12)}
                />
              ) : null}
              <path
                d={paths.get(road.id)}
                fill="none"
                stroke={style.fill}
                strokeDasharray={
                  style.dash ? style.dash.map((n) => n * width).join(' ') : undefined
                }
                strokeLinecap={style.dash ? 'butt' : 'round'}
                strokeLinejoin="round"
                strokeWidth={width}
              />
              {style.over ? (
                <path
                  d={paths.get(road.id)}
                  fill="none"
                  stroke={style.over.colour}
                  strokeDasharray={style.over.dash.map((n) => n * width).join(' ')}
                  strokeWidth={width * 0.45}
                />
              ) : null}
            </g>
          )
        })}
      </g>
      {labels && zoom >= -0.5 ? (
        <g className="az-road-names">
          {ordered.map((road) => {
            if (!road.name) return null
            const width = textWidth(road.name, fontSize)
            if (ppb * lineLength(road.line) < width + 40) return null
            if (placer) {
              const [mx, my] = projection.project(midpoint(road.line))
              if (
                !placer.tryClaim({
                  x: mx - width / 2,
                  y: my - fontSize,
                  width,
                  height: fontSize * 2,
                })
              )
                return null
            }
            const pathId = `${id}-road-${road.id}`
            return (
              <g key={road.id}>
                <defs>
                  <path d={pathOf(projection, readable(projection, road))} id={pathId} />
                </defs>
                <text
                  className="font-body"
                  dy={fontSize * 0.36}
                  fill={GROUND.ink}
                  fontSize={fontSize}
                  fontWeight={600}
                  letterSpacing={0.4}
                  {...halo(GROUND.whitewash, 3)}
                >
                  <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                    {road.name}
                  </textPath>
                </text>
              </g>
            )
          })}
        </g>
      ) : null}
    </g>
  )
}
