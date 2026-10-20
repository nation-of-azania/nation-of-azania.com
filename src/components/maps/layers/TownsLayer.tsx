import { homeClaimBounds, spoken, type MapTown } from '@/maps/data'
import { outlineToRing } from '@/maps/geo'
import { GROUND } from '@/maps/palette'

import { boundsTouch, halo, LabelPlacer, pathOf, textWidth, type Projection, type Rect } from './projection'

/** Where a town's name was found room (its box), for TownLabels to draw. */
export type TownLabel = Rect & {
  fontSize: number
  tracking: number
  /** Faded, once the reader is inside the town. */
  opacity: number
  /** At the home block, with its lozenge; or along the claim's edge, from inside. */
  at: 'home' | 'edge'
}

type Props = {
  projection: Projection
  towns: MapTown[]
  selected?: number | null
  /** Towns to set apart, in gold: a mayor's own, while they draw. Everything else fades. */
  emphasised?: number[]
  onSelect?: (town: MapTown) => void
}

const far = (zoom: number) => zoom <= -3

/** The zoom from which a town fills the view: its name leaves the home block for the claim's edge. */
const INSIDE = 0.5
/** Closer than this, the reader is plainly in town and the name is left off. */
const TOO_CLOSE = 2

/** The label's type at a zoom: size, tracking and how far above the home it sits (clear of a pin there, close in). */
const labelType = (zoom: number) => {
  const fontSize = zoom >= 0 ? 13 : zoom >= -2 ? 12 : 11
  return { fontSize, tracking: fontSize * 0.14, lift: zoom >= -0.5 ? 22 : 14 }
}

/** Towns by weight: the biggest keep their names when space is short. */
const byWeight = (towns: MapTown[]) => [...towns].sort((a, b) => b.residents - a.residents)

const onPage = (projection: Projection, town: MapTown) =>
  !town.bounds || boundsTouch(town.bounds, projection.bounds)

/**
 * Where a town's name may go, best first. Out at the scale of the nation,
 * above its home block (its lozenge), else below. Once the reader is inside
 * the town, the name moves to the top edge of the main claim, like a
 * district's name on a street map, and is left off when they are closer
 * still: the panel names the town, and the roads and places want the room.
 */
function nameCandidates(projection: Projection, town: MapTown): TownLabel[] {
  if (!town.home) return []
  const { zoom } = projection
  const { fontSize, tracking, lift } = labelType(zoom)
  const text = spoken(town.name).toUpperCase()
  const width = textWidth(text, fontSize, tracking) + 8
  const height = fontSize + 8
  /** The box around a name centred on `cx` with its baseline at `baseline`. */
  const box = (cx: number, baseline: number, at: TownLabel['at'], opacity: number): TownLabel => ({
    x: cx - width / 2,
    y: baseline - fontSize - 4,
    width,
    height,
    fontSize,
    tracking,
    opacity,
    at,
  })
  if (zoom < INSIDE) {
    const [x, y] = projection.project(town.home)
    return [box(x, y - lift, 'home', 1), box(x, y + lift + fontSize - 2, 'home', 1)]
  }
  if (zoom >= TOO_CLOSE) return []
  const claim = homeClaimBounds(town)
  if (!claim) return []
  const view = projection.view ?? projection.bounds
  // Along the top edge of the claim, centred on what of it is on the page.
  const left = Math.max(claim.minX, view.minX)
  const right = Math.min(claim.maxX, view.maxX)
  if (right - left <= 0) return []
  const [x, top] = projection.project([(left + right) / 2, claim.minZ])
  const opacity = 0.9 - ((zoom - INSIDE) / (TOO_CLOSE - INSIDE)) * 0.4
  return [box(x, top + fontSize + 10, 'edge', opacity)]
}

/** Finds each town's name a spot, the biggest towns first; part of the label plan (./labels.ts). */
export function placeTownNames(
  projection: Projection,
  towns: MapTown[],
  placer: LabelPlacer,
): Map<number, TownLabel> {
  const placed = new Map<number, TownLabel>()
  for (const town of byWeight(towns)) {
    if (!onPage(projection, town)) continue
    const spot = placer.tryPlace(nameCandidates(projection, town))
    if (spot) placed.set(town.id, spot)
  }
  return placed
}

/**
 * Azania's towns: Towny's claims as a tinted outline in the deep sea of the
 * brand. Far out, the claims thin to a hairline. The names are drawn by
 * TownLabels, last of all, so a name is never under a road.
 */
export function TownsLayer({ projection, towns, selected, emphasised, onSelect }: Props) {
  const { zoom } = projection
  const strokeWidth = far(zoom) ? 1 : zoom >= 0 ? 2 : 1.5
  const interactive = Boolean(onSelect)
  const emphasis = emphasised && emphasised.length > 0 ? new Set(emphasised) : null
  const visible = byWeight(towns).filter((town) => onPage(projection, town))

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
 * The towns' names in small capitals, haloed in whitewash: at their home
 * blocks, with a lozenge for the home itself, or along the claim's edge
 * once the reader is inside. Drawn after every other layer, where the
 * plan found room. The lozenge marks the home at every zoom.
 */
export function TownLabels({
  projection,
  towns,
  labels,
  selected,
  onSelect,
}: {
  projection: Projection
  towns: MapTown[]
  labels: Map<number, TownLabel>
  selected?: number | null
  onSelect?: (town: MapTown) => void
}) {
  const interactive = Boolean(onSelect)
  return (
    <g className="az-town-names">
      {byWeight(towns).map((town) => {
        if (!town.home || !onPage(projection, town)) return null
        const label = labels.get(town.id)
        const [hx, hy] = projection.project(town.home)
        const isSelected = selected === town.id
        return (
          <g
            key={town.id}
            className={interactive ? 'az-hit' : undefined}
            onClick={onSelect ? () => onSelect(town) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            <path
              d={`M${hx} ${hy - 5}L${hx + 5} ${hy}L${hx} ${hy + 5}L${hx - 5} ${hy}Z`}
              fill={isSelected ? GROUND.saffron : GROUND.sea800}
              stroke={GROUND.whitewash}
              strokeWidth={1.5}
            >
              <title>{spoken(town.name)}</title>
            </path>
            {label ? (
              <text
                className="font-label"
                fill={isSelected ? GROUND.saffronDeep : GROUND.sea800}
                fontSize={label.fontSize}
                fontWeight={600}
                letterSpacing={label.tracking}
                opacity={label.opacity}
                textAnchor="middle"
                x={label.x + label.width / 2 + label.tracking / 2}
                y={label.y + label.fontSize + 4}
                {...halo(GROUND.whitewash, 3.5)}
              >
                {spoken(town.name).toUpperCase()}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
