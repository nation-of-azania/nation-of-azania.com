import { spoken, type MapTown } from '@/maps/data'
import { outlineToRing } from '@/maps/geo'
import { GROUND } from '@/maps/palette'

import { boundsTouch, halo, LabelPlacer, pathOf, textWidth, type Projection } from './projection'

type Props = {
  projection: Projection
  towns: MapTown[]
  placer: LabelPlacer
  selected?: number | null
  /** Towns to set apart, in gold: a mayor's own, while they draw. Everything else fades. */
  emphasised?: number[]
  onSelect?: (town: MapTown) => void
  /** Filled with the ids whose names found room; TownLabels then draws them, over everything. */
  labelled?: Set<number>
}

const far = (zoom: number) => zoom <= -3

/** The label's type at a zoom: size, tracking and how far above the home it sits (clear of a pin there, close in). */
const labelType = (zoom: number) => {
  const fontSize = zoom >= 0 ? 13 : zoom >= -2 ? 12 : 11
  return { fontSize, tracking: fontSize * 0.14, lift: zoom >= -0.5 ? 22 : 14 }
}

/** The name's box above the home block. */
function labelRect(projection: Projection, town: MapTown) {
  if (!town.home) return null
  const [x, y] = projection.project(town.home)
  const { fontSize, tracking, lift } = labelType(projection.zoom)
  const width = textWidth(spoken(town.name).toUpperCase(), fontSize, tracking)
  return {
    x: x - width / 2 - 4,
    y: y - lift - fontSize - 4,
    width: width + 8,
    height: fontSize + 8,
  }
}

/** Towns by weight: the biggest keep their names when space is short. */
const byWeight = (towns: MapTown[]) => [...towns].sort((a, b) => b.residents - a.residents)

/**
 * Azania's towns: Towny's claims as a tinted outline in the deep sea of the
 * brand. Far out, the claims thin to a hairline. This pass also decides
 * which names have room (the biggest towns first); TownLabels draws them
 * last, so a name is never under a road.
 */
export function TownsLayer({
  projection,
  towns,
  placer,
  selected,
  emphasised,
  onSelect,
  labelled,
}: Props) {
  const { zoom, bounds } = projection
  const strokeWidth = far(zoom) ? 1 : zoom >= 0 ? 2 : 1.5
  const interactive = Boolean(onSelect)
  const emphasis = emphasised && emphasised.length > 0 ? new Set(emphasised) : null
  const visible = byWeight(towns).filter((town) => !town.bounds || boundsTouch(town.bounds, bounds))

  if (labelled) {
    for (const town of visible) {
      const rect = labelRect(projection, town)
      if (!rect) continue
      // Far out, only the names that fit; close in, every town keeps its name.
      if (placer.tryClaim(rect) || zoom >= -1) labelled.add(town.id)
    }
  }

  return (
    <g className="az-towns">
      {visible.map((town) => {
        const isSelected = selected === town.id
        const dimmed = emphasis ? !emphasis.has(town.id) : false
        const highlighted = emphasis ? emphasis.has(town.id) : false
        const d = town.claims
          .map((claim) => pathOf(projection, outlineToRing(claim), true))
          .join('')
        return (
          <g
            key={town.id}
            className={interactive ? 'az-hit' : undefined}
            data-town={town.id}
            onClick={onSelect ? () => onSelect(town) : undefined}
            opacity={dimmed ? 0.35 : 1}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            <path
              d={d}
              fill={highlighted ? GROUND.saffron : GROUND.sea700}
              fillOpacity={isSelected ? 0.2 : highlighted ? 0.16 : 0.09}
              stroke={highlighted ? GROUND.saffronDeep : GROUND.sea700}
              strokeLinejoin="round"
              strokeOpacity={isSelected || highlighted ? 1 : 0.8}
              strokeWidth={isSelected || highlighted ? strokeWidth + 1 : strokeWidth}
            />
          </g>
        )
      })}
    </g>
  )
}

/**
 * The towns' names in small capitals at their home blocks, haloed in
 * whitewash, with a lozenge for the home itself. Drawn after every other
 * layer, for the towns TownsLayer found room for.
 */
export function TownLabels({
  projection,
  towns,
  labelled,
  selected,
  onSelect,
}: {
  projection: Projection
  towns: MapTown[]
  labelled: Set<number>
  selected?: number | null
  onSelect?: (town: MapTown) => void
}) {
  const { fontSize, tracking, lift } = labelType(projection.zoom)
  const interactive = Boolean(onSelect)
  return (
    <g className="az-town-names">
      {byWeight(towns).map((town) => {
        if (!labelled.has(town.id) || !town.home) return null
        const [x, y] = projection.project(town.home)
        const isSelected = selected === town.id
        return (
          <g
            key={town.id}
            className={interactive ? 'az-hit' : undefined}
            onClick={onSelect ? () => onSelect(town) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            <path
              d={`M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z`}
              fill={isSelected ? GROUND.saffron : GROUND.sea800}
              stroke={GROUND.whitewash}
              strokeWidth={1.5}
            />
            <text
              className="font-label"
              fill={isSelected ? GROUND.saffronDeep : GROUND.sea800}
              fontSize={fontSize}
              fontWeight={600}
              letterSpacing={tracking}
              textAnchor="middle"
              x={x + tracking / 2}
              y={y - lift}
              {...halo(GROUND.whitewash, 3.5)}
            >
              {spoken(town.name).toUpperCase()}
            </text>
          </g>
        )
      })}
    </g>
  )
}
